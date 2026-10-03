using System;
using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Quriosity.Gameplay
{
    [DisallowMultipleComponent]
    public sealed class LevelExit : MonoBehaviour
    {
        [SerializeField] private string nextSceneName = string.Empty;
        [SerializeField] private bool isLocked;
        [SerializeField, Min(0f)] private float sceneTransitionDelay = 0.7f;

        private bool reached;

        public string NextSceneName
        {
            get => nextSceneName;
            set => nextSceneName = value ?? string.Empty;
        }

        public bool IsLocked
        {
            get => isLocked;
            set => isLocked = value;
        }

        public event Action Reached;

        private void OnTriggerEnter2D(Collider2D other)
        {
            TryReach(other);
        }

        private void OnTriggerStay2D(Collider2D other)
        {
            // Unlocking the exit while the player is already inside still completes it.
            TryReach(other);
        }

        private void TryReach(Collider2D other)
        {
            if (reached || isLocked || other.GetComponentInParent<PlayerController>() == null)
            {
                return;
            }

            reached = true;
            Reached?.Invoke();
            if (string.IsNullOrEmpty(nextSceneName))
            {
                // The demo's HUD owns completion; no scene is destroyed or reloaded.
                return;
            }

            if (Application.CanStreamedLevelBeLoaded(nextSceneName))
            {
                StartCoroutine(LoadNextScene(nextSceneName));
            }
            else
            {
                Debug.LogWarning($"Exit scene '{nextSceneName}' is not available in Build Settings.", this);
            }
        }

        private IEnumerator LoadNextScene(string sceneName)
        {
            // A completion panel may pause gameplay; the transition still needs to finish.
            yield return new WaitForSecondsRealtime(sceneTransitionDelay);
            SceneManager.LoadScene(sceneName);
        }
    }
}
