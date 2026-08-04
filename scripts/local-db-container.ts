/**
 * Resolve the local Supabase Postgres Docker container name.
 * Checkout folder names differ (e.g. quotr_2.0 vs quotr_2.0-main), so the
 * container suffix is discovered rather than hard-coded.
 */
import { execFileSync } from "node:child_process";

export function resolveLocalDbContainer(): string {
  try {
    const names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);

    const match = names.find((n) => n.startsWith("supabase_db_quotr"));
    if (match) {
      return match;
    }
  } catch {
    // fall through to candidate probe
  }

  const candidates = ["supabase_db_quotr_2.0", "supabase_db_quotr_2.0-main"];
  for (const candidate of candidates) {
    try {
      execFileSync(
        "docker",
        [
          "exec",
          "-i",
          candidate,
          "psql",
          "-U",
          "postgres",
          "-t",
          "-A",
          "-c",
          "SELECT 1",
        ],
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      );
      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error(
    "Local Supabase Postgres container not found (expected supabase_db_quotr*). Is `supabase start` running?"
  );
}
