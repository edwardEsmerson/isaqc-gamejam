using System;
using System.Collections.Generic;
using System.IO;
using Quriosity.Gameplay;
using Quriosity.Quantum;
using Quriosity.UI;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Tilemaps;
using UnityEngine.U2D;
using Object = UnityEngine.Object;

namespace Quriosity.Editor
{
    /// <summary>
    /// One-time authoring tool, not a runtime level generator. The resulting
    /// scenes, linked prefabs, Tile assets and Tile Palette are ordinary assets.
    /// Re-running only fills missing assets; it never replaces an existing room.
    /// </summary>
    [InitializeOnLoad]
    public static class DemoProjectBuilder
    {
        private const string ArtRoot = "Assets/Art/Generated/Demo/";
        private const string TileRoot = "Assets/Tiles/Demo/";
        private const string PrefabRoot = "Assets/Prefabs/Demo/";
        private const string DemoScene = "Assets/Scenes/01-the-box.unity";
        private const float PlayerStandingOffset = 0.8125f;
        private static readonly Color Teal = new Color(0.55f, 0.9f, 0.85f);
        private static readonly Color Lilac = new Color(0.8f, 0.7f, 0.95f);
        private static readonly string[] ScenePaths =
        {
            DemoScene,
            "Assets/Scenes/02-linked-rooms.unity",
            "Assets/Scenes/03-phase-laboratory.unity",
            "Assets/Scenes/04-schrodingers-hideout.unity"
        };

        // Rectangles are integer tile coordinates. A top of 5 is a walkable
        // surface at world Y=5, not the center of its uppermost tile.
        private static readonly RectInt[] DemoPlatforms =
        {
            new RectInt(1, 1, 9, 2),      // Walk: surface 3, right edge 10.
            new RectInt(12, 4, 4, 1),    // Jump: 2-unit gap and 2-unit rise.
            new RectInt(20, 5, 6, 2),    // Jump + dash: 4-unit gap and 2-unit rise.
            new RectInt(36, 9, 4, 2)     // Exit: unreachable without a measured route.
        };
        private static readonly RectInt[] ZeroPlatforms =
        {
            new RectInt(29, 6, 3, 1),
            new RectInt(34, 8, 2, 1)
        };
        private static readonly RectInt[] OnePlatforms =
        {
            new RectInt(27, 8, 3, 1),
            new RectInt(32, 10, 2, 1)
        };
        private static readonly RectInt[][] TemplatePlatforms =
        {
            new[]
            {
                new RectInt(1, 1, 39, 2), new RectInt(6, 4, 4, 1),
                new RectInt(12, 6, 5, 1), new RectInt(19, 6, 5, 1),
                new RectInt(26, 8, 4, 1), new RectInt(32, 9, 8, 2)
            },
            new[]
            {
                new RectInt(1, 1, 39, 2), new RectInt(4, 4, 5, 1),
                new RectInt(11, 6, 5, 1), new RectInt(18, 8, 5, 1),
                new RectInt(25, 10, 5, 1), new RectInt(32, 11, 8, 2)
            },
            new[]
            {
                new RectInt(1, 1, 39, 2), new RectInt(7, 4, 4, 1),
                new RectInt(13, 6, 4, 1), new RectInt(19, 8, 4, 1),
                new RectInt(25, 10, 4, 1), new RectInt(31, 11, 9, 2)
            }
        };

        static DemoProjectBuilder()
        {
            // Never rebuild on domain reload once the demo exists. Batch mode
            // must explicitly invoke BuildFromCommandLine for predictable CI.
            if (!Application.isBatchMode && !File.Exists(DemoScene))
            {
                EditorApplication.delayCall += BuildOnFirstImport;
            }
        }

        private static void BuildOnFirstImport()
        {
            if (File.Exists(DemoScene) || EditorApplication.isPlayingOrWillChangePlaymode)
            {
                return;
            }

            if (EditorApplication.isCompiling || EditorApplication.isUpdating)
            {
                EditorApplication.delayCall += BuildOnFirstImport;
                return;
            }

            try
            {
                BuildProject(true);
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                Debug.LogError("Quriosity setup stopped safely. Fix the reported issue, then run "
                    + "Quriosity/Build Demo and Level Templates. Existing assets are preserved.");
            }
        }

        [MenuItem("Quriosity/Build Demo and Level Templates")]
        public static void BuildFromMenu()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                Debug.LogWarning("Leave Play Mode before creating editable demo assets.");
                return;
            }

            if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
            {
                BuildProject(true);
            }
        }

        // Unity -batchmode -projectPath unity -executeMethod
        // Quriosity.Editor.DemoProjectBuilder.BuildFromCommandLine -quit
        public static void BuildFromCommandLine()
        {
            // Batch mode starts with an untitled scene, and Unity cannot add a
            // second scene until the bootstrap scene has a saved asset path.
            const string bootstrapPath = "Assets/Scenes/__builder-bootstrap.unity";
            Scene bootstrap = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            if (!EditorSceneManager.SaveScene(bootstrap, bootstrapPath))
            {
                throw new InvalidOperationException("Could not save the temporary batch scene.");
            }

            try
            {
                BuildProject(false);
                VerifySavedAssets();
            }
            finally
            {
                // Close the temporary scene before deleting its asset. The
                // generated demo/template scenes are separate saved assets.
                EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                AssetDatabase.DeleteAsset(bootstrapPath);
                AssetDatabase.Refresh();
            }
        }

        private static void BuildProject(bool openDemo)
        {
            // Fail before creating anything if the local art has not been generated.
            RequireSprite("Backgrounds/observatory-night");
            ValidateAuthoredRoutes();
            EnsureFolder("Assets/Editor");
            EnsureFolder("Assets/Scenes");
            EnsureFolder(TileRoot.TrimEnd('/'));
            EnsureFolder(PrefabRoot.TrimEnd('/'));

            int createdScenes = 0;
            Scene previousActive = SceneManager.GetActiveScene();
            Dictionary<string, Tile> tiles;
            // Temporary prefab objects must never be created in the teammate's
            // active scene, even briefly. A disposable additive scene isolates them.
            Scene scratch = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Additive);
            SceneManager.SetActiveScene(scratch);
            try
            {
                tiles = CreateTiles();
                CreatePalette(tiles);
                CreateSharedPrefabs();
            }
            finally
            {
                EditorSceneManager.CloseScene(scratch, true);
                if (previousActive.IsValid() && previousActive.isLoaded)
                {
                    SceneManager.SetActiveScene(previousActive);
                }
            }

            try
            {
                for (int index = 0; index < ScenePaths.Length; index++)
                {
                    if (File.Exists(ScenePaths[index]))
                    {
                        continue;
                    }

                    Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Additive);
                    SceneManager.SetActiveScene(scene);
                    try
                    {
                        CreateRoom(index, tiles);
                        if (!EditorSceneManager.SaveScene(scene, ScenePaths[index]))
                        {
                            throw new InvalidOperationException("Could not save " + ScenePaths[index]);
                        }

                        createdScenes++;
                    }
                    finally
                    {
                        EditorSceneManager.CloseScene(scene, true);
                    }
                }
            }
            finally
            {
                // New rooms are authored additively so the current scene is not
                // destroyed if an exception or missing component interrupts setup.
                if (previousActive.IsValid() && previousActive.isLoaded)
                {
                    SceneManager.SetActiveScene(previousActive);
                }
            }

            AddScenesToBuildSettings();
            AssetDatabase.SaveAssets();
            bool hasUnsavedScene = false;
            for (int i = 0; i < SceneManager.sceneCount; i++)
            {
                hasUnsavedScene |= SceneManager.GetSceneAt(i).isDirty;
            }

            if (openDemo && createdScenes > 0 && !hasUnsavedScene)
            {
                EditorSceneManager.OpenScene(DemoScene, OpenSceneMode.Single);
                Selection.activeObject = GameObject.Find("World / paintable terrain");
                if (SceneView.lastActiveSceneView != null)
                {
                    SceneView.lastActiveSceneView.in2DMode = true;
                    SceneView.lastActiveSceneView.LookAt(new Vector3(20f, 11.25f, 0f),
                        Quaternion.identity, 24f, true, true);
                }
            }
            else if (openDemo && createdScenes > 0)
            {
                Debug.Log("Quriosity created the editable rooms without closing your unsaved scene. "
                    + "Open Assets/Scenes/01-the-box.unity when you are ready to play.");
            }

            Debug.Log($"Quriosity scaffold ready: {createdScenes} new scene(s). Existing scenes, "
                + "prefabs and tiles were not replaced. Paint terrain using Assets/Tiles/Demo/Demo Palette.prefab.");
        }

        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path))
            {
                return;
            }

            string parent = Path.GetDirectoryName(path).Replace('\\', '/');
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }

        private static Sprite RequireSprite(string name)
        {
            string path = ArtRoot + name + ".png";
            Sprite sprite = AssetDatabase.LoadAssetAtPath<Sprite>(path);
            if (sprite == null)
            {
                throw new InvalidOperationException("Missing sprite: " + path
                    + ". Run python3 scripts/generate-demo-art.py, then let Unity finish importing.");
            }

            return sprite;
        }

        private static Dictionary<string, Tile> CreateTiles()
        {
            var tiles = new Dictionary<string, Tile>();
            foreach (string name in new[]
            {
                "stone-fill", "stone-top", "stone-left", "stone-right", "stone-single",
                "bridge-zero", "bridge-one"
            })
            {
                string path = TileRoot + name + ".asset";
                Tile tile = AssetDatabase.LoadAssetAtPath<Tile>(path);
                if (tile == null)
                {
                    RequireUnusedPath(path);
                    tile = ScriptableObject.CreateInstance<Tile>();
                    tile.name = name;
                    tile.sprite = RequireSprite("Tiles/" + name);
                    tile.colliderType = Tile.ColliderType.Grid;
                    AssetDatabase.CreateAsset(tile, path);
                }

                tiles.Add(name, tile);
            }

            return tiles;
        }

        private static void CreatePalette(Dictionary<string, Tile> tiles)
        {
            string path = TileRoot + "Demo Palette.prefab";
            if (File.Exists(path))
            {
                return;
            }

            var root = new GameObject("Demo Palette", typeof(Grid));
            try
            {
                root.GetComponent<Grid>().cellSize = Vector3.one;
                Tilemap map = CreateTilemap(root.transform, "Authored stone and quantum tiles", false);
                int x = 0;
                foreach (Tile tile in tiles.Values)
                {
                    map.SetTile(new Vector3Int(x++, 0, 0), tile);
                }

                PrefabUtility.SaveAsPrefabAsset(root, path);
                var settings = ScriptableObject.CreateInstance<GridPalette>();
                settings.name = "Palette Settings";
                settings.cellSizing = GridPalette.CellSizing.Manual;
                AssetDatabase.AddObjectToAsset(settings, path);
                AssetDatabase.ImportAsset(path);
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        private static void CreateSharedPrefabs()
        {
            SavePrefabIfMissing("fleabag", () =>
            {
                var root = new GameObject("Fleabag", typeof(Rigidbody2D), typeof(CapsuleCollider2D));
                var body = root.GetComponent<Rigidbody2D>();
                body.bodyType = RigidbodyType2D.Dynamic;
                body.constraints = RigidbodyConstraints2D.FreezeRotation;
                body.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
                body.interpolation = RigidbodyInterpolation2D.Interpolate;
                var capsule = root.GetComponent<CapsuleCollider2D>();
                capsule.direction = CapsuleDirection2D.Vertical;
                capsule.size = new Vector2(0.625f, 1.375f);
                capsule.offset = new Vector2(0f, -0.0625f);
                SpriteRenderer visual = AddSprite(root.transform, "Animated pixel art",
                    "Characters/fleabag-idle-0", new Vector2(0f, -0.125f), 20);
                var idle = new Sprite[4];
                var run = new Sprite[6];
                for (int i = 0; i < idle.Length; i++)
                {
                    idle[i] = RequireSprite("Characters/fleabag-idle-" + i);
                }

                for (int i = 0; i < run.Length; i++)
                {
                    run[i] = RequireSprite("Characters/fleabag-run-" + i);
                }

                root.AddComponent<PlayerController>().ConfigureVisuals(visual, idle, run,
                    RequireSprite("Characters/fleabag-jump"), RequireSprite("Characters/fleabag-dash"));
                visual.sprite = idle[0];
                // Awake captures the placed scene instance's position, not prefab origin.
                root.AddComponent<PlayerRespawn>();
                return root;
            });
            SavePrefabIfMissing("checkpoint", () =>
            {
                var root = new GameObject("Checkpoint");
                AddSprite(root.transform, "Flag and stone plinth", "Props/checkpoint", Vector2.up, 10);
                AddTrigger(root, new Vector2(1.5f, 1.75f), new Vector2(0f, 0.875f));
                var spawn = new GameObject("Safe respawn position");
                spawn.transform.SetParent(root.transform, false);
                spawn.transform.localPosition = new Vector3(0.8f, PlayerStandingOffset, 0f);
                root.AddComponent<Checkpoint>().Configure(spawn.transform);
                return root;
            });
            SavePrefabIfMissing("hazard-spikes", () =>
            {
                var root = new GameObject("Spikes / trigger, not a solid platform");
                AddSprite(root.transform, "Spikes", "Props/spikes", new Vector2(0f, 0.5f), 5);
                AddTrigger(root, new Vector2(0.875f, 0.4f), new Vector2(0f, 0.2f));
                root.AddComponent<Hazard>();
                return root;
            });
            SavePrefabIfMissing("exit-door", () =>
            {
                var root = new GameObject("Exit");
                AddSprite(root.transform, "Observatory door", "Props/exit-door", new Vector2(0f, 1.5f), 8);
                AddTrigger(root, new Vector2(1.25f, 2.5f), new Vector2(0f, 1.25f));
                root.AddComponent<LevelExit>().NextSceneName = string.Empty;
                return root;
            });
            SavePrefabIfMissing("quantum-console", () =>
            {
                var root = new GameObject("Quantum console / configure scene route references");
                AddSprite(root.transform, "Console", "Props/quantum-console", new Vector2(0f, 0.75f), 9);
                root.AddComponent<QuantumStation>();
                return root;
            });
            SavePrefabIfMissing("hilary-in-box", () =>
            {
                var root = new GameObject("Hilary in the box / story prop");
                AddSprite(root.transform, "Box", "Props/hilary-box", new Vector2(0f, 0.625f), 8);
                AddSprite(root.transform, "Hilary", "Characters/hilary", new Vector2(0f, 1.125f), 9);
                return root;
            });
            SavePrefabIfMissing("schrodinger", () =>
            {
                // The story HUD can find the named object and its renderer
                // directly. This sprite-centered prefab is placed one unit up.
                var root = new GameObject("Schrodinger", typeof(SpriteRenderer));
                var renderer = root.GetComponent<SpriteRenderer>();
                renderer.sprite = RequireSprite("Characters/schrodinger");
                renderer.sortingOrder = 12;
                return root;
            });
        }

        private static void SavePrefabIfMissing(string name, Func<GameObject> create)
        {
            string path = PrefabRoot + name + ".prefab";
            if (File.Exists(path))
            {
                return;
            }

            GameObject root = create();
            try
            {
                if (PrefabUtility.SaveAsPrefabAsset(root, path) == null)
                {
                    throw new InvalidOperationException("Could not save prefab " + path);
                }
            }
            finally
            {
                Object.DestroyImmediate(root);
            }
        }

        private static void RequireUnusedPath(string path)
        {
            if (File.Exists(path))
            {
                throw new InvalidOperationException("An incompatible existing asset occupies " + path
                    + ". It was not replaced. Move it explicitly if you want setup to use this path.");
            }
        }

        private static BoxCollider2D AddTrigger(GameObject root, Vector2 size, Vector2 offset)
        {
            var trigger = root.AddComponent<BoxCollider2D>();
            trigger.isTrigger = true;
            trigger.size = size;
            trigger.offset = offset;
            return trigger;
        }

        private static SpriteRenderer AddSprite(Transform parent, string name, string sprite,
            Vector2 position, int order, Color? tint = null)
        {
            var root = new GameObject(name, typeof(SpriteRenderer));
            root.transform.SetParent(parent, false);
            root.transform.localPosition = new Vector3(position.x, position.y, 0f);
            var renderer = root.GetComponent<SpriteRenderer>();
            renderer.sprite = RequireSprite(sprite);
            renderer.sortingOrder = order;
            renderer.color = tint ?? Color.white;
            return renderer;
        }

        private static GameObject InstantiatePrefab(string name, Transform parent, Vector2 position)
        {
            string path = PrefabRoot + name + ".prefab";
            GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null)
            {
                throw new InvalidOperationException("Missing prefab " + path);
            }

            var instance = (GameObject)PrefabUtility.InstantiatePrefab(prefab, parent);
            instance.transform.position = new Vector3(position.x, position.y, 0f);
            PrefabUtility.RecordPrefabInstancePropertyModifications(instance.transform);
            return instance;
        }

        private static void CreateRoom(int index, Dictionary<string, Tile> tiles)
        {
            CreateCamera();
            CreateBackground();
            var world = new GameObject("World / paintable terrain", typeof(Grid));
            world.GetComponent<Grid>().cellSize = Vector3.one;
            Tilemap terrain = CreateTilemap(world.transform, "Terrain / paint solid tiles here", true);
            RectInt[] platforms = index == 0 ? DemoPlatforms : TemplatePlatforms[index - 1];
            foreach (RectInt platform in platforms)
            {
                PaintPlatform(terrain, tiles, platform);
            }

            if (index != 0)
            {
                terrain.color = new Color(0.72f, 0.81f, 0.87f);
            }

            terrain.GetComponent<TilemapCollider2D>().ProcessTilemapChanges();
            terrain.GetComponent<CompositeCollider2D>().GenerateGeometry();
            CreateRoomBounds();
            var actors = new GameObject("Actors / linked shared prefabs");
            PlayerController player = InstantiatePrefab("fleabag", actors.transform,
                new Vector2(3f, 3f + PlayerStandingOffset)).GetComponent<PlayerController>();
            player.name = "Fleabag";
            PrefabUtility.RecordPrefabInstancePropertyModifications(player.gameObject);
            RectInt last = platforms[platforms.Length - 1];
            float exitSurface = last.yMax;
            var exit = InstantiatePrefab("exit-door", actors.transform,
                new Vector2(38.65f, exitSurface)).GetComponent<LevelExit>();
            // Completion remains in this scene. Teammates can set NextSceneName
            // in the normal LevelExit Inspector when they implement the campaign.
            exit.NextSceneName = string.Empty;
            exit.IsLocked = false;
            PrefabUtility.RecordPrefabInstancePropertyModifications(exit);
            GameObject villain = InstantiatePrefab("schrodinger", actors.transform,
                new Vector2(37.4f, exitSurface + 1f));
            villain.name = "Schrodinger";
            PrefabUtility.RecordPrefabInstancePropertyModifications(villain);
            // Keep the story props together if the HUD makes the kidnapper depart.
            InstantiatePrefab("hilary-in-box", villain.transform, new Vector2(36.75f, exitSurface + 0.0625f));

            QuantumStation station = null;
            if (index == 0)
            {
                InstantiatePrefab("checkpoint", actors.transform, new Vector2(21.25f, 7f));
                QuantumBridge zero = CreateBridge("Outcome 0 / lower teal route", "bridge-zero",
                    ZeroPlatforms, world.transform);
                QuantumBridge one = CreateBridge("Outcome 1 / upper lilac route", "bridge-one",
                    OnePlatforms, world.transform);
                station = InstantiatePrefab("quantum-console", actors.transform,
                    new Vector2(24f, 7f)).GetComponent<QuantumStation>();
                station.Configure(player, zero, one);
                PrefabUtility.RecordPrefabInstancePropertyModifications(station);
                zero.SetAvailable(false);
                one.SetAvailable(false);
                CreateDemoSigns();
                CreateSpikes(actors.transform, 10, 39);
            }
            else
            {
                RectInt checkpointPlatform = platforms[3];
                InstantiatePrefab("checkpoint", actors.transform,
                    new Vector2(checkpointPlatform.x + 1f, checkpointPlatform.yMax));
                CreateTemplateConceptProps(index);
            }

            CreateRoomDecorations(platforms);
            var hud = new GameObject("HUD / story, controls and quantum readout").AddComponent<DemoHud>();
            string[] titles = { "01 / THE BOX", "02 / LINKED ROOMS", "03 / PHASE LABORATORY", "04 / SCHRODINGER'S HIDEOUT" };
            string[] goals =
            {
                "Prepare a superposition. Measure one of two safe routes. Follow Hilary.",
                "Intended concept: entangled outcomes. Movement template only; puzzle not implemented.",
                "Intended concept: phase and interference. Movement template only; puzzle not implemented.",
                "Intended concept: combine quantum rules. Movement template only; puzzle not implemented."
            };
            hud.Configure(player, station, titles[index], goals[index], index == 0, index != 0);
            hud.ConfigureStoryArt(RequireSprite("Characters/fleabag-idle-0"), RequireSprite("Characters/hilary"),
                RequireSprite("Characters/schrodinger"), RequireSprite("Props/hilary-box"));
        }

        private static void CreateCamera()
        {
            var root = new GameObject("Main Camera / fixed whole-room 640 x 360", typeof(Camera));
            root.tag = "MainCamera";
            root.transform.position = new Vector3(20f, 11.25f, -10f);
            Camera camera = root.GetComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 11.25f;
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 100f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.04f, 0.05f, 0.1f);
            camera.allowHDR = false;
            camera.allowMSAA = false;
            root.AddComponent<AudioListener>();
            var pixels = root.AddComponent<PixelPerfectCamera>();
            pixels.assetsPPU = 16;
            pixels.refResolutionX = 640;
            pixels.refResolutionY = 360;
            pixels.upscaleRT = true;
            pixels.cropFrameX = true;
            pixels.cropFrameY = true;
            pixels.stretchFill = false;
        }

        private static void CreateBackground()
        {
            var background = new GameObject("Backdrop / original observatory pixel architecture");
            AddSprite(background.transform, "Night observatory / no collision", "Backgrounds/observatory-night",
                new Vector2(20f, 11.25f), -100);
        }

        private static Tilemap CreateTilemap(Transform parent, string name, bool collision)
        {
            var root = new GameObject(name, typeof(Tilemap), typeof(TilemapRenderer));
            root.transform.SetParent(parent, false);
            var tilemap = root.GetComponent<Tilemap>();
            tilemap.tileAnchor = new Vector3(0.5f, 0.5f, 0f);
            root.GetComponent<TilemapRenderer>().sortingOrder = 0;
            if (collision)
            {
                root.AddComponent<Rigidbody2D>().bodyType = RigidbodyType2D.Static;
                var composite = root.AddComponent<CompositeCollider2D>();
                composite.geometryType = CompositeCollider2D.GeometryType.Polygons;
                composite.generationType = CompositeCollider2D.GenerationType.Synchronous;
                composite.vertexDistance = 0.01f;
                var collider = root.AddComponent<TilemapCollider2D>();
                collider.compositeOperation = Collider2D.CompositeOperation.Merge;
            }

            return tilemap;
        }

        private static void PaintPlatform(Tilemap map, Dictionary<string, Tile> tiles, RectInt rectangle)
        {
            for (int y = rectangle.yMin; y < rectangle.yMax; y++)
            {
                for (int x = rectangle.xMin; x < rectangle.xMax; x++)
                {
                    string tile = "stone-fill";
                    if (y == rectangle.yMax - 1)
                    {
                        tile = rectangle.width == 1 ? "stone-single"
                            : x == rectangle.xMin ? "stone-left"
                            : x == rectangle.xMax - 1 ? "stone-right" : "stone-top";
                    }

                    map.SetTile(new Vector3Int(x, y, 0), tiles[tile]);
                }
            }
        }

        private static QuantumBridge CreateBridge(string name, string spriteName, RectInt[] platforms, Transform parent)
        {
            var root = new GameObject(name);
            root.transform.SetParent(parent, false);
            foreach (RectInt platform in platforms)
            {
                var landing = new GameObject($"Landing / x {platform.xMin}-{platform.xMax}, surface {platform.yMax}");
                landing.transform.SetParent(root.transform, false);
                landing.transform.localPosition = new Vector3(platform.x + platform.width * 0.5f,
                    platform.y + platform.height * 0.5f, 0f);
                var collider = landing.AddComponent<BoxCollider2D>();
                collider.size = new Vector2(platform.width, platform.height);
                for (int x = 0; x < platform.width; x++)
                {
                    AddSprite(landing.transform, "Quantum tile " + x, "Tiles/" + spriteName,
                        new Vector2(x - platform.width * 0.5f + 0.5f, 0f), 2);
                }
            }

            // Add after the children exist: auto-discovery can find all art and colliders.
            return root.AddComponent<QuantumBridge>();
        }

        private static void CreateRoomBounds()
        {
            var root = new GameObject("Safety / room edges and fall respawn");
            foreach (float x in new[] { -0.5f, 40.5f })
            {
                var wall = new GameObject("Invisible room edge", typeof(BoxCollider2D));
                wall.transform.SetParent(root.transform, false);
                wall.transform.localPosition = new Vector3(x, 11.25f, 0f);
                wall.GetComponent<BoxCollider2D>().size = new Vector2(1f, 25f);
            }

            var fall = new GameObject("Fall zone / always respawn, never trap", typeof(BoxCollider2D), typeof(Hazard));
            fall.transform.SetParent(root.transform, false);
            fall.transform.localPosition = new Vector3(20f, -1f, 0f);
            var trigger = fall.GetComponent<BoxCollider2D>();
            trigger.isTrigger = true;
            trigger.size = new Vector2(44f, 2f);
        }

        private static void CreateSpikes(Transform parent, int from, int to)
        {
            var spikes = new GameObject("Pit / reusable spike prefabs");
            spikes.transform.SetParent(parent, false);
            for (int x = from; x < to; x++)
            {
                InstantiatePrefab("hazard-spikes", spikes.transform, new Vector2(x + 0.5f, 0.875f));
            }
        }

        private static void CreateRoomDecorations(RectInt[] platforms)
        {
            var root = new GameObject("Decorations / no collision, freely movable");
            foreach (RectInt platform in platforms)
            {
                if (platform.width >= 4)
                {
                    AddSprite(root.transform, "Fern", "Decor/fern", new Vector2(platform.x + 0.625f, platform.yMax + 0.5f), 4);
                }

                if (platform.yMin > 3)
                {
                    AddSprite(root.transform, "Hanging lantern", "Decor/lantern",
                        new Vector2(platform.x + platform.width * 0.5f, platform.yMin - 0.75f), -5);
                }
            }

            AddSprite(root.transform, "Old arch / decorative", "Decor/stone-arch", new Vector2(5.75f, 7.5f), -10,
                new Color(0.48f, 0.56f, 0.68f));
            AddSprite(root.transform, "Upper observatory arch / decorative", "Decor/stone-arch", new Vector2(22f, 15f), -10,
                new Color(0.38f, 0.43f, 0.62f));
            AddSprite(root.transform, "Console particles / decorative", "Decor/quantum-motes", new Vector2(25f, 9.5f), -2);
        }

        private static void CreateDemoSigns()
        {
            var root = new GameObject("Teaching signs / editable TextMesh objects");
            AddLabel(root.transform, "WALK + JUMP", new Vector2(5.5f, 5.3f), Teal);
            AddLabel(root.transform, "HOLD JUMP, THEN DASH", new Vector2(17.5f, 9.9f), Teal);
            AddLabel(root.transform, "CHECKPOINT", new Vector2(21.25f, 10f), Teal, 0.07f);
            AddLabel(root.transform, "E: PREPARE / MEASURE / RESET", new Vector2(24f, 5.2f), Teal, 0.075f);
            AddLabel(root.transform, "0", new Vector2(30.5f, 8.35f), Teal, 0.15f);
            AddLabel(root.transform, "1", new Vector2(28.5f, 10.35f), Lilac, 0.15f);
            AddLabel(root.transform, "BOTH OUTCOMES LEAD HERE", new Vector2(35.5f, 15.1f), Lilac, 0.08f);
        }

        private static void CreateTemplateConceptProps(int index)
        {
            var root = new GameObject("Concept placeholders / art only, no quantum logic");
            string[] concepts = { "", "LINKED OUTCOMES", "PHASE + INTERFERENCE", "COMBINE QUANTUM RULES" };
            AddLabel(root.transform, "EDITABLE TEMPLATE / " + concepts[index], new Vector2(20f, 18.5f), Lilac, 0.13f);
            AddLabel(root.transform, "INTENDED CONCEPT ONLY - PUZZLE NOT IMPLEMENTED", new Vector2(20f, 17.5f), Teal, 0.09f);
            AddLabel(root.transform, "SAFE MOVEMENT ROUTE TO THE EXIT", new Vector2(20f, 16.5f), Teal, 0.09f);
            if (index == 1)
            {
                AddSprite(root.transform, "Linked console A / art only", "Props/quantum-console", new Vector2(14f, 7.75f), 9);
                AddSprite(root.transform, "Linked console B / art only", "Props/quantum-console", new Vector2(22f, 7.75f), 9);
                AddLabel(root.transform, "A", new Vector2(14f, 9.4f), Teal);
                AddLabel(root.transform, "B", new Vector2(22f, 9.4f), Lilac);
            }
            else if (index == 2)
            {
                AddSprite(root.transform, "Phase console / art only", "Props/quantum-console", new Vector2(20f, 9.75f), 9);
                AddSprite(root.transform, "Interference motif / art only", "Decor/quantum-motes", new Vector2(27.5f, 13f), 9);
            }
            else
            {
                AddSprite(root.transform, "Final console / art only", "Props/quantum-console", new Vector2(27f, 11.75f), 9);
            }
        }

        private static void AddLabel(Transform parent, string text, Vector2 position, Color color, float size = 0.1f)
        {
            var root = new GameObject(text, typeof(TextMesh));
            root.transform.SetParent(parent, false);
            root.transform.localPosition = new Vector3(position.x, position.y, 0f);
            var label = root.GetComponent<TextMesh>();
            label.text = text;
            label.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            label.fontSize = 48;
            label.characterSize = size;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.color = color;
            var renderer = root.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = label.font.material;
            renderer.sortingOrder = 30;
        }

        private static void AddScenesToBuildSettings()
        {
            var scenes = new List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            foreach (string path in ScenePaths)
            {
                int index = scenes.FindIndex(scene => scene.path == path);
                if (index < 0)
                {
                    scenes.Add(new EditorBuildSettingsScene(path, true));
                }
            }

            EditorBuildSettings.scenes = scenes.ToArray();
        }

        private static void ValidateAuthoredRoutes()
        {
            // Conservative geometric authoring guard, not a substitute for a
            // Unity playthrough: regular jumps span ~4 units at equal elevation
            // and rise at most 2.5. The practice gap intentionally uses a dash.
            ValidateStep(DemoPlatforms[0], DemoPlatforms[1], false);
            ValidateStep(DemoPlatforms[1], DemoPlatforms[2], true);
            foreach (RectInt[] route in new[] { ZeroPlatforms, OnePlatforms })
            {
                RectInt previous = DemoPlatforms[2];
                foreach (RectInt landing in route)
                {
                    ValidateStep(previous, landing, false);
                    previous = landing;
                }

                ValidateStep(previous, DemoPlatforms[3], false);
            }

            if (DemoPlatforms[3].xMin - DemoPlatforms[2].xMax <= 8)
            {
                throw new InvalidOperationException("The demo's exit must not bypass both quantum bridges.");
            }

            foreach (RectInt[] layout in TemplatePlatforms)
            {
                for (int i = 1; i < layout.Length; i++)
                {
                    ValidateStep(layout[i - 1], layout[i], false);
                }
            }
        }

        private static void ValidateStep(RectInt from, RectInt to, bool dashPractice)
        {
            int rise = to.yMax - from.yMax;
            int gap = Mathf.Max(0, to.xMin - from.xMax);
            int budget = dashPractice ? 5 : rise > 0 ? 2 : 3;
            if (rise > 2 || gap > budget)
            {
                throw new InvalidOperationException($"Unsafe authored step: {from} -> {to}, rise={rise}, gap={gap}.");
            }
        }

        [MenuItem("Quriosity/Verify Saved Demo Assets")]
        public static void VerifySavedAssets()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode)
            {
                throw new InvalidOperationException("Verify saved assets outside Play Mode.");
            }

            ValidateAuthoredRoutes();
            foreach (string assetGuid in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/Art/Generated/Demo" }))
            {
                string path = AssetDatabase.GUIDToAssetPath(assetGuid);
                var importer = (TextureImporter)AssetImporter.GetAtPath(path);
                if (importer.textureType != TextureImporterType.Sprite || importer.spritePixelsPerUnit != 16f
                    || importer.filterMode != FilterMode.Point || importer.mipmapEnabled
                    || importer.textureCompression != TextureImporterCompression.Uncompressed)
                {
                    throw new InvalidOperationException("Unexpected pixel-art import settings: " + path);
                }
            }

            foreach (string path in ScenePaths)
            {
                if (!File.Exists(path))
                {
                    throw new InvalidOperationException("Missing saved scene: " + path);
                }

                Scene scene = SceneManager.GetSceneByPath(path);
                bool alreadyOpen = scene.IsValid() && scene.isLoaded;
                if (!alreadyOpen)
                {
                    scene = EditorSceneManager.OpenScene(path, OpenSceneMode.Additive);
                }

                try
                {
                    VerifyScene(scene, path == DemoScene);
                }
                finally
                {
                    if (!alreadyOpen)
                    {
                        EditorSceneManager.CloseScene(scene, true);
                    }
                }
            }

            Debug.Log("Quriosity verification passed: four editable scenes, prefab links, collision tilemaps, "
                + "fixed pixel cameras, art import settings and both authored quantum routes. Playthrough still required.");
        }

        private static void VerifyScene(Scene scene, bool demo)
        {
            int players = 0;
            int exits = 0;
            int huds = 0;
            int bridges = 0;
            int stations = 0;
            int checkpoints = 0;
            int terrains = 0;
            int cameras = 0;
            foreach (GameObject root in scene.GetRootGameObjects())
            {
                foreach (Transform child in root.GetComponentsInChildren<Transform>(true))
                {
                    if (GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(child.gameObject) != 0)
                    {
                        throw new InvalidOperationException(scene.path + " has a missing script on " + child.name);
                    }
                }

                players += root.GetComponentsInChildren<PlayerController>(true).Length;
                exits += root.GetComponentsInChildren<LevelExit>(true).Length;
                huds += root.GetComponentsInChildren<DemoHud>(true).Length;
                bridges += root.GetComponentsInChildren<QuantumBridge>(true).Length;
                stations += root.GetComponentsInChildren<QuantumStation>(true).Length;
                checkpoints += root.GetComponentsInChildren<Checkpoint>(true).Length;
                foreach (QuantumStation station in root.GetComponentsInChildren<QuantumStation>(true))
                {
                    if (station.Player == null || station.ZeroBridge == null || station.OneBridge == null
                        || station.ZeroBridge == station.OneBridge || station.Player.gameObject.scene != scene
                        || station.ZeroBridge.gameObject.scene != scene || station.OneBridge.gameObject.scene != scene)
                    {
                        throw new InvalidOperationException(scene.path
                            + " needs a console linked to its player and two distinct scene-local routes.");
                    }
                }

                foreach (SpriteRenderer sprite in root.GetComponentsInChildren<SpriteRenderer>(true))
                {
                    if (sprite.sprite == null)
                    {
                        throw new InvalidOperationException(scene.path + " has a missing sprite on " + sprite.name);
                    }
                }

                foreach (PlayerController player in root.GetComponentsInChildren<PlayerController>(true))
                {
                    if (!PrefabUtility.IsPartOfPrefabInstance(player) || player.GetComponent<PlayerRespawn>() == null
                        || player.GetComponent<Collider2D>() == null || player.GetComponent<Rigidbody2D>() == null)
                    {
                        throw new InvalidOperationException(scene.path + " needs a linked Fleabag prefab with physics and respawn.");
                    }
                }

                foreach (Tilemap map in root.GetComponentsInChildren<Tilemap>(true))
                {
                    if (map.GetComponent<TilemapCollider2D>() != null)
                    {
                        terrains++;
                        if (map.GetComponent<CompositeCollider2D>() == null
                            || map.GetComponent<Rigidbody2D>().bodyType != RigidbodyType2D.Static
                            || map.GetUsedTilesCount() == 0)
                        {
                            throw new InvalidOperationException(scene.path + " needs paintable composite terrain.");
                        }
                    }
                }

                foreach (PixelPerfectCamera pixels in root.GetComponentsInChildren<PixelPerfectCamera>(true))
                {
                    cameras++;
                    Camera camera = pixels.GetComponent<Camera>();
                    if (pixels.assetsPPU != 16 || pixels.refResolutionX != 640 || pixels.refResolutionY != 360
                        || !pixels.cropFrameX || !pixels.cropFrameY || !pixels.upscaleRT || !camera.orthographic
                        || Vector3.Distance(camera.transform.position, new Vector3(20f, 11.25f, -10f)) > 0.01f)
                    {
                        throw new InvalidOperationException(scene.path + " needs a fixed 640x360 pixel camera.");
                    }
                }
            }

            if (players != 1 || exits != 1 || huds != 1 || cameras != 1 || checkpoints < 1 || terrains != 1
                || bridges != (demo ? 2 : 0) || stations != (demo ? 1 : 0))
            {
                throw new InvalidOperationException($"{scene.path}: unexpected scaffold counts. Player {players}, "
                    + $"exit {exits}, HUD {huds}, camera {cameras}, checkpoint {checkpoints}, "
                    + $"terrain {terrains}, bridges {bridges}, station {stations}.");
            }
        }
    }
}
