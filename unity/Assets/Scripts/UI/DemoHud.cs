using System.Collections;
using System.Collections.Generic;
using Quriosity.Gameplay;
using Quriosity.Quantum;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.U2D;

namespace Quriosity.UI
{
    /// <summary>
    /// Small IMGUI presentation for the authored demo rooms; no Canvas or EventSystem.
    /// All layout is in the same 640 x 360 coordinates as the fixed room camera.
    /// </summary>
    [DisallowMultipleComponent]
    [DefaultExecutionOrder(-1000)]
    public sealed class DemoHud : MonoBehaviour
    {
        private const int ViewWidth = 640;
        private const int ViewHeight = 360;
        private static readonly string[] SceneNames =
        {
            "01-the-box", "02-linked-rooms", "03-phase-laboratory", "04-schrodingers-hideout"
        };
        private static readonly Color Paper = new Color(0.95f, 0.95f, 1f);
        private static readonly Color Muted = new Color(0.69f, 0.73f, 0.83f);
        private static readonly Color Teal = new Color(0.55f, 0.9f, 0.85f);
        private static readonly Color Lilac = new Color(0.8f, 0.7f, 0.95f);
        private static readonly Color Pink = new Color(1f, 0.65f, 0.79f);
        private static readonly Color PanelColor = new Color(0.035f, 0.045f, 0.09f, 0.94f);

        [Header("Authored room")]
        [SerializeField] private PlayerController player;
        [SerializeField] private QuantumStation station;
        [SerializeField] private string levelTitle = "01 / THE BOX";
        [SerializeField, TextArea(2, 4)] private string learningGoal;
        [SerializeField] private bool showIntro = true;
        [SerializeField] private bool isTemplate;

        [Header("Story portraits (individual sprites, not entire textures)")]
        [SerializeField] private Sprite fleabagArt;
        [SerializeField] private Sprite catArt;
        [SerializeField] private Sprite villainArt;
        [SerializeField] private Sprite boxArt;

        private readonly List<LevelExit> exits = new List<LevelExit>();
        private PlayerRespawn respawn;
        private Transform villainRoot;
        private PixelPerfectCamera pixelCamera;
        private bool originalStretchFill;
        private bool initialized;
        private bool subscribed;
        private bool introActive;
        private int introPage;
        private bool paused;
        private bool completed;
        private bool loadingScene;
        private bool waitingForRelease;
        private int modalChangedFrame = -1;
        private bool ownsInputLock;
        private bool inputEnabledBeforeLock;
        private bool gamepadHints;
        private float respawnNoticeUntil;
        private string navigationNotice;
        private string nextTemplate;
        private bool departureStarted;
        private Coroutine departureRoutine;
        private float viewScale = 1f;
        private Vector2 viewOrigin;
        private float styleScale = -1f;
        private Font runtimeFont;
        private GUIStyle smallStyle;
        private GUIStyle bodyStyle;
        private GUIStyle titleStyle;
        private GUIStyle headingStyle;
        private GUIStyle buttonStyle;

        public void Configure(PlayerController player, QuantumStation station, string levelTitle,
            string learningGoal, bool showIntro, bool isTemplate)
        {
            this.player = player;
            this.station = station;
            this.levelTitle = levelTitle;
            this.learningGoal = learningGoal;
            this.showIntro = showIntro;
            this.isTemplate = isTemplate;
        }

        public void ConfigureStoryArt(Sprite fleabag, Sprite cat, Sprite villain, Sprite box)
        {
            fleabagArt = fleabag;
            catArt = cat;
            villainArt = villain;
            boxArt = box;
        }

        private void Start()
        {
            // Discover only this scene, once; additive editor rooms must not
            // acquire each other's player, exit subscriptions or story props.
            foreach (GameObject root in gameObject.scene.GetRootGameObjects())
            {
                if (player == null)
                {
                    player = root.GetComponentInChildren<PlayerController>(true);
                }

                if (station == null)
                {
                    station = root.GetComponentInChildren<QuantumStation>(true);
                }

                if (pixelCamera == null)
                {
                    pixelCamera = root.GetComponentInChildren<PixelPerfectCamera>(true);
                }

                exits.AddRange(root.GetComponentsInChildren<LevelExit>(true));
                foreach (Transform child in root.GetComponentsInChildren<Transform>(true))
                {
                    if (child.name == "Schrodinger")
                    {
                        villainRoot = child;
                        break;
                    }
                }
            }

            respawn = player != null ? player.GetComponent<PlayerRespawn>() : null;
            originalStretchFill = pixelCamera != null && pixelCamera.stretchFill;
            nextTemplate = FindNextTemplate();
            introActive = showIntro;
            initialized = true;
            Subscribe();
            GuardModalTransition();
            RefreshViewport();
            ApplyInputLock();
            if (!introActive)
            {
                BeginDeparture();
            }
        }

        private void OnEnable()
        {
            if (initialized)
            {
                Subscribe();
                GuardModalTransition();
                ApplyInputLock();
            }
        }

        private void OnDisable()
        {
            Unsubscribe();
            ReleaseInputLock();
            if (pixelCamera != null && initialized)
            {
                pixelCamera.stretchFill = originalStretchFill;
            }

            if (departureRoutine != null)
            {
                StopCoroutine(departureRoutine);
                departureRoutine = null;
                if (villainRoot != null)
                {
                    villainRoot.gameObject.SetActive(false);
                }
            }
        }

        private void Subscribe()
        {
            if (subscribed)
            {
                return;
            }

            foreach (LevelExit exit in exits)
            {
                if (exit != null)
                {
                    exit.Reached += OnExitReached;
                }
            }

            if (respawn != null)
            {
                respawn.Respawned += OnRespawned;
            }

            subscribed = true;
        }

        private void Unsubscribe()
        {
            foreach (LevelExit exit in exits)
            {
                if (exit != null)
                {
                    exit.Reached -= OnExitReached;
                }
            }

            if (respawn != null)
            {
                respawn.Respawned -= OnRespawned;
            }

            subscribed = false;
        }

        private void Update()
        {
            if (!initialized)
            {
                return;
            }

            Keyboard keyboard = Keyboard.current;
            Gamepad gamepad = Gamepad.current;
            if (keyboard != null && keyboard.anyKey.wasPressedThisFrame)
            {
                gamepadHints = false;
            }
            else if (gamepad != null && (gamepad.leftStick.ReadValue().sqrMagnitude > 0.04f
                || gamepad.dpad.ReadValue().sqrMagnitude > 0f || gamepad.buttonSouth.wasPressedThisFrame
                || gamepad.buttonEast.wasPressedThisFrame || gamepad.buttonWest.wasPressedThisFrame
                || gamepad.rightShoulder.wasPressedThisFrame || gamepad.startButton.wasPressedThisFrame))
            {
                gamepadHints = true;
            }

            if (waitingForRelease && Time.frameCount > modalChangedFrame && !ModalInputHeld())
            {
                waitingForRelease = false;
            }

            if (!loadingScene && !completed && CanAcceptModalInput()
                && ((keyboard != null && keyboard.escapeKey.wasPressedThisFrame)
                    || (gamepad != null && gamepad.startButton.wasPressedThisFrame)))
            {
                SetPaused(!paused);
            }
            else if (!loadingScene && !paused && CanAcceptModalInput())
            {
                if (introActive && AdvancePressed())
                {
                    AdvanceIntro();
                }
                else if (completed)
                {
                    if ((keyboard != null && (keyboard.enterKey.wasPressedThisFrame
                        || keyboard.numpadEnterKey.wasPressedThisFrame))
                        || (gamepad != null && gamepad.buttonSouth.wasPressedThisFrame))
                    {
                        RestartRoom();
                    }
                    else if ((keyboard != null && keyboard.nKey.wasPressedThisFrame)
                        || (gamepad != null && gamepad.buttonWest.wasPressedThisFrame))
                    {
                        LoadRoom(nextTemplate);
                    }
                }
            }

            // Execute before the controller/station Updates. R is deliberately
            // owned by PlayerRespawn; neither respawn nor a held advance unlocks us.
            ApplyInputLock();
        }

        private void LateUpdate()
        {
            RefreshViewport();
        }

        private bool CanAcceptModalInput()
        {
            return Time.frameCount > modalChangedFrame && !waitingForRelease;
        }

        private static bool AdvancePressed()
        {
            Keyboard keyboard = Keyboard.current;
            Gamepad gamepad = Gamepad.current;
            return (keyboard != null && (keyboard.enterKey.wasPressedThisFrame
                || keyboard.numpadEnterKey.wasPressedThisFrame || keyboard.eKey.wasPressedThisFrame
                || keyboard.spaceKey.wasPressedThisFrame))
                || (gamepad != null && gamepad.buttonSouth.wasPressedThisFrame);
        }

        private static bool ModalInputHeld()
        {
            Keyboard keyboard = Keyboard.current;
            Gamepad gamepad = Gamepad.current;
            Mouse mouse = Mouse.current;
            return (keyboard != null && (keyboard.enterKey.isPressed || keyboard.numpadEnterKey.isPressed
                || keyboard.eKey.isPressed || keyboard.spaceKey.isPressed || keyboard.escapeKey.isPressed
                || keyboard.nKey.isPressed))
                || (gamepad != null && (gamepad.buttonSouth.isPressed || gamepad.buttonWest.isPressed
                    || gamepad.startButton.isPressed))
                || (mouse != null && mouse.leftButton.isPressed);
        }

        private void GuardModalTransition()
        {
            modalChangedFrame = Time.frameCount;
            waitingForRelease = true;
        }

        private void ApplyInputLock()
        {
            bool shouldLock = introActive || paused || completed || loadingScene || waitingForRelease;
            if (player == null)
            {
                return;
            }

            if (shouldLock)
            {
                if (!ownsInputLock)
                {
                    inputEnabledBeforeLock = player.IsInputEnabled;
                    ownsInputLock = true;
                }

                player.SetInputEnabled(false);
            }
            else
            {
                ReleaseInputLock();
            }
        }

        private void ReleaseInputLock()
        {
            if (ownsInputLock && player != null)
            {
                player.SetInputEnabled(inputEnabledBeforeLock);
            }

            ownsInputLock = false;
        }

        private void AdvanceIntro()
        {
            if (!introActive || !CanAcceptModalInput())
            {
                return;
            }

            introPage++;
            if (introPage >= 3)
            {
                introActive = false;
                BeginDeparture();
            }

            GuardModalTransition();
            ApplyInputLock();
        }

        private void SetPaused(bool value)
        {
            paused = value;
            GuardModalTransition();
            ApplyInputLock();
        }

        private void OnRespawned()
        {
            respawnNoticeUntil = Time.unscaledTime + 2.5f;
            ApplyInputLock();
        }

        private void OnExitReached()
        {
            if (completed)
            {
                return;
            }

            completed = true;
            paused = false;
            introActive = false;
            BeginDeparture();
            GuardModalTransition();
            ApplyInputLock();
        }

        private void BeginDeparture()
        {
            if (departureStarted || villainRoot == null || !villainRoot.gameObject.activeInHierarchy)
            {
                return;
            }

            LevelExit nearestExit = null;
            float nearestDistance = float.PositiveInfinity;
            foreach (LevelExit exit in exits)
            {
                if (exit != null)
                {
                    float distance = (exit.transform.position - villainRoot.position).sqrMagnitude;
                    if (distance < nearestDistance)
                    {
                        nearestExit = exit;
                        nearestDistance = distance;
                    }
                }
            }

            if (nearestExit != null)
            {
                departureStarted = true;
                departureRoutine = StartCoroutine(DepartThroughDoor(nearestExit.transform));
            }
        }

        private IEnumerator DepartThroughDoor(Transform door)
        {
            Vector3 start = villainRoot.position;
            Vector3 destination = door.position + Vector3.up;
            destination.z = start.z;
            SpriteRenderer[] renderers = villainRoot.GetComponentsInChildren<SpriteRenderer>(true);
            var colors = new Color[renderers.Length];
            for (int i = 0; i < renderers.Length; i++)
            {
                colors[i] = renderers[i].color;
            }

            const float duration = 0.9f;
            float elapsed = 0f;
            while (elapsed < duration && villainRoot != null)
            {
                elapsed += Time.unscaledDeltaTime;
                float progress = Mathf.Clamp01(elapsed / duration);
                villainRoot.position = Vector3.Lerp(start, destination,
                    Mathf.SmoothStep(0f, 1f, Mathf.Clamp01(progress / 0.7f)));
                float opacity = 1f - Mathf.InverseLerp(0.3f, 1f, progress);
                for (int i = 0; i < renderers.Length; i++)
                {
                    if (renderers[i] != null)
                    {
                        Color color = colors[i];
                        color.a *= opacity;
                        renderers[i].color = color;
                    }
                }

                yield return null;
            }

            if (villainRoot != null)
            {
                villainRoot.gameObject.SetActive(false);
            }

            departureRoutine = null;
        }

        private string FindNextTemplate()
        {
            string current = gameObject.scene.name;
            for (int i = 0; i < SceneNames.Length - 1; i++)
            {
                if (SceneNames[i] == current && Application.CanStreamedLevelBeLoaded(SceneNames[i + 1]))
                {
                    return SceneNames[i + 1];
                }
            }

            return null;
        }

        private void RestartRoom()
        {
            if (loadingScene)
            {
                return;
            }

            int buildIndex = gameObject.scene.buildIndex;
            if (buildIndex < 0 || !Application.CanStreamedLevelBeLoaded(buildIndex))
            {
                navigationNotice = "Add this scene to the active Build Profile, then restart Play Mode to retry.";
                return;
            }

            loadingScene = true;
            ApplyInputLock();
            SceneManager.LoadScene(buildIndex);
        }

        private void LoadRoom(string sceneName)
        {
            if (loadingScene || string.IsNullOrEmpty(sceneName))
            {
                return;
            }

            if (!Application.CanStreamedLevelBeLoaded(sceneName))
            {
                navigationNotice = "Add the destination scene to the active Build Profile, then restart Play Mode.";
                return;
            }

            loadingScene = true;
            ApplyInputLock();
            SceneManager.LoadScene(sceneName);
        }

        private void RefreshViewport()
        {
            if (Screen.width <= 0 || Screen.height <= 0)
            {
                return;
            }

            float fit = Mathf.Min((float)Screen.width / ViewWidth, (float)Screen.height / ViewHeight);
            bool stretch = fit < 1f || originalStretchFill;
            if (pixelCamera != null && initialized)
            {
                // Below the reference size, integer pixels cannot fit. Let the
                // existing camera downscale the whole room instead of cropping it.
                pixelCamera.stretchFill = stretch;
            }

            viewScale = stretch ? fit : Mathf.Max(1f, Mathf.Floor(fit));
            float width = ViewWidth * viewScale;
            float height = ViewHeight * viewScale;
            int left = (Screen.width - (int)width) / 2;
            int bottom = (Screen.height - (int)height) / 2;
            // PixelPerfectCamera's final blit uses bottom-left screen coordinates.
            // Preserve its odd-sized-window rounding when converting to GUI's top-left.
            viewOrigin = new Vector2(left, Screen.height - height - bottom);
        }

        private void OnGUI()
        {
            if (!initialized)
            {
                return;
            }

            RefreshViewport();
            EnsureStyles();
            Color oldColor = GUI.color;
            Color oldBackground = GUI.backgroundColor;
            Color oldContent = GUI.contentColor;
            bool oldEnabled = GUI.enabled;
            Matrix4x4 oldMatrix = GUI.matrix;
            GUI.matrix = Matrix4x4.identity;
            GUI.color = Color.white;
            GUI.contentColor = Color.white;
            GUI.enabled = true;
            try
            {
                DrawGameplayHud();
                if (completed)
                {
                    DrawCompletion();
                }
                else if (paused)
                {
                    DrawPause();
                }
                else if (introActive)
                {
                    DrawIntro();
                }
            }
            finally
            {
                GUI.matrix = oldMatrix;
                GUI.color = oldColor;
                GUI.backgroundColor = oldBackground;
                GUI.contentColor = oldContent;
                GUI.enabled = oldEnabled;
            }
        }

        private void EnsureStyles()
        {
            if (bodyStyle != null && Mathf.Approximately(styleScale, viewScale))
            {
                return;
            }

            runtimeFont = runtimeFont != null ? runtimeFont : Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            styleScale = viewScale;
            smallStyle = MakeTextStyle(10, false);
            bodyStyle = MakeTextStyle(11, false);
            titleStyle = MakeTextStyle(12, true);
            headingStyle = MakeTextStyle(20, true);
            buttonStyle = new GUIStyle(GUI.skin.button)
            {
                font = runtimeFont,
                fontSize = Mathf.Max(1, Mathf.RoundToInt(11f * viewScale)),
                fontStyle = FontStyle.Bold,
                alignment = TextAnchor.MiddleCenter,
                padding = new RectOffset(0, 0, 0, 0),
                richText = false
            };
            buttonStyle.normal.textColor = Paper;
            buttonStyle.hover.textColor = Color.white;
            buttonStyle.active.textColor = Color.white;
        }

        private GUIStyle MakeTextStyle(int size, bool bold)
        {
            var style = new GUIStyle(GUI.skin.label)
            {
                font = runtimeFont,
                fontSize = Mathf.Max(1, Mathf.RoundToInt(size * viewScale)),
                fontStyle = bold ? FontStyle.Bold : FontStyle.Normal,
                alignment = TextAnchor.UpperLeft,
                wordWrap = true,
                richText = false,
                padding = new RectOffset(0, 0, 0, 0),
                margin = new RectOffset(0, 0, 0, 0)
            };
            style.normal.textColor = Color.white;
            return style;
        }

        private void DrawGameplayHud()
        {
            Panel(new Rect(8, 8, 624, 22), isTemplate ? Muted : Pink);
            Text(new Rect(16, 12, 448, 16), levelTitle, titleStyle, Paper);
            string dash = player == null ? "DASH / --" : player.IsDashing ? "DASH / ACTIVE"
                : player.HasDash ? "DASH / READY" : "DASH / LAND TO REFILL";
            Text(new Rect(478, 13, 146, 14), dash, smallStyle,
                player != null && player.HasDash ? Teal : Muted);

            Panel(new Rect(8, 36, 308, isTemplate ? 80 : 57), isTemplate ? Muted : Pink);
            Text(new Rect(18, 42, 288, 14), isTemplate ? "MOVEMENT TEMPLATE / SAFE GRAYBOX" : "FIND HILARY", smallStyle,
                isTemplate ? Muted : Pink);
            string goal = isTemplate ? learningGoal : station != null && station.MeasuredOutcome.HasValue
                ? "Route |" + station.MeasuredOutcome.Value + "> is solid. Follow it to the door."
                : "Both bridges are ghosts until measurement.\nPrepare at the console, then measure a route.";
            Text(new Rect(18, 58, 288, isTemplate ? 52 : 29), goal, bodyStyle, Paper);

            if (!isTemplate && station != null)
            {
                DrawQuantumPanel();
            }

            Panel(new Rect(8, 337, 624, 15), Muted);
            string controls = gamepadHints
                ? "Stick/D-pad: move   South: jump   East/RB: dash   West: console   Start: pause"
                : "A/D / arrows: move   Space: jump   Shift/X: dash   E: console   R: respawn   Esc: pause";
            Text(new Rect(14, 339, 612, 12), controls, smallStyle, Muted);
            if (!introActive && !paused && !completed && Time.unscaledTime < respawnNoticeUntil)
            {
                Panel(new Rect(8, 122, 308, 20), Teal);
                Text(new Rect(18, 126, 288, 13), "Back at checkpoint. Keep following Hilary.", smallStyle, Teal);
            }
        }

        private void DrawQuantumPanel()
        {
            Panel(new Rect(326, 36, 306, 102), station.MeasuredOutcome.HasValue ? Lilac : Teal);
            string phase = station.MeasuredOutcome.HasValue ? "MEASURED / ONE SOLID ROUTE"
                : station.IsPrepared ? "SUPERPOSITION / READY TO MEASURE" : "QUBIT / PREPARE TO REVEAL ROUTES";
            Text(new Rect(336, 42, 286, 13), phase, smallStyle, station.MeasuredOutcome.HasValue ? Lilac : Teal);
            string summary = station.MeasuredOutcome.HasValue
                ? "Collapsed to |" + station.MeasuredOutcome.Value + ">. Follow the solid route."
                : station.IsPrepared ? "H|0> = (|0> + |1>) / sqrt(2)"
                : "|0> initial state. Prepare, then measure.";
            Text(new Rect(336, 57, 286, 14), summary, smallStyle, Paper);
            Probability(new Rect(336, 75, 136, 12), "|0>", station.ZeroProbability, Teal);
            Probability(new Rect(486, 75, 136, 12), "|1>", station.OneProbability, Lilac);
            Text(new Rect(336, 91, 286, 12), "P(0)=|alpha|^2  P(1)=|beta|^2 (amplitude squared)", smallStyle, Muted);
            Text(new Rect(336, 106, 286, 27), AsciiQuantumText(station.Hint), smallStyle,
                station.CanInteract ? Paper : Muted);
        }

        private void Probability(Rect rect, string ket, double probability, Color color)
        {
            float value = double.IsNaN(probability) ? 0f : Mathf.Clamp01((float)probability);
            Text(new Rect(rect.x, rect.y, 65, rect.height), ket + " " + Mathf.RoundToInt(value * 100f) + "%",
                smallStyle, color);
            Fill(new Rect(rect.x + 66, rect.y + 4, 70, 6), new Color(0.2f, 0.23f, 0.32f));
            Fill(new Rect(rect.x + 66, rect.y + 4, Mathf.Round(70f * value), 6), color);
        }

        private void DrawIntro()
        {
            Modal(new Rect(90, 82, 460, 210), Pink);
            Text(new Rect(110, 98, 320, 14), "QURIOSITY / PROLOGUE", smallStyle, Pink);
            Text(new Rect(484, 98, 50, 14), (introPage + 1) + " / 3", smallStyle, Muted);
            Fill(new Rect(110, 224, 146, 2), new Color(0.29f, 0.32f, 0.45f));
            string title;
            string story;
            if (introPage == 0)
            {
                DrawSprite(new Rect(118, 160, 64, 64), fleabagArt);
                DrawSprite(new Rect(202, 192, 32, 32), catArt);
                title = "Fleabag & Hilary";
                story = "A quiet evening. A pink-haired girl.\nOne very good cat named Hilary.";
                Text(new Rect(116, 230, 140, 14), "Fleabag + Hilary", smallStyle, Muted);
            }
            else if (introPage == 1)
            {
                DrawSprite(new Rect(118, 160, 64, 64), villainArt);
                DrawSprite(new Rect(194, 192, 48, 32), boxArt);
                DrawSprite(new Rect(202, 173, 32, 32), catArt);
                title = "A cat. A box. A bad idea.";
                story = "Schrodinger kidnaps Hilary in a box.\nFleabag is not letting this slide.";
                Text(new Rect(116, 230, 140, 14), "Schrodinger + the box", smallStyle, Muted);
            }
            else
            {
                DrawSprite(new Rect(118, 160, 64, 64), fleabagArt);
                DrawSprite(new Rect(194, 192, 48, 32), boxArt);
                Text(new Rect(186, 166, 64, 18), "> > >", titleStyle, Teal);
                title = "Go get your cat.";
                story = "Follow him through the observatory.\nPrepare a qubit. Measure a way forward.";
                Text(new Rect(116, 230, 140, 14), "The chase begins", smallStyle, Muted);
            }

            Text(new Rect(276, 130, 254, 52), title, headingStyle, Paper);
            Text(new Rect(276, 190, 254, 49), story, bodyStyle, Paper);
            Text(new Rect(110, 261, 214, 16), "Click or Enter / E / Space / South", smallStyle, Muted);
            string action = introPage == 2 ? "Chase Hilary" : "Next";
            if (Button(new Rect(340, 253, 190, 26), action, Pink, CanAcceptModalInput()))
            {
                AdvanceIntro();
            }
        }

        private void DrawPause()
        {
            Modal(new Rect(144, 102, 352, 156), Lilac);
            Text(new Rect(164, 119, 312, 28), "Take a breath.", headingStyle, Paper);
            Text(new Rect(164, 153, 312, 32), "Movement and console input are paused.\nStory visuals keep running; R still respawns.", bodyStyle, Muted);
            if (Button(new Rect(164, 207, 150, 28), "Resume [Esc / Start]", Lilac, CanAcceptModalInput()))
            {
                SetPaused(false);
            }

            if (Button(new Rect(326, 207, 150, 28), "Respawn checkpoint", Teal,
                CanAcceptModalInput() && respawn != null))
            {
                respawn.Respawn();
            }
        }

        private void DrawCompletion()
        {
            Modal(new Rect(108, 88, 424, 194), Teal);
            Text(new Rect(128, 105, 384, 14), isTemplate ? "MOVEMENT TEMPLATE COMPLETE" : "DEMO COMPLETE", smallStyle, Teal);
            Text(new Rect(128, 128, 384, 28), "Hilary is still ahead.", headingStyle, Paper);
            string message = isTemplate
                ? "You explored a safe movement graybox, not a finished quantum puzzle. The rescue continues beyond this demo."
                : "You prepared a superposition and measured one solid route. Schrodinger escaped with Hilary. The rescue continues beyond this demo.";
            Text(new Rect(128, 166, 384, 48), message, bodyStyle, Paper);
            bool ready = CanAcceptModalInput() && !loadingScene;
            if (Button(new Rect(128, 230, 166, 28), "Retry [Enter / South]", Teal, ready))
            {
                RestartRoom();
            }

            if (!string.IsNullOrEmpty(nextTemplate)
                && Button(new Rect(306, 230, 206, 28),
                    gamepadHints ? "Explore next template [West]" : "Explore next template [N]", Lilac, ready))
            {
                LoadRoom(nextTemplate);
            }

            if (!string.IsNullOrEmpty(navigationNotice))
            {
                Panel(new Rect(108, 288, 424, 39), Pink);
                Text(new Rect(118, 294, 404, 28), navigationNotice, bodyStyle, Paper);
            }
        }

        private Rect ScreenRect(Rect logical)
        {
            return new Rect(viewOrigin.x + logical.x * viewScale, viewOrigin.y + logical.y * viewScale,
                logical.width * viewScale, logical.height * viewScale);
        }

        private void Fill(Rect rect, Color color)
        {
            GUI.color = color;
            GUI.DrawTexture(ScreenRect(rect), Texture2D.whiteTexture);
            GUI.color = Color.white;
        }

        private void Panel(Rect rect, Color accent)
        {
            Fill(rect, PanelColor);
            Fill(new Rect(rect.x, rect.y, 2, rect.height), accent);
        }

        private void Modal(Rect rect, Color accent)
        {
            Fill(new Rect(0, 0, ViewWidth, ViewHeight), new Color(0.01f, 0.015f, 0.04f, 0.76f));
            Fill(new Rect(rect.x + 3, rect.y + 4, rect.width, rect.height), new Color(0f, 0f, 0f, 0.5f));
            Panel(rect, accent);
        }

        private void Text(Rect rect, string text, GUIStyle style, Color color)
        {
            GUI.color = color;
            GUI.Label(ScreenRect(rect), text ?? string.Empty, style);
            GUI.color = Color.white;
        }

        private bool Button(Rect rect, string text, Color accent, bool enabled)
        {
            GUI.enabled = enabled;
            GUI.backgroundColor = accent;
            EventType eventType = Event.current.type;
            bool clicked = GUI.Button(ScreenRect(rect), text, buttonStyle);
            GUI.enabled = true;
            GUI.backgroundColor = Color.white;
            // Keys are polled once in Update. A focused IMGUI button must not
            // also advance on KeyUp after the same key already advanced on KeyDown.
            return clicked && eventType == EventType.MouseUp;
        }

        private void DrawSprite(Rect area, Sprite sprite)
        {
            if (sprite == null || sprite.texture == null)
            {
                return;
            }

            Rect pixels = sprite.textureRect;
            float scale = Mathf.Min(area.width / pixels.width, area.height / pixels.height);
            if (scale >= 1f)
            {
                scale = Mathf.Floor(scale);
            }

            float width = pixels.width * scale;
            float height = pixels.height * scale;
            var destination = new Rect(Mathf.Round(area.center.x - width * 0.5f),
                Mathf.Round(area.yMax - height), width, height);
            var uv = new Rect(pixels.x / sprite.texture.width, pixels.y / sprite.texture.height,
                pixels.width / sprite.texture.width, pixels.height / sprite.texture.height);
            GUI.DrawTextureWithTexCoords(ScreenRect(destination), sprite.texture, uv, true);
        }

        private static string AsciiQuantumText(string text)
        {
            // LegacyRuntime is reliable for ASCII even on platforms with limited
            // glyph fallback; the station may choose conventional quantum symbols.
            return string.IsNullOrEmpty(text) ? string.Empty : text.Replace("\u03c8", "psi")
                .Replace("\u03b1", "alpha").Replace("\u03b2", "beta")
                .Replace("\u27e9", ">").Replace("\u232a", ">").Replace("\u221a", "sqrt")
                .Replace("\u00b2", "^2").Replace("\u2192", "->").Replace("\u2013", "-")
                .Replace("\u2014", "-");
        }
    }
}
