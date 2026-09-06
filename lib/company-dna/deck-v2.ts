/**
 * DNA-V2C — Deck UI exposure.
 * Shared V2 helpers live in `v2-ui.ts`. Fence is DNA-V2D.
 */
export {
  COMPANY_DNA_DECK_OPTIONAL_KEYS,
  COMPANY_DNA_DECK_TIER1_KEYS,
  COMPANY_DNA_DECK_V2_UI_KEYS,
  companyDnaUiWorkAreaStatus,
  deckV2HubHref,
  deckV2ProgressCounts,
  isCompanyDnaDeckV2TaskKey,
  isCompanyDnaDeckV2WorkArea,
  listCompanyDnaDeckV2UiTasks,
  listCompanyDnaUiTasksForWorkArea,
  nextCompanyDnaDeckV2Task,
  workAreaUsesCompanyDnaV2Ui,
} from "@/lib/company-dna/v2-ui";

/** V2C surface: Deck only. Fence ships in V2D via `COMPANY_DNA_V2_UI_WORK_AREAS`. */
export const COMPANY_DNA_V2C_EXPOSED_WORK_AREAS = ["deck"] as const;
