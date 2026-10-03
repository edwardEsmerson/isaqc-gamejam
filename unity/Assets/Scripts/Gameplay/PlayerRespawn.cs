using System;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Quriosity.Gameplay
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(PlayerController))]
    public sealed class PlayerRespawn : MonoBehaviour
    {
        [SerializeField] private Transform initialCheckpoint;
        [SerializeField] private float minimumY = -8f;
        [SerializeField] private bool keyboardRestartEnabled = true;

        private PlayerController controller;
        private Vector2 checkpointPosition;
        private bool initialized;
        private bool respawning;
        private int lastRespawnFrame = -1;

        public Vector2 CheckpointPosition => checkpointPosition;
        public event Action Respawned;

        private void Awake()
        {
            Initialize();
        }

        private void Initialize()
        {
            if (initialized)
            {
                return;
            }

            controller = GetComponent<PlayerController>();
            checkpointPosition = initialCheckpoint != null ? (Vector2)initialCheckpoint.position : (Vector2)transform.position;
            initialized = true;
        }

        private void Update()
        {
            Keyboard keyboard = Keyboard.current;
            bool restartPressed = keyboardRestartEnabled && keyboard != null && keyboard.rKey.wasPressedThisFrame;
            if (restartPressed || transform.position.y < minimumY)
            {
                Respawn();
            }
        }

        public void SetCheckpoint(Vector2 position)
        {
            Initialize();
            checkpointPosition = position;
        }

        public void Respawn()
        {
            // Multiple player colliders can report the same hazard in one physics step.
            if (respawning || lastRespawnFrame == Time.frameCount)
            {
                return;
            }

            Initialize();
            respawning = true;
            lastRespawnFrame = Time.frameCount;
            try
            {
                controller.Respawn(checkpointPosition);
                Respawned?.Invoke();
            }
            finally
            {
                respawning = false;
            }
        }
    }
}
