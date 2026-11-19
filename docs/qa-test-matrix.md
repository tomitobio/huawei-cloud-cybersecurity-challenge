# QA / Manual Testing Guide — Deck-based Gameplay

This guide is for **manual testing + QA** of the reworked game layer (card-deck rounds,
ambiguous signals, investigation mechanics, per-round economy). All content is fictional.

- **Artifacts**
  - `docs/qa-test-matrix.csv` — one row per scenario × round with expected metadata and
    columns to record `Result(P/F/NA)`, `Observations`, `Tester`, `Date`.
  - This file — global test cases, mechanics checks and acceptance criteria.
- **Scenarios (6 × 6 rounds):** `ransomware-retail`, `webapp-travel`,
  `privileged-access-health`, `corporate-multisector`, `public-services`,
  `industrial-operations`.

---

## 1. Environment setup

1. Install deps: `npm install`.
2. Database (API requires it): set `DATABASE_URL` and `JWT_SECRET`, e.g.
   ```bash
   export DATABASE_URL="postgresql://workshop:workshop@localhost:5432/hcc_test?schema=public"
   export JWT_SECRET="test-secret-1234567890"
   ```
   Generate client / apply schema if needed: `npm run db:generate -w @hcc/api` and
   `prisma migrate deploy` (or `db:deploy -w @hcc/api`).
3. Seed demo users (if not already): `npm run db:seed -w @hcc/api`.
4. Run: `npm run dev` → web `http://localhost:5173`, API `http://localhost:4000`.
5. Demo logins: `instructor@hcc.local / Instructor123!` and `admin@admin.com / adminSOY4592`.

> Tip: pin a **seed** when creating a session to reproduce the exact same draws.

---

## 2. Global test cases

Record result (P/F/NA) and any observations. `P` = pass, `F` = fail (log a bug), `NA` = not applicable.

| ID | Area | Procedure | Expected result | Result |
| --- | --- | --- | --- | --- |
| G01 | Auth | Open app without auth, hit protected routes | Redirect/login required; API 401 | |
| G02 | Auth | Log in as instructor / admin / member | Each reaches the right area for its role | |
| G03 | Session | Create session with 2+ teams on each scenario | Session created, team join codes + audience link shown | |
| G04 | Deck | Load team workspace at R1 | Hand = **7 fixed + 5 drawn** (12 cards); fixed ids identical across all teams | |
| G05 | Deck | Compare two teams in the same session/round | Fixed cards identical; **drawn pool cards differ** between teams | |
| G06 | Deck | Advance a team to the next round | **Hand changes** each round; no pool card repeats within a team across the game | |
| G07 | Deck | Track pool size over the game | Pool = 50; 6 rounds × 5 draws = 30 distinct pool cards consumed | |
| G08 | Focus | Inspect an event with `focusTags` | Cards tagged with the focus appear more often across rounds/seeds; focus pool ≥3 cards | |
| G09 | Economy | Release R1 and read team budget | Budget = start budget + income (60 → 80). +20 added **each** round including R1 | |
| G10 | Economy | Play a full scenario spending freely | Budget stays ≥ 0; never blocked by default income; no negative balance | |
| G11 | Economy | Try a card you cannot afford | Card shows “Insufficient budget”, not selectable/submittable | |
| G12 | Premium | Find a card with the **“★ En foco”** badge | Cost is `round(base × 1.4)`, `scoreDelta` × 1.6 vs an off-focus round | |
| G13 | Investigate | Play a card with the **“🔍 Investigar”** badge on an event with signals | Target signal flips to **Confirmed**, `truth` revealed; **Claridad %** increases | |
| G14 | Ambiguity | Before investigating, view signals | Signal **text** visible, marked **Unconfirmed**; `truth` is NOT exposed in payload/UI | |
| G15 | Ambiguity | View an event that declares hypotheses | **Hipótesis** list is shown (competing explanations) | |
| G16 | Ambiguity | Verify red herrings exist | At least one event has a `false`/`partial` signal that investigation reveals as such | |
| G17 | Flow | Captain submits the final decision | Decision recorded; only captain can submit (participants propose/vote) | |
| G18 | Flow | Submit with a stale `expectedVersion` | `409 STALE_STATE`; refresh resolves | |
| G19 | Flow | Non-member submits for another team | `403` forbidden | |
| G20 | Flow | Resolve with pending teams | `409 PENDING_TEAMS`; force resolve proceeds | |
| G21 | Flow | Force-resolve a team that did not answer | Penalty applied, team advances, **next hand drawn + income added** | |
| G22 | Scoring | Compare active vs passive team after resolve | Active team scores higher; metrics stay within 0–100 | |
| G23 | Scoring | Confirm no product bias | Points come from risk management only; choosing a Huawei product alone adds no points | |
| G24 | Leak | Inspect team workspace JSON in devtools | No `instructorNotes`, no future events, no unrevealed `truth`, no other teams' rationale | |
| G25 | Leak | Open audience view (token) | Leaderboard only; no private rationale/notes | |
| G26 | Report | Generate report after a session | Ranking, disclaimer, `relevantControls.length > 0`; `budgetSpent` = Σ decision costs (never negative) | |
| G27 | i18n | Switch ES/EN across workspace/console/report | All new strings translated (Signals, Hypotheses, Clarity, In focus, Investigate, Confirmed/Unconfirmed) | |
| G28 | Editor | `GET /api/scenarios`, duplicate a built-in, Validate, Preview | Validate OK; Preview shows **6 steps**; built-ins read-only | |
| G29 | Persistence | Refresh mid-round; resume after restart | Team returns to same state/hand/version | |
| G30 | Regression | Play each scenario start→finish | Ends cleanly (`status=ended`, `currentEventId=null`), bounded score | |

---

## 3. Per-scenario round matrix

Use `docs/qa-test-matrix.csv`. For each row confirm:

1. The event loads with the listed **FocusTags** and shows **ExpectedSignals** /
   **ExpectedHypotheses** (text visible; truth only after investigating).
2. `FocusPoolCards ≥ 3` (the draw can honour the focus; validation enforces it).
3. Hand obeys G04–G07; economy obeys G09–G11.
4. Record `Result`, `Observations`, `Tester`, `Date`.

### Round content summary (from the scenario data)

| Scenario | R1 | R2 | R3 | R4 | R5 | R6 |
| --- | --- | --- | --- | --- | --- | --- |
| ransomware-retail | e1-investment | e2-host-alert (2 signals/3 hyp) | e3-spread (1/0) | e4-admin (1/2) | e5-data (1/0) | e6-recovery |
| webapp-travel | b1-investment | b2-web-alert (2/3) | b3-exploit (2/0) | b4-load (1/0) | b5-host-hunt (2/0) | b6-coord |
| privileged-access-health | c1-investment | c2-anomaly (2/2) | c3-credentials | c4-data (2/0) | c5-insider (1/0) | c6-response |
| corporate-multisector | d1-budget | d2-phish (2/2) | d3-spread (2/0) | d4-data (1/0) | d5-cred | d6-response |
| public-services | p1-budget | p2-traffic (2/3) | p3-tamper (2/0) | p4-data (1/0) | p5-host (2/0) | p6-comms |
| industrial-operations | i1-budget | i2-anomaly (2/2) | i3-ot (2/0) | i4-continuity | i5-identity | i6-recover |

Parentheses show `signals/hypotheses` counts (0 omitted).

---

## 4. Mechanics deep-dive checklist

### 4.1 Weighted draw & fairness
- [ ] Fixed set (7) is identical for all teams and every round.
- [ ] Pool draw differs per team (same seed still yields per-team variation via teamId).
- [ ] Same seed + same team reproduces the same hand across a reloaded session.
- [ ] Drawn cards never repeat within a team; pool depletes correctly.

### 4.2 Focus weighting & premium balance
- [ ] On a focus event, focus-tagged cards are over-represented vs an off-focus event.
- [ ] A `premiumOnFocus` card that hits the focus shows higher **cost** and **score** and
      the “★ En foco” badge; the same card off-focus shows base cost/score.
- [ ] It is acceptable (and expected) that a team may not receive a specific focus card in
      a given round — this is the intended variability.

### 4.3 Investigation & ambiguity
- [ ] Investigate cards exist in each scenario’s pool (6 per scenario).
- [ ] Playing an investigate card reveals its `revealsSignals` and raises clarity; clarity
      persists and slightly increases focus-card weight in later draws.
- [ ] Unrevealed signal `truth` never appears in API payloads or the UI.
- [ ] Hypothesis lists render bilingually.

### 4.4 Economy
- [ ] Income is granted once per round (idempotent on repeated loads of the same round).
- [ ] Budget is not double-applied if the workspace is reloaded without advancing.
- [ ] Spending never drives budget below 0 (affordability gate).

### 4.5 Resolution paths
- [ ] Normal `applyDecision` path advances and prepares the next hand.
- [ ] No-response / force-resolve path also prepares the next hand + income.
- [ ] Final round clears the hand and ends the game.

---

## 5. Acceptance criteria (sign-off)

The gameplay rework is ready for a live workshop when:

1. All **G01–G30** pass (or failures have waivers logged).
2. Every scenario completes start→finish with a bounded score and no runtime errors.
3. Deck invariants hold (fixed identical, pool per-team, 12-card hand, no repeats).
4. Investigation visibly reveals truth and raises clarity; truth never leaks early.
5. Economy keeps teams solvent; premium pricing visibly applies on focus.
6. No instructor-only / future / truth data appears in team or audience payloads.
7. Report and i18n render correctly in both ES and EN.

| Role | Name | Date | Result |
| --- | --- | --- | --- |
| QA lead | | | |
| Instructor (UAT) | | | |

---

## 6. Known behaviours / notes for testers

- **Budget display:** `budgetStart` (session/team config) is the pre-income figure (e.g. 60);
  the live state budget includes the first-round income (e.g. 80). Report `budgetSpent`
  is computed as the sum of decision costs, so it never goes negative.
- **Variability is intended:** different teams/rounds get different hands. Do not treat a
  “missing” focus card as a defect unless the *pool* has <3 for that tag (validation fails)
  or the premium/score/cost rules are violated.
- **Legacy scenarios:** custom scenarios authored with inline `event.options` (no
  `cards`/`deck`) still work; the workspace and report support both models.
- **Seeding:** to debug a specific bad hand, capture the session **seed** and team id and
  reproduce deterministically.
