/**
 * Batch 2A.6 / remote baseline — migration 027 verification (local Docker only).
 *
 * Run after `npx supabase db reset`:
 *   npx tsx scripts/verify-migration-027-baseline-reconciliation.ts
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolveLocalDbContainer } from "./local-db-container";

let DB_CONTAINER = "";

function assert(label: string, ok: boolean) {
  console.log(ok ? "PASS" : "FAIL", label);
  if (!ok) process.exitCode = 1;
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      sql,
    ],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
}

function psqlOk(sql: string): boolean {
  try {
    psql(sql);
    return true;
  } catch {
    return false;
  }
}

function createFixture(): { orgId: string; userId: string; projectId: string } {
  const orgId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const email = `027-${userId.slice(0, 8)}@example.local`;

  psql(`
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
    ) VALUES (
      '${userId}',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      '${email}',
      crypt('password', gen_salt('bf')),
      now(), now(), now(),
      '{}'::jsonb,
      '{}'::jsonb,
      false,
      false,
      false
    );

    INSERT INTO public.organisations (id, name)
    VALUES ('${orgId}', '027 Org');

    INSERT INTO public.profiles (id, org_id, role)
    VALUES ('${userId}', '${orgId}', 'owner');

    INSERT INTO public.projects (id, org_id, created_by, title, stage)
    VALUES ('${projectId}', '${orgId}', '${userId}', '027 Project', 'brief');
  `);

  return { orgId, userId, projectId };
}

function deleteFixture(orgId: string, userId: string) {
  psql(`
    DELETE FROM public.organisations WHERE id = '${orgId}';
    DELETE FROM auth.users WHERE id = '${userId}';
  `);
}

function testConstraint() {
  console.log("\n--- note_type constraint ---\n");

  const def = psql(`
    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conname = 'project_notes_note_type_check'
      AND conrelid = 'public.project_notes'::regclass
  `);
  assert("project_notes_note_type_check exists", def.length > 0);
  assert("constraint includes calibration_note", def.includes("calibration_note"));

  const intended = [
    "general",
    "measurement",
    "access",
    "client_request",
    "existing_condition",
    "material_preference",
    "exclusion",
    "risk",
    "calibration_note",
    "other",
  ];
  for (const value of intended) {
    assert(`constraint definition lists ${value}`, def.includes(`'${value}'`));
  }

  const { orgId, userId, projectId } = createFixture();

  assert(
    "calibration_note insert accepted",
    psqlOk(`
      INSERT INTO public.project_notes (
        org_id, project_id, content, note_type, source, captured_by
      ) VALUES (
        '${orgId}', '${projectId}', 'calibration row',
        'calibration_note', 'desktop_note', '${userId}'
      )
    `)
  );

  assert(
    "general note_type insert accepted",
    psqlOk(`
      INSERT INTO public.project_notes (
        org_id, project_id, content, note_type, source, captured_by
      ) VALUES (
        '${orgId}', '${projectId}', 'general row',
        'general', 'site_walk', '${userId}'
      )
    `)
  );

  assert(
    "unknown note_type rejected",
    !psqlOk(`
      INSERT INTO public.project_notes (
        org_id, project_id, content, note_type, source, captured_by
      ) VALUES (
        '${orgId}', '${projectId}', 'bad type',
        'not_a_real_type', 'site_walk', '${userId}'
      )
    `)
  );

  deleteFixture(orgId, userId);
}

function testIndex() {
  console.log("\n--- note_proposals created-at index ---\n");

  const canonical = psql(`
    SELECT COALESCE(to_regclass('public.note_proposals_project_created_idx')::text, '')
  `);
  assert(
    "canonical index note_proposals_project_created_idx exists",
    canonical.includes("note_proposals_project_created_idx")
  );

  const alternate = psql(`
    SELECT COALESCE(to_regclass('public.note_proposals_created_idx')::text, '')
  `);
  assert(
    "alternate note_proposals_created_idx is absent",
    alternate.length === 0
  );

  const def = psql(`
    SELECT pg_get_indexdef('public.note_proposals_project_created_idx'::regclass)
  `);
  assert(
    "canonical index is (project_id, created_at DESC)",
    def.includes(
      "ON public.note_proposals USING btree (project_id, created_at DESC)"
    )
  );
  assert("canonical index is not unique", !/UNIQUE/i.test(def));
  assert("canonical index has no partial predicate", !/\sWHERE\s/i.test(def));

  const equivCount = psql(`
    SELECT COUNT(*)::text
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'note_proposals'
      AND pg_get_indexdef(i.indexrelid) LIKE '%(project_id, created_at DESC)%'
  `);
  assert(
    "only one semantically equivalent project/created_at index remains",
    equivCount === "1"
  );
}

function testIdempotentReapply() {
  console.log("\n--- idempotent re-run of guarded reconciliation ---\n");

  assert(
    "re-running constraint reconciliation block succeeds",
    psqlOk(`
      DO $re$
      DECLARE
        current_def text;
      BEGIN
        SELECT pg_get_constraintdef(oid)
        INTO current_def
        FROM pg_constraint
        WHERE conname = 'project_notes_note_type_check'
          AND conrelid = 'public.project_notes'::regclass;
        IF current_def IS NOT NULL AND current_def LIKE '%calibration_note%' THEN
          RETURN;
        END IF;
        RAISE EXCEPTION 'expected already-reconciled constraint';
      END
      $re$;
    `)
  );

  assert(
    "re-running index reconciliation block succeeds (canonical present)",
    psqlOk(`
      DO $re$
      BEGIN
        IF to_regclass('public.note_proposals_project_created_idx') IS NULL THEN
          RAISE EXCEPTION 'canonical index missing';
        END IF;
        IF to_regclass('public.note_proposals_created_idx') IS NOT NULL THEN
          RAISE EXCEPTION 'alternate index unexpectedly present';
        END IF;
      END
      $re$;
    `)
  );

  assert(
    "simulate alternate index then rename to canonical is safe",
    psqlOk(`
      ALTER INDEX public.note_proposals_project_created_idx
        RENAME TO note_proposals_created_idx;

      DO $re$
      DECLARE
        alternate_def text;
        expected_fragment text := 'ON public.note_proposals USING btree (project_id, created_at DESC)';
      BEGIN
        IF to_regclass('public.note_proposals_project_created_idx') IS NOT NULL THEN
          RETURN;
        END IF;
        IF to_regclass('public.note_proposals_created_idx') IS NULL THEN
          RAISE EXCEPTION 'alternate missing after rename simulation';
        END IF;
        SELECT pg_get_indexdef(c.oid) INTO alternate_def
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'note_proposals_created_idx';
        IF position(expected_fragment IN alternate_def) = 0 THEN
          RAISE EXCEPTION 'simulated alternate not equivalent';
        END IF;
        ALTER INDEX public.note_proposals_created_idx
          RENAME TO note_proposals_project_created_idx;
      END
      $re$;
    `)
  );

  assert(
    "canonical index restored after simulated remote rename path",
    psql(`
      SELECT COALESCE(to_regclass('public.note_proposals_project_created_idx')::text, '')
    `).includes("note_proposals_project_created_idx")
  );
}

function main() {
  console.log(
    "=== Migration 027 baseline reconciliation verification (local only) ==="
  );
  DB_CONTAINER = resolveLocalDbContainer();
  psql("SELECT 1");

  testConstraint();
  testIndex();
  testIdempotentReapply();

  if (process.exitCode && process.exitCode !== 0) {
    console.log("\nMigration 027 verification FAILED");
    process.exit(1);
  }
  console.log("\nMigration 027 verification PASSED");
}

main();
