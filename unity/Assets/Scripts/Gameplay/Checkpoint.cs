using UnityEngine;

namespace Quriosity.Gameplay
{
    [DisallowMultipleComponent]
    public sealed class Checkpoint : MonoBehaviour
    {
        [SerializeField] private Transform spawnPoint;
        [SerializeField] private Vector2 fallbackSpawnOffset = Vector2.up;
        [SerializeField] private SpriteRenderer visualRenderer;
        [SerializeField] private Color inactiveColor = new Color(0.35f, 0.6f, 0.7f, 1f);
        [SerializeField] private Color activeColor = new Color(0.45f, 1f, 0.85f, 1f);
        [SerializeField] private Light checkpointLight;
        [SerializeField, Min(0f)] private float inactiveLightIntensity = 0.35f;
        [SerializeField, Min(0f)] private float activeLightIntensity = 1.5f;

        private bool activated;

        private void Awake()
        {
            if (visualRenderer == null)
            {
                visualRenderer = GetComponentInChildren<SpriteRenderer>();
            }

            if (checkpointLight == null)
            {
                checkpointLight = GetComponentInChildren<Light>();
            }

            UpdateFeedback();
        }

        public void Configure(Transform spawnPoint)
        {
            this.spawnPoint = spawnPoint;
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            ActivateForPlayer(other);
        }

        private void OnCollisionEnter2D(Collision2D collision)
        {
            ActivateForPlayer(collision.collider);
        }

        private void ActivateForPlayer(Collider2D other)
        {
            PlayerRespawn player = other.GetComponentInParent<PlayerRespawn>();
            if (player == null)
            {
                return;
            }

            Vector2 position = spawnPoint != null ? (Vector2)spawnPoint.position
                : (Vector2)transform.position + fallbackSpawnOffset;
            player.SetCheckpoint(position);
            if (!activated)
            {
                activated = true;
                UpdateFeedback();
            }
        }

        private void UpdateFeedback()
        {
            Color color = activated ? activeColor : inactiveColor;
            if (visualRenderer != null)
            {
                visualRenderer.color = color;
            }

            if (checkpointLight != null)
            {
                checkpointLight.color = color;
                checkpointLight.intensity = activated ? activeLightIntensity : inactiveLightIntensity;
            }
        }
    }
}
