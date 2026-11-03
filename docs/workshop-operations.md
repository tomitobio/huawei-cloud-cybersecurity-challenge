# Workshop Operations Runbook

Facilitator guide for running the **Huawei Cloud Cybersecurity Challenge** live, plus
how to author your own scenarios. This is a tabletop business simulation — there are no
real attacks and no live Huawei Cloud integration. All data is fictional.

Audience: instructors and administrators.

---

## 1. Roles and access

| Role | Access |
| --- | --- |
| **Admin** | Everything, including all instructors' sessions |
| **Instructor** | Own sessions: console, presentation, report, scenario editor |
| **Captain** | Team workspace, submits the final decision |
| **Participant** | Team workspace, can propose and vote |
| **Audience** | Read-only public view via a token link |

Demo accounts (seeded, fictional): `instructor@hcc.local` / `Instructor123!` and
`admin@hcc.local` / `Admin123!`.

---

## 2. Pre-flight checklist (before the room)

1. **Start the stack.** For local/dev: `npm run dev` (API `:4000`, web `:5173`).
2. **Check health.** Open the app and confirm the login page loads. `/api/health`
   returns `{ "ok": true }`.
3. **Create the session.** *Sessions → New session*: name it, pick a scenario, list the
   teams (one per line). Optionally set a **seed** to make the run reproducible; leave it
   blank for a random one (shown afterwards on the session and in the console/report).
   The console opens automatically.
4. **Collect the codes.** The console shows a **session code**, a **join code per team**,
   and an **audience link**. Share team codes with each team; share the audience link
   with the room/projector.
5. **Dry run (optional).** Use the **scenario editor → Preview** to simulate the chosen
   scenario and confirm the flow before the room arrives.

### Ports

- Publish **only 5173** for the web app (it proxies the API and WebSockets server-side).
- `4000` is optional (direct API access, e.g. Postman).
- **Never expose `5432`** (PostgreSQL) — it should listen on localhost only.

For external testing, open port `5173` in the provider's security group and browse to
`http://<public-ip>:5173`. Vite accepts any host (`allowedHosts: true`) and the API
reflects the request origin outside production.

---

## 3. Running the live session

The instructor drives the pace from the **console** (`/sessions/:id`).

1. **Release the round** (*Liberar siguiente evento*). This sets the session `ACTIVE`
   and starts the round deadline. **Until you release, teams cannot select options** —
   they will see *"the instructor must start the round"*.
2. Teams decide. Only the **captain** presses **Submit final decision**; others may
   **Propose** / **Vote**. You will see each team's *pending/submitted* state.
3. **Resolve the round** when teams are done. If some teams have not responded you can
   **force** resolution; non-responders receive a small penalty and advance.
4. Repeat: **release → decide → resolve** for each event. Releasing again opens the next
   event (round counter increments).
5. **Reveal Security Insights** at chosen moments (one per relevant service). Insights
   are educational product cards and are **separate from scoring**.
6. **Presentation mode** (`/sessions/:id/present`) mirrors the leaderboard for the room.
7. At the end (or any time after the last round) generate the **report** from the console.

Useful controls: **Pause/Resume** (freezes the room), **Set deadline** (reset the
timer), **End** (finish early). All instructor actions are written to the audit log.

### Timing tips

- Typical pace: ~5–8 minutes per event. Set generous deadlines (e.g. 5–10 min/round)
  and use *force resolve* if a team is stuck.
- Announce when a round is released and when it resolves; teams only have the current
  event, never future ones.

---

## 4. Team experience

- Participants join at **/join** with their team code, a display name and a role.
- The workspace shows the current event, intelligence, business impact, available
  actions (with cost and control tags), the team's metrics/budget, the public
  leaderboard and a timeline.
- **Options are only selectable while the session is `ACTIVE` and the round is open.**
  Banners explain LOBBY / PAUSED / expired-deadline states.
- If the app is refreshed mid-session, the team returns to its team id (stored locally).

---

## 5. Authoring scenarios (scenario editor)

Go to **Scenarios** in the navigation (`/scenarios`).

- **New** creates a scenario from a minimal valid template.
- **Duplicate** copies *any* scenario (including built-ins) into an editable custom one.
- The **metadata** panel edits key, names (ES/EN), summary, organization, budget,
  maturity and scoring **weights** (normalized server-side).
- The **events** panel is a JSON array. Each event requires:
  `id`, `round`, `phase`, `title`, `narrative`, `options`; and optionally
  `next`, `transitions`, `intel`, `businessImpact`, `controlsInPlay`, `insightKey`,
  `instructorNotes`. Each option requires `id`, `label`, `description`, `cost`,
  `controls`; and optionally `requires`, `grantsFlags`, `removesFlags`, `immediate`,
  `delayed`, `scoreDelta`, `riskLevel`, `risks`.
- **Validate** surfaces schema/engine problems (unknown `next`/`goto`, duplicate ids,
  unreachable events, etc.).
- **Preview** plays the scenario start-to-finish and lists each step, budget and score.
- **Save** persists it. Built-in scenarios are read-only.

### Modeling guidance

- Keep 6–8 events; 1–2 real branch points; make each option a defensible trade-off.
- Use `requires: { hasFlag: 'x_funded' }` to gate options on prior investment, and
  `grantsFlags` to record it. A funded control flag uses the pattern `<CONTROL>_funded`
  (e.g. `cbh_funded`) so coverage counts work.
- Use `immediate` for this round's effect and `delayed` for the next round's effect.
- **Do not bias scoring toward a product.** Reward sound risk management; keep product
  claims to the official documentation referenced in the catalog.

### Deletion rules

- Custom scenarios can be deleted unless an existing session uses them (then the API
  returns `409 CONFLICT`).
- Built-in scenarios can never be edited or deleted.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Teams cannot select options | Session in LOBBY/PAUSED or round not released | Release the round (console) |
| "Cannot resolve: pending teams" | A team has not submitted | Wait, or use **Force resolve** |
| Option greyed out — *Requires prior investment* | Its `requires` flag is not set | That is intended; choose a different path |
| Option greyed out — *Insufficient budget* | Team spent too much earlier | Intended trade-off |
| `STALE_STATE` (409) on submit | State changed since load | Refresh and resubmit |
| Page unreachable from another machine | Security-group port closed | Open TCP **5173** only |
| `scenario is used by existing sessions` on delete | Scenario referenced by a session | Keep it, or remove the sessions first |
| API logs database auth errors | `.env` credentials wrong | Verify `DATABASE_URL` in `apps/api/.env` |

Logs: API `/tmp/api.log`, web `/tmp/web.log` (when started via the helper scripts).

---

## 7. Data, privacy and safety

- All organizations, incidents, telemetry and results are **fictional**.
- The engine is **deterministic and replayable**: same seed + same decisions => same
  results, fully explainable from recorded `MetricChange` rows. Scenarios may opt into
  reproducible variability via a per-option `variance` factor (default `0` = no change);
  the session's single **seed** drives it, so all teams in a session share the same
  instance and a run can be reproduced later from the seed shown in the report.
- No real exploits, malware or attack tooling is used or distributed.
- Product claims link to official Huawei Cloud documentation; limitations are stated.
