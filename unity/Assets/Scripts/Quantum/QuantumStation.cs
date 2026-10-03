using System;
using Quriosity.Gameplay;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Quriosity.Quantum
{
    /// <summary>The first demo's H preparation, Born measurement, and reset console.</summary>
    [DisallowMultipleComponent]
    public sealed class QuantumStation : MonoBehaviour
    {
        [SerializeField] private PlayerController player;
        [SerializeField] private QuantumBridge zeroBridge;
        [SerializeField] private QuantumBridge oneBridge;
        [SerializeField, Min(0.1f)] private float interactionRadius = 2f;
        [SerializeField, HideInInspector] private StationPhase phase;

        private readonly QubitState qubit = new QubitState();
        private readonly System.Random measurementRandom = new System.Random();
        private PlayerRespawn subscribedRespawn;

        private enum StationPhase
        {
            Initial,
            Prepared,
            MeasuredZero,
            MeasuredOne
        }

        public double ZeroProbability => qubit.ZeroProbability;
        public double OneProbability => qubit.OneProbability;
        public PlayerController Player => player;
        public QuantumBridge ZeroBridge => zeroBridge;
        public QuantumBridge OneBridge => oneBridge;
        public bool IsPrepared => phase == StationPhase.Prepared;
        public int? MeasuredOutcome => phase == StationPhase.MeasuredZero ? 0
            : phase == StationPhase.MeasuredOne ? 1 : (int?)null;

        public bool CanInteract => Application.isPlaying && isActiveAndEnabled
            && player != null && player.isActiveAndEnabled && player.IsInputEnabled
            && Time.timeScale > 0f && zeroBridge != null && oneBridge != null && zeroBridge != oneBridge
            && ((Vector2)player.transform.position - (Vector2)transform.position).sqrMagnitude
                <= interactionRadius * interactionRadius;

        public string Hint
        {
            get
            {
                if (player == null || zeroBridge == null || oneBridge == null || zeroBridge == oneBridge)
                {
                    return "Console needs a player and two distinct routes.";
                }

                if (!isActiveAndEnabled || !player.isActiveAndEnabled || !player.IsInputEnabled || Time.timeScale <= 0f)
                {
                    return "Console interaction is paused.";
                }

                if (!CanInteract)
                {
                    return "Approach the console to prepare, measure, or reset.";
                }

                switch (phase)
                {
                    case StationPhase.Initial:
                        return "E / gamepad west: Apply H to prepare a superposition.";
                    case StationPhase.Prepared:
                        return "E / gamepad west: Measure. Each safe route has a 50% chance.";
                    default:
                        return "E / gamepad west: Reset to |0> and ghost both routes.";
                }
            }
        }

        public string StateSummary
        {
            get
            {
                switch (phase)
                {
                    case StationPhase.Initial:
                        return "|0> / initial. Both routes await measurement.";
                    case StationPhase.Prepared:
                        return "H|0> = (|0> + |1>) / sqrt(2). Both routes await measurement.";
                    case StationPhase.MeasuredZero:
                        return "Measured 0: collapsed to |0>. The lower teal route is solid.";
                    default:
                        return "Measured 1: collapsed to |1>. The upper lilac route is solid.";
                }
            }
        }

        /// <summary>Fires on preparation, measurement, or reset; proximity is queried via CanInteract.</summary>
        public event Action StateChanged;

        private void OnEnable()
        {
            // Rebuild the nonserialized amplitudes from the serialized demo phase
            // after a domain reload, without rerolling an already measured outcome.
            qubit.Reset();
            if (phase == StationPhase.Prepared)
            {
                qubit.ApplyHadamard();
            }
            else if (phase == StationPhase.MeasuredOne)
            {
                qubit.ApplyX();
            }

            ApplyRouteAvailability();
            SubscribeToRespawn();
        }

        public void Configure(PlayerController player, QuantumBridge zeroBridge, QuantumBridge oneBridge)
        {
            UnsubscribeFromRespawn();
            this.player = player;
            this.zeroBridge = zeroBridge;
            this.oneBridge = oneBridge;
            ResetStation();
            SubscribeToRespawn();
        }

        private void Update()
        {
            if (!CanInteract)
            {
                return;
            }

            Keyboard keyboard = Keyboard.current;
            Gamepad gamepad = Gamepad.current;
            if ((keyboard != null && keyboard.eKey.wasPressedThisFrame)
                || (gamepad != null && gamepad.buttonWest.wasPressedThisFrame))
            {
                Interact();
            }
        }

        /// <summary>Uses the same proximity and input-lock guards as keyboard/gamepad interaction.</summary>
        public void Interact()
        {
            if (!CanInteract)
            {
                return;
            }

            switch (phase)
            {
                case StationPhase.Initial:
                    qubit.ApplyHadamard();
                    phase = StationPhase.Prepared;
                    break;
                case StationPhase.Prepared:
                    int outcome = qubit.Measure(measurementRandom.NextDouble());
                    phase = outcome == 0 ? StationPhase.MeasuredZero : StationPhase.MeasuredOne;
                    break;
                default:
                    ResetStation();
                    return;
            }

            ApplyRouteAvailability();
            StateChanged?.Invoke();
        }

        /// <summary>Programmatic/respawn reset; intentionally does not require proximity or unlocked input.</summary>
        public void ResetStation()
        {
            qubit.Reset();
            phase = StationPhase.Initial;
            ApplyRouteAvailability();
            StateChanged?.Invoke();
        }

        private void ApplyRouteAvailability()
        {
            if (zeroBridge != null)
            {
                zeroBridge.SetAvailable(phase == StationPhase.MeasuredZero);
            }

            if (oneBridge != null)
            {
                oneBridge.SetAvailable(phase == StationPhase.MeasuredOne);
            }
        }

        private void SubscribeToRespawn()
        {
            if (!Application.isPlaying || !isActiveAndEnabled || player == null || subscribedRespawn != null)
            {
                return;
            }

            subscribedRespawn = player.GetComponent<PlayerRespawn>();
            if (subscribedRespawn != null)
            {
                subscribedRespawn.Respawned += ResetStation;
            }
        }

        private void UnsubscribeFromRespawn()
        {
            if (subscribedRespawn != null)
            {
                subscribedRespawn.Respawned -= ResetStation;
            }

            subscribedRespawn = null;
        }

        private void OnDisable()
        {
            UnsubscribeFromRespawn();
        }

        private void OnDestroy()
        {
            UnsubscribeFromRespawn();
        }
    }
}
