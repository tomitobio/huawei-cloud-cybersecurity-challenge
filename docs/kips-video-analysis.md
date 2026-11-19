# KIPS “kips winter season” — Video Analysis & Mapping to Our Game

Internal research note. Mined from the public video to validate and sharpen the game
design. All insights below are from the transcript; no external/real telemetry.

## Source

- **Title:** kips winter season
- **Channel / author:** Sergey Borisov (@S3rgeyB0risov)
- **URL:** https://www.youtube.com/watch?v=z3xGeF1it4w
- **Posted:** 2016-12-02 · ~681 views · 1.24K subscribers
- **Language:** Russian
- **What it is:** a gameplay recording (with commentary) of a **Kaspersky Interactive
  Protection Simulation (KIPS)** online training. The author notes Kaspersky runs the same
  training on-site for ≈US$5,000. The video was recorded because the simulator itself was
  not shared; the author narrates the decisions and outcomes instead.

## What KIPS is (as shown in the video)

A team-based, turn-based **business + security simulation**:

- A fast-growing fictional company sells through **regional offices, field managers and a
  website**.
- Each period the company earns **US$200k** from core business under ideal conditions;
  attacker actions and wrong decisions by business/security reduce that revenue.
- **5 periods.** The winning organization is the one that **earns the most money over the
  five periods**.
- **Two resources:** a **US$250k budget for the whole game** and **100 “work-effort” units
  per period**. The most valuable measures cost a lot of effort, so you cannot do
  everything in period 1 — you must prioritise and defer.
- Each period is timed (**~10 minutes**). Teams of **2–3 people** debate threats, controls
  and actions together.
- At the start the security team only has **~14 action cards** (basic measures). Running an
  **audit or pentest** unlocks more options/knowledge — but costs time/money.
- A **press-conference window** announces global events and ranking changes; a second window
  is the **interactive simulator** where actions are chosen.
- A **post-game debrief** with the host explains what happened and what measures would have
  helped before each incident.
- **Bonus profit** is awarded for well-executed security measures (this can lift the final
  ranking — the narrator went from 23rd to 18th of 160+ European teams).

## Mined mechanics & notable moments

- **Budget vs effort tension:** even a rich team cannot execute everything because *effort*
  (100 units/period) is the real limiter. Prioritisation is the core skill.
- **Long-term vs immediate trade-off:** invest in durable controls that protect all periods,
  or firefight the incident happening right now.
- **Threat-of-the-period driven by news:** `Shellshock` vulnerability, mobile-device threats,
  `CryptoLocker`-style ransomware, `DDoS` on the remote-sales site, and **payment fraud**
  through the ERP → client-bank flow.
- **Description/tooling trap:** an auto-update system was described as covering *only
  workstations*, so the team patched Shellshock manually; later they learned it also covered
  servers (a “read-the-fine-print”/misconfiguration lesson).
- **Audit/pentest side-effects:** the pentest took a production server down, costing
  **US$10k** — a real trade-off, not a pure win.
- **Single point of failure:** relying on one bank meant that when the bank was hit, the
  company lost **~US$100k** while it was down.
- **Ransomware/extortion:** attackers stole all company correspondence and demanded a
  **US$100k ransom**; the team chose a **press release** to mitigate reputation rather than
  pay, and reputational damage stayed small.
- **Fraud control:** a **digital signature** on payment instructions successfully filtered
  forged payments (only legitimate ones went through).
- **Late reporting:** notifying police about fraud only in later periods yielded little —
  timing matters.
- **Insider/hygiene:** a sysadmin disappeared; the team rotated passwords and set traps on
  the shared payment folders; account review later found 79 discrepancies (no business
  impact that period).

## Mapping to our implementation

| KIPS mechanic | Our implementation | Status |
| --- | --- | --- |
| Turn-based periods (5) | 6 rounds per scenario (`events[].round`) | ✅ aligned |
| Money budget for whole game | `scenario.start.budget` + per-round `economy.incomePerRound` | ✅ (money only) |
| **Work-effort per period** | `economy.effortPerRound` (per-round cap) + per-card `effort` (explicit or derived) | ✅ **implemented** |
| Limited action cards; audit/pentest unlock more | `scenario.cards` pool + `requires: { hasFlag: '*_funded' }` + `kind:'investigate'` | 🟡 partial |
| News/threat-of-the-period | `event.narrative/intel` + `event.focusTags` weighting the draw | ✅ aligned |
| Revenue reduced by attacks / downtime | `financial` + `continuity` metrics feeding `finalScore` | 🟡 partial (metric, not live revenue) |
| Long-term vs immediate trade-off | `immediate` vs `delayed` effects + `premiumOnFocus` pricing | ✅ aligned |
| Team of 2–3 debates | captain submits; others propose/vote | ✅ aligned |
| Press-conference / live ranking | leaderboard, presentation mode, audience view | ✅ aligned |
| Bonus for well-executed measures | `scoreDelta` rewards sound choices (not product choice) | ✅ aligned |
| Post-game debrief | `scenario.debrief.learningObjectives/correctReasoning` | ✅ aligned (could add per-round recap) |
| Ambiguity of information | `signals` (with red herrings) + `hypotheses` + investigation/clarity | ✅ **stronger than KIPS** |

## Recommended enhancements (prioritised)

> These are proposals. Nothing here was implemented automatically — they change engine,
> schema, UI and every scenario’s cards, so they should be scheduled deliberately (ideally
> **after** the current QA baseline is signed off, or as a separate gameplay increment).

1. **✅ Implemented — Second resource — “work effort” per round (P1, highest impact).**
   Added `economy.effortPerRound` and an optional `effort` on each card; the engine
   enforces a per-round effort cap (money and effort are separate resources), the API/UI
   expose an **Effort** bar next to Budget, and selections exceeding the allowance are
   rejected (`INSUFFICIENT_EFFORT`). Effort is derived per card (service cards and
   multi-control measures cost more than quick actions) unless explicitly set.
   Add `economy.effortPerRound` and an optional `effort` cost on each card; the engine
   rejects selections that exceed the remaining effort; UI shows an **Effort** bar next to
   Budget. This reproduces KIPS’s core prioritisation tension and makes the premium cards a
   real “expensive in effort” choice, not just money.
   *Touches:* `types/schemas`, `engine.availableOptions/applyDecision`, game/report services,
   `TeamWorkspace`, all cards (assign effort), tests.

2. **Explicit per-round “revenue” tied to continuity (P2).**
   Add `economy.revenuePerRound` (e.g. 200 credits) that is added to the *financial* standing
   and reduced by downtime/incidents — makes “business impact” literal like KIPS’s US$200k.

3. **Audit/pentest meta-cards (P3).**
   A one-time `kind:'investigate'` card that grants a flag and enriches the *next* hand
   (more advanced pool cards), mirroring “14 cards → audit unlocks more”; the engine already
   supports flag-gated `requires`, so this is mostly content + a small hand-override hook.

4. **Per-round outcome recap (P4).**
   Optional `event.outcomeNarrative` shown after resolution (a mini facilitator debrief per
   round), closer to KIPS’s post-game walkthrough. Low risk, content-only.

## Notes on style fidelity

- KIPS rewards **money earned**, which maps cleanly to our `scoreDelta`/metrics; keep our rule
  “**points for risk management, never for choosing a product**” — KIPS is product-agnostic
  in the same spirit.
- KIPS’s strongest lessons (single points of failure, tooling fine-print, audit side-effects,
  late reporting) are already reflected in our cards (containment/segmentation, backup
  verification, governance/notification, credential rotation, `pay-ransom` vs `comms-transparent`).
