using UnityEngine;
using UnityEngine.InputSystem;

namespace Quriosity.Gameplay
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Rigidbody2D))]
    public sealed class PlayerController : MonoBehaviour
    {
        [Header("Movement (world units)")]
        [SerializeField, Min(0.1f)] private float moveSpeed = 5.5f;
        [SerializeField, Min(0.1f)] private float groundAcceleration = 90f;
        [SerializeField, Min(0.1f)] private float groundDeceleration = 120f;
        [SerializeField, Min(0.1f)] private float airAcceleration = 65f;
        [SerializeField, Min(0.1f)] private float airDeceleration = 30f;
        [SerializeField, Range(0f, 0.9f)] private float stickDeadzone = 0.2f;

        [Header("Jump")]
        [SerializeField, Min(0.1f)] private float jumpHeight = 2.5f;
        [SerializeField, Min(0.05f)] private float jumpApexTime = 0.38f;
        [SerializeField, Range(0.1f, 1f)] private float jumpReleaseMultiplier = 0.45f;
        [SerializeField, Min(1f)] private float fallGravityMultiplier = 1.5f;
        [SerializeField, Min(1f)] private float maximumFallSpeed = 22f;
        [SerializeField, Min(0f)] private float coyoteTime = 0.1f;
        [SerializeField, Min(0f)] private float jumpBufferTime = 0.12f;

        [Header("Dash")]
        [SerializeField, Min(0.1f)] private float dashDistance = 3f;
        [SerializeField, Min(0.02f)] private float dashDuration = 0.15f;
        [SerializeField, Min(0.001f)] private float collisionSkin = 0.02f;

        [Header("Ground detection")]
        [SerializeField] private LayerMask solidLayers = ~0;
        [SerializeField, Min(0.001f)] private float groundProbeDistance = 0.06f;
        [SerializeField, Range(0.1f, 1f)] private float minimumGroundNormalY = 0.65f;

        [Header("Visuals (independent of the physics shape)")]
        [SerializeField] private SpriteRenderer visualRenderer;
        [SerializeField] private Sprite[] idleFrames;
        [SerializeField] private Sprite[] runFrames;
        [SerializeField] private Sprite jumpSprite;
        [SerializeField] private Sprite dashSprite;
        [SerializeField, Min(0.1f)] private float idleFramesPerSecond = 6f;
        [SerializeField, Min(0.1f)] private float runFramesPerSecond = 12f;

        // Reused query buffers: neither movement nor animation allocates per frame.
        private readonly RaycastHit2D[] castHits = new RaycastHit2D[32];
        private readonly ContactPoint2D[] contacts = new ContactPoint2D[32];
        private static readonly Vector2[] dashDirections =
        {
            Vector2.right, new Vector2(0.70710678f, 0.70710678f),
            Vector2.up, new Vector2(-0.70710678f, 0.70710678f),
            Vector2.left, new Vector2(-0.70710678f, -0.70710678f),
            Vector2.down, new Vector2(0.70710678f, -0.70710678f)
        };

        private Rigidbody2D body;
        private PhysicsMaterial2D movementMaterial;
        private ContactFilter2D solidFilter;
        private int contactCount;
        private bool inputEnabled = true;
        private float moveInput;
        private Vector2 aimInput;
        private Vector2 requestedDashDirection;
        private bool jumpHeld;
        private bool dashRequested;
        private bool jumpCutAvailable;
        private float jumpRequestedUntil = float.NegativeInfinity;
        private float lastGroundedTime = float.NegativeInfinity;
        private bool isGrounded;
        private bool groundedLastStep;
        private bool isDashing;
        private bool hasDash = true;
        private bool dashEndsAfterStep;
        private float dashTimeRemaining;
        private Vector2 dashDirection;
        private int facing = 1;
        private VisualState visualState;
        private float animationTime;

        public bool IsGrounded => isGrounded;
        public bool IsDashing => isDashing;
        public bool HasDash => hasDash;
        public bool IsInputEnabled => inputEnabled;
        public Vector2 Velocity => body != null ? body.linearVelocity : Vector2.zero;

        private enum VisualState
        {
            Idle,
            Run,
            Jump,
            Dash
        }

        private void Reset()
        {
            ConfigureBody();
            visualRenderer = GetComponentInChildren<SpriteRenderer>();
        }

        private void Awake()
        {
            ConfigureBody();
            if (visualRenderer == null)
            {
                visualRenderer = GetComponentInChildren<SpriteRenderer>();
            }

            // Zero friction prevents a moving player from sticking to walls.
            // Preserve an explicitly authored collider/body material.
            Collider2D playerCollider = GetComponent<Collider2D>();
            if (body.sharedMaterial == null && playerCollider.sharedMaterial == null)
            {
                movementMaterial = new PhysicsMaterial2D("Player movement")
                {
                    friction = 0f,
                    bounciness = 0f
                };
                body.sharedMaterial = movementMaterial;
            }

            UpdateVisuals(0f);
        }

        private void ConfigureBody()
        {
            body = GetComponent<Rigidbody2D>();
            body.bodyType = RigidbodyType2D.Dynamic;
            body.simulated = true;
            body.constraints |= RigidbodyConstraints2D.FreezeRotation;
            body.interpolation = RigidbodyInterpolation2D.Interpolate;
            body.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
            body.linearDamping = 0f;
            body.angularDamping = 0f;

            Collider2D playerCollider = GetComponent<Collider2D>();
            if (playerCollider == null)
            {
                CapsuleCollider2D capsule = gameObject.AddComponent<CapsuleCollider2D>();
                capsule.direction = CapsuleDirection2D.Vertical;
                capsule.size = new Vector2(0.625f, 1.375f);
                capsule.offset = new Vector2(0f, -0.0625f);
                playerCollider = capsule;
            }

            // Never resize an existing, deliberately authored player collider.
            playerCollider.isTrigger = false;
            ApplyGravity();
        }

        private void Update()
        {
            if (inputEnabled)
            {
                ReadInput();
            }

            UpdateVisuals(Time.deltaTime);
        }

        private void ReadInput()
        {
            Keyboard keyboard = Keyboard.current;
            Gamepad gamepad = Gamepad.current;
            Vector2 keyboardDirection = Vector2.zero;
            Vector2 gamepadDirection = Vector2.zero;
            bool jumpPressed = false;
            bool dashPressed = false;
            jumpHeld = false;

            if (keyboard != null)
            {
                keyboardDirection.x = (keyboard.dKey.isPressed || keyboard.rightArrowKey.isPressed ? 1f : 0f)
                    - (keyboard.aKey.isPressed || keyboard.leftArrowKey.isPressed ? 1f : 0f);
                keyboardDirection.y = (keyboard.wKey.isPressed || keyboard.upArrowKey.isPressed ? 1f : 0f)
                    - (keyboard.sKey.isPressed || keyboard.downArrowKey.isPressed ? 1f : 0f);
                jumpPressed = keyboard.spaceKey.wasPressedThisFrame;
                jumpHeld = keyboard.spaceKey.isPressed;
                dashPressed = keyboard.leftShiftKey.wasPressedThisFrame
                    || keyboard.rightShiftKey.wasPressedThisFrame || keyboard.xKey.wasPressedThisFrame;
            }

            if (gamepad != null)
            {
                gamepadDirection = gamepad.leftStick.ReadValue();
                if (gamepadDirection.sqrMagnitude < stickDeadzone * stickDeadzone)
                {
                    gamepadDirection = Vector2.zero;
                }

                Vector2 dpadDirection = gamepad.dpad.ReadValue();
                if (dpadDirection.sqrMagnitude > gamepadDirection.sqrMagnitude)
                {
                    gamepadDirection = dpadDirection;
                }

                jumpPressed |= gamepad.buttonSouth.wasPressedThisFrame;
                jumpHeld |= gamepad.buttonSouth.isPressed;
                dashPressed |= gamepad.buttonEast.wasPressedThisFrame
                    || gamepad.rightShoulder.wasPressedThisFrame;
            }

            moveInput = keyboardDirection.x != 0f ? keyboardDirection.x : gamepadDirection.x;
            aimInput = keyboardDirection != Vector2.zero ? keyboardDirection : gamepadDirection;
            if (!isDashing && Mathf.Abs(moveInput) > 0.01f)
            {
                facing = moveInput > 0f ? 1 : -1;
            }

            if (jumpPressed)
            {
                jumpRequestedUntil = Time.time + jumpBufferTime;
            }

            // Capture the aim with the press, not with a later Update that may have
            // released the direction before the next physics tick.
            if (dashPressed)
            {
                requestedDashDirection = aimInput.sqrMagnitude > 0.001f ? aimInput : new Vector2(facing, 0f);
                dashRequested = true;
            }
        }

        private void FixedUpdate()
        {
            solidFilter.SetLayerMask(solidLayers.value & Physics2D.GetLayerCollisionMask(gameObject.layer));
            solidFilter.useTriggers = false;
            contactCount = body.GetContacts(solidFilter, contacts);
            UpdateGrounded();

            if (isDashing && dashEndsAfterStep)
            {
                EndDash();
            }

            if (!isDashing)
            {
                ApplyHorizontalMovement();
                if (inputEnabled)
                {
                    TryJump();
                    if (dashRequested && hasDash)
                    {
                        StartDash();
                    }
                }
            }

            dashRequested = false;
            if (isDashing)
            {
                AdvanceDash();
            }
            else
            {
                ApplyGravity();
            }
        }

        private void UpdateGrounded()
        {
            bool groundedNow = false;
            if (body.linearVelocity.y <= 0.1f)
            {
                for (int i = 0; i < contactCount; i++)
                {
                    if (contacts[i].normal.y >= minimumGroundNormalY)
                    {
                        groundedNow = true;
                        break;
                    }
                }

                if (!groundedNow)
                {
                    int hitCount = body.Cast(Vector2.down, solidFilter, castHits, groundProbeDistance);
                    for (int i = 0; i < hitCount; i++)
                    {
                        // A zero-distance overlap has a synthetic normal opposite the cast.
                        // It cannot prove that a wall is a floor; real contacts handle it above.
                        if (castHits[i].distance > 0f && castHits[i].normal.y >= minimumGroundNormalY)
                        {
                            groundedNow = true;
                            break;
                        }
                    }
                }
            }

            if (groundedNow)
            {
                if (!isDashing)
                {
                    lastGroundedTime = Time.time;
                }
                if (!groundedLastStep)
                {
                    hasDash = true;
                }
            }

            isGrounded = groundedNow;
            // This physical history is separate from TryJump's immediate public state.
            // Jump + horizontal dash in one tick must not invent a second landing.
            groundedLastStep = groundedNow;
        }

        private void ApplyHorizontalMovement()
        {
            Vector2 velocity = body.linearVelocity;
            float targetSpeed = inputEnabled ? moveInput * moveSpeed : 0f;
            float acceleration = isGrounded ? groundAcceleration : airAcceleration;
            if (Mathf.Abs(targetSpeed) < 0.01f)
            {
                acceleration = isGrounded ? groundDeceleration : airDeceleration;
            }

            velocity.x = Mathf.MoveTowards(velocity.x, targetSpeed, acceleration * Time.fixedDeltaTime);
            body.linearVelocity = velocity;
        }

        private void TryJump()
        {
            bool canJump = isGrounded || Time.time - lastGroundedTime <= coyoteTime;
            if (Time.time <= jumpRequestedUntil && canJump)
            {
                Vector2 velocity = body.linearVelocity;
                velocity.y = 2f * jumpHeight / jumpApexTime;
                body.linearVelocity = velocity;
                isGrounded = false;
                lastGroundedTime = float.NegativeInfinity;
                jumpRequestedUntil = float.NegativeInfinity;
                jumpCutAvailable = true;
            }

            if (jumpCutAvailable && !jumpHeld && body.linearVelocity.y > 0f)
            {
                Vector2 velocity = body.linearVelocity;
                velocity.y *= jumpReleaseMultiplier;
                body.linearVelocity = velocity;
                jumpCutAvailable = false;
            }

            if (body.linearVelocity.y <= 0f)
            {
                jumpCutAvailable = false;
            }
        }

        private void StartDash()
        {
            Vector2 direction = requestedDashDirection;
            int directionIndex = Mathf.RoundToInt(Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg / 45f);
            dashDirection = dashDirections[(directionIndex + 8) % 8];
            if (Mathf.Abs(dashDirection.x) > 0.01f)
            {
                facing = dashDirection.x > 0f ? 1 : -1;
            }

            hasDash = false;
            isDashing = true;
            dashEndsAfterStep = false;
            dashTimeRemaining = dashDuration;
            jumpCutAvailable = false;
            // Walking off a ledge during a dash must not create a coyote jump afterwards.
            lastGroundedTime = float.NegativeInfinity;
            body.gravityScale = 0f;
        }

        private void AdvanceDash()
        {
            float stepTime = Mathf.Min(Time.fixedDeltaTime, dashTimeRemaining);
            float stepDistance = dashDistance / dashDuration * stepTime;
            float safeDistance = stepDistance;
            bool blocked = false;
            int hitCount = body.Cast(dashDirection, solidFilter, castHits, stepDistance + collisionSkin);
            for (int i = 0; i < hitCount; i++)
            {
                RaycastHit2D hit = castHits[i];
                if (!BlocksDash(hit))
                {
                    continue;
                }

                safeDistance = Mathf.Min(safeDistance, Mathf.Max(0f, hit.distance - collisionSkin));
                blocked = true;
            }

            // Move through physics, not Transform/MovePosition teleports. The last partial
            // tick is scaled so an unobstructed dash travels exactly the configured distance.
            body.linearVelocity = dashDirection * (safeDistance / Time.fixedDeltaTime);
            body.gravityScale = 0f;
            dashTimeRemaining -= stepTime;
            dashEndsAfterStep = blocked || dashTimeRemaining <= 0f;
        }

        private bool BlocksDash(RaycastHit2D hit)
        {
            if (hit.distance > 0f)
            {
                return Vector2.Dot(hit.normal, dashDirection) < -0.001f;
            }

            // Overlap casts invent a normal of -direction. Use actual contact normals
            // instead, allowing a horizontal dash along a floor but not into a wall.
            bool foundContact = false;
            for (int i = 0; i < contactCount; i++)
            {
                ContactPoint2D contact = contacts[i];
                if (contact.collider != hit.collider && contact.otherCollider != hit.collider)
                {
                    continue;
                }

                foundContact = true;
                if (Vector2.Dot(contact.normal, dashDirection) < -0.001f)
                {
                    return true;
                }
            }

            // Without reliable contact information, stopping is safer than passing through.
            return !foundContact;
        }

        private void EndDash()
        {
            isDashing = false;
            dashEndsAfterStep = false;
            dashTimeRemaining = 0f;
            Vector2 velocity = body.linearVelocity;
            velocity.x = Mathf.Clamp(velocity.x, -moveSpeed, moveSpeed);
            velocity.y = Mathf.Clamp(velocity.y, -maximumFallSpeed, 0f);
            body.linearVelocity = velocity;
            ApplyGravity();
        }

        private void ApplyGravity()
        {
            float gravity = 2f * jumpHeight / (jumpApexTime * jumpApexTime);
            float worldGravity = Mathf.Max(0.01f, Mathf.Abs(Physics2D.gravity.y));
            body.gravityScale = gravity / worldGravity;
            if (body.linearVelocity.y < 0f)
            {
                body.gravityScale *= fallGravityMultiplier;
            }

            Vector2 velocity = body.linearVelocity;
            velocity.y = Mathf.Max(velocity.y, -maximumFallSpeed);
            body.linearVelocity = velocity;
        }

        public void SetInputEnabled(bool enabled)
        {
            if (inputEnabled == enabled)
            {
                return;
            }

            inputEnabled = enabled;
            ClearInput();
            if (!enabled && body != null)
            {
                if (isDashing)
                {
                    EndDash();
                }

                body.linearVelocity = new Vector2(0f, body.linearVelocity.y);
            }
        }

        public void Respawn(Vector2 position)
        {
            if (body == null)
            {
                ConfigureBody();
            }

            isDashing = false;
            dashEndsAfterStep = false;
            dashTimeRemaining = 0f;
            isGrounded = false;
            groundedLastStep = false;
            hasDash = true;
            lastGroundedTime = float.NegativeInfinity;
            jumpCutAvailable = false;
            ClearInput();
            body.position = position;
            body.linearVelocity = Vector2.zero;
            body.angularVelocity = 0f;
            ApplyGravity();
            body.WakeUp();
            animationTime = 0f;
            UpdateVisuals(0f);
            // inputEnabled is deliberately unchanged: respawn cannot unlock an intro/HUD.
        }

        private void ClearInput()
        {
            moveInput = 0f;
            aimInput = Vector2.zero;
            requestedDashDirection = Vector2.zero;
            jumpHeld = false;
            dashRequested = false;
            jumpRequestedUntil = float.NegativeInfinity;
        }

        public void ConfigureVisuals(SpriteRenderer renderer, Sprite[] idleFrames, Sprite[] runFrames,
            Sprite jumpSprite, Sprite dashSprite)
        {
            visualRenderer = renderer;
            this.idleFrames = idleFrames;
            this.runFrames = runFrames;
            this.jumpSprite = jumpSprite;
            this.dashSprite = dashSprite;
            animationTime = 0f;
            UpdateVisuals(0f);
        }

        private void UpdateVisuals(float deltaTime)
        {
            if (visualRenderer == null)
            {
                return;
            }

            VisualState nextState = isDashing ? VisualState.Dash
                : !isGrounded ? VisualState.Jump
                : Mathf.Abs(Velocity.x) > 0.1f ? VisualState.Run : VisualState.Idle;
            if (nextState != visualState)
            {
                visualState = nextState;
                animationTime = 0f;
            }

            Sprite sprite = null;
            Sprite[] frames = visualState == VisualState.Run ? runFrames : idleFrames;
            if (visualState == VisualState.Dash)
            {
                sprite = dashSprite;
            }
            else if (visualState == VisualState.Jump)
            {
                sprite = jumpSprite;
            }

            if (sprite == null && frames != null && frames.Length > 0)
            {
                float frameRate = visualState == VisualState.Run ? runFramesPerSecond : idleFramesPerSecond;
                animationTime = Mathf.Repeat(animationTime + deltaTime, frames.Length / frameRate);
                int frameIndex = Mathf.Min(Mathf.FloorToInt(animationTime * frameRate), frames.Length - 1);
                sprite = frames[frameIndex];
            }

            if (sprite != null)
            {
                visualRenderer.sprite = sprite;
            }

            visualRenderer.flipX = facing < 0;
        }

        private void OnDisable()
        {
            ClearInput();
            if (body != null && isDashing)
            {
                EndDash();
            }
        }

        private void OnDestroy()
        {
            if (movementMaterial != null)
            {
                Destroy(movementMaterial);
            }
        }
    }
}
