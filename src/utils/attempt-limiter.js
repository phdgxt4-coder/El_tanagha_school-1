// Front-end cooldown after repeated failed attempts (parent link code). This only slows honest mistakes and
// casual guessing from one page; real limits must live on the server or in the rules (see HANDOFF.md).
export function createAttemptLimiter({ max = 5, cooldownMs = 60000, now = () => Date.now() } = {}) {
  let failures = 0, lockedUntil = 0;
  return {
    remainingMs() { return Math.max(0, lockedUntil - now()); },
    fail() { failures += 1; if (failures >= max) { lockedUntil = now() + cooldownMs; failures = 0; } },
    succeed() { failures = 0; lockedUntil = 0; },
  };
}
