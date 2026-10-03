using System;
using UnityEngine;

namespace Quriosity.Quantum
{
    /// <summary>A measured route is solid; an unmeasured route remains visible as a ghost.</summary>
    [DisallowMultipleComponent]
    public sealed class QuantumBridge : MonoBehaviour
    {
        [SerializeField, Range(0f, 1f)] private float ghostAlphaMultiplier = 0.22f;
        [SerializeField, HideInInspector] private bool isAvailable = true;
        [SerializeField, HideInInspector] private RendererTint[] authoredTints = new RendererTint[0];

        // Serialized, rather than an Awake-only cache: the builder ghosts routes
        // in Edit Mode before saving them. Their original tints must survive loading.
        [Serializable]
        private struct RendererTint
        {
            public SpriteRenderer Renderer;
            public Color BaseColor;
        }

        public bool IsAvailable => isAvailable;

        private void OnEnable()
        {
            SetAvailable(isAvailable);
        }

        public void SetAvailable(bool available)
        {
            CacheAuthoredTints();
            isAvailable = available;
            foreach (RendererTint tint in authoredTints)
            {
                if (tint.Renderer == null)
                {
                    continue;
                }

                Color color = tint.BaseColor;
                if (!available)
                {
                    color.a *= ghostAlphaMultiplier;
                }

                // Preserve an intentionally disabled renderer, but still update
                // its tint so enabling it later shows the correct route state.
                tint.Renderer.color = color;
            }

            // Include inactive children and disabled colliders. Availability, not
            // a player's trigger callback, determines collision for the entire route.
            foreach (Collider2D collider in GetComponentsInChildren<Collider2D>(true))
            {
                collider.enabled = available;
            }
        }

        private void CacheAuthoredTints()
        {
            SpriteRenderer[] renderers = GetComponentsInChildren<SpriteRenderer>(true);
            var nextTints = new RendererTint[renderers.Length];
            for (int i = 0; i < renderers.Length; i++)
            {
                SpriteRenderer renderer = renderers[i];
                nextTints[i] = new RendererTint { Renderer = renderer, BaseColor = renderer.color };
                if (authoredTints == null)
                {
                    continue;
                }

                foreach (RendererTint tint in authoredTints)
                {
                    if (tint.Renderer == renderer)
                    {
                        nextTints[i] = tint;
                        break;
                    }
                }
            }

            authoredTints = nextTints;
        }
    }
}
