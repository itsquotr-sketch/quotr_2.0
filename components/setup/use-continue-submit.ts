"use client";

import { useRef, useState } from "react";
import type { ActionResult } from "./types";

const SAVE_FAILED = "Could not save. Check your connection and try again.";

/**
 * Locks on the first click, before the save returns.
 * A successful save stays locked through the following navigation.
 * A failed save unlocks and leaves the entered answers in place.
 */
export function useContinueSubmit() {
  const lockRef = useRef(false);
  const [saving, setSaving] = useState(false);

  async function run(
    save: () => Promise<ActionResult>,
    holdOnSuccess = false
  ): Promise<ActionResult | null> {
    if (lockRef.current) return null;
    lockRef.current = true;
    setSaving(true);
    try {
      const result = await save();
      const failed = Boolean(result.error || result.fieldErrors);
      if (failed || !holdOnSuccess) {
        lockRef.current = false;
        setSaving(false);
      }
      return result;
    } catch {
      lockRef.current = false;
      setSaving(false);
      return { error: SAVE_FAILED };
    }
  }

  return { saving, run };
}
