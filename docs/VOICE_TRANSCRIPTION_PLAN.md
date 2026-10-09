# Voice transcription plan

**Status:** Deferred. Not in the current release candidate.  
**Written:** 9 October 2026, from the read-only voice-transcription audit.  
**This file does not implement the feature.** It does not change application code, migrations, environment variables, provider configuration, deployments, or Production.

Production remains **NO-GO**. The reasons are in [RELEASE_CANDIDATE_INVENTORY.md](./RELEASE_CANDIDATE_INVENTORY.md). This plan does not reopen them and does not clear that decision.

## 1. Status and purpose

The goal, when an owner later prioritises it, is a short voice path for the job description:

1. Record a short description of the work.
2. Transcribe it.
3. Let the builder edit the transcript.
4. Explicitly **Add** or **Replace** text in the existing Job description field.

Transcription alone must not save a project, run Analyse job, create Work Areas or facts, or affect Estimate, Pricing, Quote, RFQ, Variation, rates, or snapshots.

The builder-approved text is ordinary job-description text. It uses `projects.brief_text` and the save path that already exists for typed text.

## 2. Existing integration points

The live brief-stage input is `ProjectCaptureBlock`, with the text held in `AssistantShell` as `briefText`. `components/assistant/BriefInput.tsx` is unused: nothing imports it. Do not attach the recorder to `BriefInput`.

| Piece | Where | What it does today |
| --- | --- | --- |
| Job description field | `components/assistant/ProjectCaptureBlock.tsx` | Textarea `#project-brief`. `onBlur` calls `onBriefPersist` unless the field is disabled or already submitted. |
| Brief state | `components/assistant/AssistantShell.tsx` | `briefText`. `briefSubmitted` is true once the stage is `confirm_work_areas` or later. |
| Blur save | `persistJobDescription` in `AssistantShell` | Calls `saveJobDescription` when the trimmed text changed and no assistant action is pending. There is no timer. |
| Brief save | `saveJobDescription` in `lib/projects/actions.ts` | Updates `projects.brief_text` only. Does not analyse and does not change stage. Cap is 5,000 characters. Requires `projects.edit` and entitlement `projects.create`. |
| Validation | `brief_text` in `lib/projects/schema.ts` | Trimmed string, maximum 5,000 characters. The column is `text` from `supabase/migrations/001_initial.sql`. |
| Analyse job | `handleAnalyseJob` in `AssistantShell` | Calls `saveBriefAndSeedWorkAreas(project.id, briefText)` in `lib/assistant/actions.ts`. |
| Stage gate | `canRunStageAction(stage, "save_brief")` in `lib/assistant/stage.ts` | True only while the stage is `brief`. |
| First analysis read | `buildInitialAnalysisInput` then `extractFromBrief` | Runs inside `saveBriefAndSeedWorkAreas` after that function writes `brief_text`. The provider is Anthropic. |

`saveBriefAndSeedWorkAreas` is the analysis boundary. After it writes the brief, it sends the brief plus site notes to Anthropic, inserts suggested Work Areas, inserts `ai_extracted` facts and constraints, and sets the project stage to `confirm_work_areas`. Confirming Work Areas is a later, separate action (`confirmWorkAreas`).

Creating a job does not collect this text. `NewProjectDialog` calls `createProject` with title, customer, and address. `brief_text` starts null.

### Why the recorder stays beside the brief-stage textarea

Show the recorder only inside `ProjectCaptureBlock` while `submitted` is false, which is while the stage is still `brief` and the textarea is editable.

After Analyse job, that textarea is read-only and `onBriefPersist` is removed. The Edit Project dialog (`components/projects/EditProjectDialog.tsx`) can still change “Brief / description” through `updateProject`. That save writes `projects.brief_text` without running Analyse job. The saved brief is later read by the job plan, deck relevance, scope discovery, and RFQ draft facts. `updateProject` also refreshes client name and site address on draft and reviewed pricing documents. A recorder in Edit Project would sit on that broader save, after analysis has already happened. Phase 1 does not put one there.

## 3. Proposed data flow and storage

```
Browser microphone
  → temporary recording in browser memory
  → authenticated Quotr endpoint
  → server-side transcription provider
  → editable transcript in the browser
  → explicit Add or Replace into the Job description field
  → existing blur save (`saveJobDescription`) when that field blurs
```

Phase 1 proposes no persistent raw-audio storage. No audio table, no storage bucket, and no new migration for audio. `voice_to_text` on project notes is a source label only. Do not create a note from the recording. The project-documents bucket does not allow audio and keeps files permanently. Do not use it.

The audio does leave the browser. Quotr receives it for the length of one request and sends it to the transcription provider. Quotr does not keep the audio after the response. The transcript stays in browser memory until the builder adds it, replaces with it, or discards it.

Add and Replace change the Job description field. They do not call `saveBriefAndSeedWorkAreas`. The field then saves through its normal blur behaviour: `persistJobDescription` → `saveJobDescription`. If Add or Replace does not blur the textarea, the implementation must call that same save so the merged text is not left only in memory. That save still must not analyse.

No account-specific provider retention setting was verified. The 9 October 2026 audit read OpenAI’s public data-controls page, and Quotr has no OpenAI project. This plan does not claim a retention period. Before launch, re-read the provider’s current policy and decide what Quotr is allowed to say.

### Privacy copy required before launch

There is no privacy policy in this repository. The public marketing site is outside it. Before any builder can record:

- The in-product disclosure in section 6 must be visible on the recorder before recording starts.
- The owner must decide the public privacy wording, including on any policy that lives outside this repository, so it matches the flow above: audio is sent for transcription, raw audio is not stored on the project, and approved text is stored as the job description.
- Do not write copy that says the audio never leaves the device.

## 4. Authority and protection

The transcription endpoint checks all of the following before it reads the audio into a provider call:

| Check | Rule |
| --- | --- |
| Authenticated user | Same session pattern as other project actions: `supabase.auth.getUser()`, then the organisation on that user’s profile. Never trust a client-supplied organisation id. |
| Tenancy | The project row belongs to that organisation. Ignore a deleted project when lifecycle columns exist, matching `saveJobDescription`. |
| Permission | `projects.edit`. Viewers do not have it. |
| Billing entitlement | `projects.create`, the same entitlement `saveJobDescription` already requires. |
| Voice entitlement | `voice_capture`. It is already on Builder, and therefore on Business, the no-card trial, and the custom default catalogue. No current code checks it. The endpoint must. Do not change the plan matrix to add or remove it. |

The endpoint returns text only. It does not insert or update projects, Work Areas, facts, constraints, estimates, pricing, quotes, RFQs, variations, rates, or snapshots. It does not call `saveBriefAndSeedWorkAreas`, `confirmWorkAreas`, or `updateProject`.

### File validation

- Accept only a single audio part whose MIME type was actually produced by `MediaRecorder`.
- The measured desktop type is `audio/webm;codecs=opus`. Treat other types, including `audio/mp4`, as unaccepted until the mobile checks in section 5 pass and a provider decode test succeeds.
- Reject audio larger than **2,097,152 bytes**.
- Reject audio smaller than **1,024 bytes**. An immediate stop on the measured browser produced a 110-byte header.
- Set the uploaded filename from the container (`.webm` or, later, `.mp4`). Do not invent a `.wav` name.
- The client should stop at 90 seconds and may request 32,000 bit/s. Those are advisory. The server byte cap is authoritative.

### Logging, timeout, and errors

Log status, byte count, claimed duration, latency, and an error class. Do not log the audio, the transcript, the job description, the provider request body, or the provider response body.

Existing Analyse job logging is a warning, not a template. A brief JSON parse failure can put 120 characters of the model reply into `logBriefAnalysisFailure`, and site-note failures can log 300 characters of the model reply. The transcription path must not do that.

Bound the route with its own timeout, shorter than the project page’s 120-second `maxDuration`. On timeout, provider failure, or an empty transcript, return a generic message and leave the job description unchanged. Release the microphone tracks and the blob on stop, cancel, success, failure, and unmount.

### Usage limits and telemetry

There is no Quotr rate limit on Analyse job today. A provider HTTP 429 is retried inside the Anthropic client. Do not copy that retry onto transcription without a cap.

Limits must work across serverless instances. An in-memory counter on one instance is not a limit. Before the provider call, read a shared record for the signed-in user and a shared record for the organisation. Reject when either is over its cap, and reject when a request for that user is already in flight. Fail closed if the shared record cannot be read. The numeric caps are an owner decision when work restarts. This document does not set them.

Telemetry may store aggregate counts, success or failure, latency, byte size, provider name, model name, and the provider’s reported usage units. It must not store audio or transcript content.

`public.ai_usage_events` cannot take this telemetry as it stands. Migration `039_ai_usage_events.sql` allows features `analyse_job`, `analyse_notes`, and `scope_discovery`, and allows provider `anthropic` only. Inserting an OpenAI transcription row would violate that check. Do not write one. When work resumes, choose a design on purpose: widen that table with a migration, or store the aggregates somewhere else. Either choice is a separate decision. It is not required to store the audio, and it is not part of this documentation commit.

## 5. Transport findings and unresolved device checks

Measured on 9 October 2026 with Headless Chrome 154.0.8037.98 on Windows. A fake microphone looped a local disposable speech file. The audio was not uploaded. Mobile Safari and mobile Chrome were not available.

`MediaRecorder.isTypeSupported` on that Chrome:

| Type | Supported |
| --- | --- |
| `audio/webm;codecs=opus` | yes |
| `audio/webm` | yes |
| `audio/mp4` | yes |
| `audio/mp4;codecs=mp4a.40.2` | yes |
| `audio/ogg;codecs=opus` | no |
| `audio/wav` | no |
| `audio/mpeg` | no |

The 90-second recording that was actually produced used `audio/webm;codecs=opus` at 128,000 bit/s.

| Duration | Blob size |
| --- | --- |
| 30 seconds | 408,963 bytes |
| 60 seconds | 819,012 bytes |
| 90 seconds | 1,224,789 bytes |

A separate 3-second request for `audio/mp4` produced `audio/mp4;codecs=opus` at 48,459 bytes. A 10-second take that requested 32,000 bit/s was 35,706 bytes. Scaling that 10-second take suggests roughly 321 KB at 90 seconds. That scale is not a 90-second measurement.

Vercel documents a **4.5 MB** maximum function request body. A body over that limit returns 413 `FUNCTION_PAYLOAD_TOO_LARGE`. The Next.js `serverActions.bodySizeLimit` of `16mb` in `next.config.ts` does not raise Vercel’s limit. The measured 90-second blob is about 1.22 MB, so one multipart request fits, with the 2,097,152-byte audio cap leaving headroom under 4.5 MB.

The client stop at 90 seconds and the requested bitrate are advisory. A caller can lie about duration or ignore the bitrate hint. The server rejects audio over 2,097,152 bytes.

### Still required before mobile sign-off

- A real iPhone Safari recording: `MediaRecorder.isTypeSupported`, the blob’s actual MIME type, and sizes at 30, 60, and 90 seconds.
- A real Android Chrome recording with the same checks.
- A provider decode of those real blobs, including Chrome’s `audio/mp4;codecs=opus` if that type is still a candidate.
- Confirmation that each accepted blob stays under the server byte cap.

No temporary upload bucket is part of Phase 1. Add one only if those device checks show that a bounded direct request is unreliable. If that happens, it is a separate design: a private object keyed by organisation, project, and a random id; a short-lived signed upload; the same auth and tenancy checks; deletion on success, failure, and timeout. Do not reuse the permanent project-documents bucket.

## 6. UX states

The control has eight states: **Record**, **Stop**, **Transcribing**, **Edit**, **Add**, **Replace**, **Retry**, and **Cancel**.

Existing Job description text is kept unless the builder confirms Replace. Add appends the edited transcript after a blank line when the field already has text. Replace shows the resulting text and asks for confirmation before it changes the field. When the field is empty, Add and Replace both place the edited transcript into it, and Replace still shows that result before it is applied.

The builder must check quantities, units, names, and products in the transcript before approving it. The transcript is a draft, not a fact.

Disclosure, visible before recording:

> Your recording is sent for transcription and is not saved to this project. Review the text before adding it to the job description.

| Situation | Result |
| --- | --- |
| Microphone permission denied | Explain that recording needs permission. Do not send a request. |
| Unsupported recorder or MIME type | Say this browser cannot record a job description. Do not upload. |
| Silence or an empty transcript | Say no speech was captured. Leave the job description unchanged. |
| Recording under 1,024 bytes, or stopped immediately | Treat it as too short. Leave the job description unchanged. |
| Over 90 seconds or over 2,097,152 bytes | Stop or reject it. Do not call the provider for an oversized body. |
| Timeout or provider failure | Say transcription did not finish and the description is unchanged. Offer Retry. |
| Navigate away | If a transcript has not been added or replaced, warn before unload. Always stop microphone tracks and release the blob. |
| Second submit while one request is open | Ignore the second click. The shared in-flight limit in section 4 covers a second instance. |
| Resulting text over 5,000 characters | Refuse Add and Replace. Show that the job description cap is 5,000 characters. Do not call `saveJobDescription` with an over-long value. |

Cancel discards the recording and the unapplied transcript. Retry starts a new recording. Neither writes the project.

## 7. Provider and future implementation

OpenAI file transcription is the proposed Phase 1 provider because the Anthropic integration Quotr uses for Analyse job does not transcribe audio. On 9 October 2026, `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` were present for Preview. `OPENAI_API_KEY` was not present in local `.env.local` or on the Vercel project. No Deepgram, AssemblyAI, or Groq variable was present either. Reconfirm names only when work resumes. Do not record secret values in this file or in logs.

Model choice is a proposal to revalidate, not a decision that survives a price change. On that date, OpenAI’s file-transcription guide said to start with `gpt-transcribe`, and the pricing page listed estimated per-minute figures for that model and for `gpt-4o-mini-transcribe`. Those figures are not a Quotr price. Before implementation, re-read the official model list, the formats those models accept, the current pricing, and Quotr’s own provider project, spending limit, and region setup. Prefer the measured `audio/webm;codecs=opus` path unless that review says otherwise.

### Likely files

- `components/assistant/ProjectCaptureBlock.tsx`, or a small component rendered only from there.
- `components/assistant/AssistantShell.tsx`, only if Add or Replace must call the existing `persistJobDescription`.
- A new authenticated route for the audio request.
- A server-only helper that calls the provider and returns text.
- `lib/env.ts` and `.env.local.example`, for the variable name, when a key is actually introduced.
- A static verifier that the new code does not import estimate, pricing, quote, RFQ, variation, or `saveBriefAndSeedWorkAreas`.
- Whatever shared usage-limit store the restart decision chooses. That may be a migration. It is not this commit.

Leave `saveBriefAndSeedWorkAreas`, Estimate, Pricing, Quote, RFQ, Variation, rate resolution, and snapshots unchanged.

### Staged implementation

1. Owner prioritises the feature and sets the provider project, key, and spending controls on Preview only.
2. Decide the public privacy wording and confirm the in-product disclosure.
3. Decide the cross-instance user and organisation caps, and how aggregates are stored without audio or transcript text.
4. Revalidate the model, formats, and price against current official documentation.
5. Build the endpoint and the brief-stage recorder. Do not deploy Production.
6. Run the QA checklist below on desktop Chrome, then on a real iPhone and a real Android phone, using disposable speech.

### QA checklist

- Record, stop, and edit a transcript. The project row is unchanged until Add or Replace.
- Add on an empty description saves through `saveJobDescription`, and the stage stays `brief`.
- Add on typed text keeps the typed text and appends the transcript after a blank line.
- Replace cancel leaves the typed text. Replace confirm shows the resulting text, then replaces the field with the edited transcript only.
- A resulting value over 5,000 characters is refused.
- Analyse job is still the only action that creates suggested Work Areas and `ai_extracted` facts.
- Estimate, Pricing, Quote, RFQ, Variation, rates, and snapshots gain no rows from recording alone.
- Denied microphone, unsupported type, silence, short audio, oversized audio, timeout, and provider failure leave the description unchanged and release the microphone.
- Two quick submits do not send two provider calls.
- Logs contain no audio, transcript, or provider body.
- Leaving the page during Transcribing or Edit warns, then releases tracks and the blob.
- Production is not deployed and not migrated.

## 8. Release boundary

Observed immediately before this file was added:

| Fact | Value |
| --- | --- |
| Branch | `ui/core-workflow-overhaul` |
| HEAD | `981274818e8977097422979e0488ae8bce75bcda` |
| Working tree | clean |
| Remote | ahead 1, and that inventory commit was not pushed |
| Application candidate | `1cfa7d24a437f8955143d100083d6e93eaab115e` |
| Inventory commit | `981274818e8977097422979e0488ae8bce75bcda` |

The application candidate is the parent of the inventory commit. Preview schema **107** is the last verified database head for that pair. The voice audit did not re-list hosted Preview. Local migration files still end at `107_rfq_price_notification.sql`.

This document is not the application candidate. Adding it moves HEAD by a documentation commit only. It does not change the candidate SHA, the Preview deployment, or the Production NO-GO.

Schema, deployment, domain, and Production findings stay in [RELEASE_CANDIDATE_INVENTORY.md](./RELEASE_CANDIDATE_INVENTORY.md). Do not copy them here.

### Conditions to restart

Restart only when all of these are true:

- An owner prioritises the feature ahead of the current release candidate.
- A transcription provider project exists, with a key and a spending control, on Preview only.
- The privacy-copy decision in section 3 is made, including any policy outside this repository.
- The cross-instance per-user and per-organisation usage limits, and the aggregate telemetry design, are chosen. `ai_usage_events` is not written until that design allows the provider.
- Real iPhone Safari and Android Chrome devices are available for the checks in section 5.

Until then, voice transcription stays deferred.
