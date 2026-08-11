/**
 * Stage 3.2.1 — Candidate ranking (deterministic).
 */

import type { InterviewCandidate, PriorityClass } from "@/lib/builder-interview/types";

const PRIORITY_RANK: Record<PriorityClass, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

const DOMAIN_ORDER: Record<string, number> = {
  SITE_ACCESS: 10,
  LOGISTICS: 20,
  COMPLIANCE_RISK: 30,
  EXISTING_CONDITIONS: 40,
  DIMENSIONS: 50,
  SCOPE_CONTEXT: 60,
  SPECIFICATION_CONTEXT: 70,
  TRADE_INTERFACES: 80,
  PROJECT_IDENTITY: 90,
  COMMERCIAL_DELIVERY: 100,
};

/**
 * Stable sort: priority → domain → registry order embedded in provenance.ruleId
 * (we pass registryOrder via candidate triggerRuleId chain — use questionKey lexical
 * as final tie-break for determinism).
 */
export function rankCandidates(
  candidates: readonly InterviewCandidate[],
  registryOrderByKey: ReadonlyMap<string, number>
): InterviewCandidate[] {
  return [...candidates].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    const d =
      (DOMAIN_ORDER[a.domain] ?? 999) - (DOMAIN_ORDER[b.domain] ?? 999);
    if (d !== 0) return d;
    const ra = registryOrderByKey.get(a.questionKey) ?? 9999;
    const rb = registryOrderByKey.get(b.questionKey) ?? 9999;
    if (ra !== rb) return ra - rb;
    const wa = (a.workAreaId ?? "").localeCompare(b.workAreaId ?? "");
    if (wa !== 0) return wa;
    return a.questionKey.localeCompare(b.questionKey);
  });
}
