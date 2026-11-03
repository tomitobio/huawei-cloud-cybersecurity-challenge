# Gameplay UI Review — Screenshot Findings & Fixes

Manual UI/UX review of the reworked game layer, done by capturing real screenshots
with Playwright against the running app (API on :4100, web on :5273) and walking the
instructor + member + audience flows. This note records what was found and what was
fixed. All content is fictional.

## How the screenshots were produced

- Stack: repo API (`npm run start -w @hcc/api`, `PORT=4100`) + web
  (`API_TARGET=http://localhost:4100 WEB_PORT=5273 npm run dev -w @hcc/web`) against the
  `hcc_test` database, seeded with `db:seed`.
- Scripts: `/tmp/shot/capture*.js` (Playwright). Flows captured: home, login, sessions,
  instructor console, presentation, scenario list, scenario editor, join, team workspace
  (round 1 & round 2 with signals/hypotheses), audience, admin.
- Round 2 (ambiguous signals + investigation) was reached by releasing round 1, submitting
  a decision and force-resolving; the member page then advances via socket/polling.

## Issues found and resolved

1. **Auth redirect race on `/team/:id` (critical).**
   On a full page reload while authenticated, `user` was `null` on the first render and the
   effect redirected to `/join`, kicking logged-in members out of their team (broke
   "refresh mid-round"). Fixed by waiting for the auth `loading` flag before redirecting
   (`TeamWorkspace.tsx`).

2. **Round badge mismatch.**
   The header showed `session.currentRound` (e.g. `R1`) while the event card showed the
   prepared next event (`R2`). Fixed to display the event's round (`event.round`).

3. **Scenario name shown in English in the sessions list.**
   The list rendered the raw English name even in Spanish UI. Fixed to resolve the
   localized scenario name from the already-loaded scenario catalog (`InstructorSessions.tsx`).

4. **Budget confusion (60 vs 80).**
   The intel says "initial budget 60" but the live budget shows 80 because the round-1
   income is applied immediately. Kept the economy rule (income every round incl. R1) but
   added a UI hint: "+{income} per-round income". Requires the workspace payload to expose
   `incomePerRound` / `budgetStart` (`game.ts`, `types.ts`).

5. **Investigate cards were opaque.**
   Cards with `kind:'investigate'` gave no hint of effect. Added chips showing
   "Reveals N signal(s)" and "+X% clarity" so players understand the ambiguity mechanic.

6. **`delayed` chips leaked raw metric keys** (`continuity +8`). Localized via `metrics.*`.

## Minor / notes (not changed)

- Scenario titles truncate in the editor list (cosmetic; full values editable in the form).
- `Admin > Users` is empty for instructors (the users API is ADMIN-only → 403); expected.
- `/` renders the Join form directly (participant landing); acceptable by design.
- Metric label font weight can look uneven at some zoom levels; no functional impact.

## Verification

- `npm run typecheck` OK; web `tsc --noEmit` OK.
- Tests: shared 59, api 29, web 14 — all green.
- Re-captured screenshots confirm: no redirect on reload, `R2` badge matches the event,
  localized scenario names, budget hint present, investigate/clarity chips localized
  ("Reveals 1 signal" plural correct in both ES/EN).
