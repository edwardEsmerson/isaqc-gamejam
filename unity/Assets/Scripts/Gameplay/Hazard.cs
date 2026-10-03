using UnityEngine;

namespace Quriosity.Gameplay
{
    [DisallowMultipleComponent]
    public sealed class Hazard : MonoBehaviour
    {
        private void OnTriggerEnter2D(Collider2D other)
        {
            RespawnPlayer(other);
        }

        private void OnCollisionEnter2D(Collision2D collision)
        {
            RespawnPlayer(collision.collider);
        }

        private static void RespawnPlayer(Collider2D other)
        {
            PlayerRespawn player = other.GetComponentInParent<PlayerRespawn>();
            if (player != null)
            {
                player.Respawn();
            }
        }
    }
}
