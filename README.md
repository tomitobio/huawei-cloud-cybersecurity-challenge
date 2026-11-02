# Huawei Cloud Cybersecurity Challenge

Instructor-led, competitive cybersecurity simulation platform inspired by tabletop
business-crisis workshops (KIPS-style gameplay), adapted to demonstrate the value of
Huawei Cloud security services.

> **This is a tabletop business simulation, not a cyber range.** There is no real
> exploit execution, malware, attack tooling or live Huawei Cloud integration. All
> incidents, telemetry, organizations and results are **fictional and simulated**.

---

## Purpose

Multiple customer teams compete under the same scenario rules. Each team allocates a
limited budget, makes security decisions, and sees the business consequences of those
decisions. The instructor drives the scenario from a single console and reveals Huawei
Cloud *Security Insights* at chosen moments. A post-workshop report supports the customer
debrief.

Services represented: **HSS, CFW, WAF, DEW, CBH, SecMaster**.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js 20 + TypeScript + Express |
| Database | PostgreSQL 16 + Prisma |
| Realtime | Socket.IO |
| Tests | Vitest (+ Supertest for API integration) |
| Deploy | Docker Compose (optional) |

Architecture is a **modular monolith**. The simulation engine lives in a shared,
dependency-free package so the same scenario can be replayed with different teams and
starting conditions.

```
.
├─ apps/
│  ├─ api/       Express + Prisma + Socket.IO  (src/modules: auth, sessions, engine glue, reports)
│  └─ web/       React SPA (instructor / team / presentation / audience modes)
├─ packages/
│  └─ shared/    Pure types, Zod schemas, deterministic simulation engine, scoring, product catalog
├─ scenarios in packages/shared/src/scenarios/  (data, not code)
├─ prisma/       schema + migrations + seed
└─ docker-compose.yml, Dockerfile, deploy/nginx.conf
```

---

## Prerequisites

- Node.js **20+**
- PostgreSQL **16+** (running locally) — or Docker

---

## Local setup (without Docker)

```bash
# 1. Install dependencies (npm workspaces)
npm install

# 2. Create the database and user
sudo -u postgres psql -c "CREATE USER workshop WITH PASSWORD 'workshop' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE huawei_cyberchallenge OWNER workshop;"

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
#   -> edit DATABASE_URL / JWT_SECRET if needed

# 4. Apply migrations, generate the Prisma client, seed fictional data
npm run db:migrate -w @hcc/api      # or: npm run db:generate && npx prisma migrate deploy
npm run db:seed

# 5. Run API (port 4000) and web (port 5173) together
npm run dev
```

Open <http://localhost:5173>.

### Demo accounts (seeded, fictional)

| Role | Email | Password |
| --- | --- | --- |
| Instructor | `instructor@hcc.local` | `Instructor123!` |
| Administrator | `admin@hcc.local` | `Admin123!` |

The seed also creates a **demo session** with three teams and prints their join codes.

---

## Running a workshop

1. **Instructor** signs in → *Sessions* → creates a session (scenario + teams).
2. Participants open **/join**, enter their **team code**, pick a name and role
   (*Captain* or *Participant*).
3. Instructor opens the **console**: starts, releases the next event, sets deadlines,
   resolves rounds (with optional force), reveals *Security Insights*.
4. **Presentation mode** (`/sessions/:id/present`) is a projector-friendly view.
5. **Audience link** (`/audience/:token`, shown in the console) is a read-only public view.
6. At the end, generate the **report** (print-friendly / PDF via the browser).

Only the **captain** submits the final decision. Any member can propose and vote.

---

## Tests

```bash
npm test          # shared + api + web
```

Coverage highlights:
- **Engine** (`packages/shared`): init, requirements, budget guards, flags,
  branching (transitions), delayed effects, full playthrough, transparent scoring,
  scenario validation, deterministic playthrough simulation (`simulatePlaythrough`).
- **Scenario library** (`packages/shared`): all built-in scenarios validate, are fully
  reachable, localized (ES/EN) and playable to completion; branching paths asserted.
- **API** (`apps/api`): authorization (401/403), team isolation, instructor-only
  console, captain-only submission, optimistic concurrency (`STALE_STATE`),
  pending-team resolution guard, event progression, leaderboard, report, audit log,
  audience privacy, and the scenario editor (list/get/validate/preview/create/update/
  delete, invalid-definition rejection, built-in protection).
- **Web** (`apps/web`): shared formatting/UI helpers.

---

## Docker (optional, for events)

```bash
docker compose up --build
# web on http://localhost:8080   api on http://localhost:4000
```

> Docker is provided as a deployment artifact. In the development VM used to build this
> project, Docker was not available, so the stack was validated with local PostgreSQL +
> Vite instead.

---

## How scoring works (transparent)

Seven metrics (0–100): `continuity`, `riskReduction`, `customerTrust`, `financial`,
`governance`, `responseQuality`, `efficiency`.

```
finalScore = Σ (weight_i · metric_i) / Σ weight_i  +  Σ decision.scoreDelta
```

Weights are configurable per session. Every delta is recorded (`MetricChange`) so the
instructor can explain **why** a team won. **Points are never awarded for choosing a
Huawei product** — only for appropriate risk management. Product insights are kept
separate from scoring.

---

## Scenario library

Three instructor-ready scenarios ship with the app, all as data under
`packages/shared/src/scenarios/` (no engine changes required):

| Key | Title | Focus | Events |
| --- | --- | --- | --- |
| `ransomware-retail` | **A — Ransomware & Business Continuity** | HSS, CFW, SecMaster (+ DEW/CBH) | 7–8, 2 branches |
| `webapp-travel` | **B — Public web application under pressure** | WAF, CFW, HSS, SecMaster | 8, outage branch |
| `privileged-access-health` | **C — Protecting privileged access in healthcare** | CBH, DEW, SecMaster, HSS | 8, breach branch |

Every scenario is bilingual (ES/EN), uses fictional organizations/telemetry, and is
validated by the engine (`validateScenario`) and by automated tests (validity,
reachability, localization and full playthrough).

### Adding a scenario

1. Create a file in `packages/shared/src/scenarios/` exporting a `Scenario`.
2. Register it in `packages/shared/src/scenarios/index.ts` (`SCENARIOS` map).
3. Run `npm test -w @hcc/shared` — the library tests check it automatically.

---

## Scenario editor (custom scenarios)

Instructors can author and test their own scenarios without touching code.

- **UI**: *Scenarios* in the top navigation (`/scenarios`). List of built-in + custom
  scenarios, a structured metadata form (key, names, budget, maturity, weights) and a
  JSON editor for events.
- **Duplicate** any scenario to start from a working example; **New** starts from a
  minimal valid template.
- **Validate** runs the same checks as the engine; **Preview** simulates a full
  playthrough and shows each step, resulting budget and the final score.
- **Save** upserts a custom scenario; built-in scenarios are read-only (protected
  server-side).

Backend endpoints (`apps/api/src/routes/scenarios.ts`, service
`apps/api/src/services/scenarioStore.ts`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/scenarios` | List built-in + custom scenarios |
| GET | `/api/scenarios/:key` | Full definition + validation problems |
| POST | `/api/scenarios/validate` | Validate a payload without saving |
| POST | `/api/scenarios/preview` | Simulate a playthrough (`key` or inline `scenario`) |
| POST | `/api/scenarios` | Create/replace a custom scenario |
| PUT | `/api/scenarios/:key` | Update a custom scenario |
| POST | `/api/scenarios/:key/active` | Enable/disable a custom scenario |
| DELETE | `/api/scenarios/:key` | Delete a custom scenario (blocked if in use) |

Custom scenarios are stored as `Scenario` rows in the database and can be used to create
sessions exactly like built-ins. A key that exists in the built-in registry always wins,
so code-defined scenarios cannot be shadowed or overwritten.

---

## Product governance

Product claims are anchored to official Huawei Cloud documentation (verified to resolve):

- HSS — https://support.huaweicloud.com/intl/en-us/hss2.0/index.html
- CFW — https://support.huaweicloud.com/intl/en-us/cfw/index.html
- WAF — https://support.huaweicloud.com/intl/en-us/waf/index.html
- DEW — https://support.huaweicloud.com/intl/en-us/dew/index.html
- CBH — https://support.huaweicloud.com/intl/en-us/cbh/index.html
- SecMaster — https://support.huaweicloud.com/intl/en-us/secmaster/index.html

Capabilities that depend on edition/region/configuration are labelled. Limitations are
stated explicitly (e.g. DEW does not prevent compromised identities; WAF is not a
universal solution).

---

## Security notes

- Server-side authorization on every privileged route; team-private data is never
  leaked to other teams or to the audience.
- Inputs validated with Zod; rate limiting on auth and API.
- Secrets via environment variables; audit log for instructor actions.
- No real attacks, no changes to any Huawei Cloud resource.

---

## Current limitations

- Deep analytics/dashboards beyond the post-workshop report are not implemented.
- Team creation uses join codes; there is no email invitation flow.
- Scenario authoring edits events as JSON (metadata has a structured form); there is no
  drag-and-drop event builder.
- Variable outcomes use a deterministic engine (no randomness yet) — intentional for
  reproducibility.
- Docker files are provided but were not run in the build VM (no Docker available).

---

## Further reading

- [`docs/workshop-operations.md`](docs/workshop-operations.md) — facilitator runbook:
  pre-flight, driving a live session, using the scenario editor, troubleshooting.
