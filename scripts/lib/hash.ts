import { createHash } from "crypto";

/**
 * Produce a short, stable hex digest for a canonical payload string.
 * Uses the first 16 chars of SHA-256, which is collision-safe for code-clone
 * detection purposes within a single repository.
 */
export function stableHash(payload: string): string {
  return createHash("sha256")
    .update(payload, "utf8")
    .digest("hex")
    .slice(0, 16);
}
