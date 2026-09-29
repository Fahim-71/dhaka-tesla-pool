# Dhaka Tesla Pool

**Share a seat. Split the fare. Survive Dhaka traffic.**

A ride-pooling MVP built for the RoBenDevs internship challenge. Passengers request a seat;
Jashim's three-seat, battery-powered, entirely unaffiliated "Tesla" **Bullet** picks up
everyone whose trips fit together; each passenger pays their own fair, pooled price.

| | |
| --- | --- |
| 🎥 **Demo video (6 min)** | _add Loom link_ |
| 🌐 **Live app** | https://dhaka-tesla-pool-nine-bay.vercel.app (API: https://dhaka-tesla-pool-api-gray.vercel.app/api/health) |
| 🔑 **Demo logins** | `nusrat@teslapool.test`, `rafiq@teslapool.test`, `shirin@teslapool.test` (passengers), `jashim@teslapool.test` (driver) - password `teslapool123`, or use the one-click buttons on the sign-in page |
| 🏷️ **Version** | `v1.0.0` (branch `release/v1.0.0`) |

> Free tiers sleep when idle: the first request after a quiet spell can take a few seconds
> while the serverless API and the Neon database wake up. The app shows a "waking up the
> server" banner if a request is slow.

---

## Contents

1. [The problem](#1-the-problem)
2. [Features](#2-features)
3. [Screenshots](#3-screenshots)
4. [Architecture and database](#4-architecture-and-database)
5. [How pooling works](#5-how-pooling-works)
6. [The last-seat concurrency problem](#6-the-last-seat-concurrency-problem)
7. [Tech stack and why](#7-tech-stack-and-why)
8. [Project structure](#8-project-structure)
9. [Running it](#9-running-it)
10. [Tests](#10-tests)
11. [Deployment](#11-deployment)
12. [API overview](#12-api-overview)
13. [Key decisions and trade-offs](#13-key-decisions-and-trade-offs)
14. [Assumptions](#14-assumptions)
15. [Known limitations and next steps](#15-known-limitations-and-next-steps)
16. [Git workflow](#16-git-workflow)
17. [AI usage](#17-ai-usage)

---

## 1. The problem

8:41 AM, Banani Road 11. Nusrat books a ride to Mohakhali. Two minutes later Rafiq books
Banani -> Gulshan 1. Jashim's Bullet has three seats. The system has to decide, in about a
second, whether they can share, what each of them pays, and - when Shirin grabs the last
seat thirty seconds later - make sure Bullet never ends up with four passengers.

Three actors:

- **Passenger** (Nusrat, Rafiq, Shirin): request a seat, see *their own* fare and status, cancel while it still makes sense, see history.
- **Driver** (Jashim with Bullet): go online in an area, see who is waiting, accept, and move the ride through arrive -> start -> complete; always know who is on board.
- **Ride / pool**: several requests sharing one Tesla, never more seats than it has, one clear lifecycle, and a history that explains afterwards exactly what happened.

## 2. Features

**Passenger**
- Sign up / sign in; one-click demo accounts for the story cast.
- Book pickup + destination (predefined Dhaka areas), 1-3 seats, cash or simulated TeslaPay.
- Live quote before booking: shared price vs. solo price, and the distance.
- **Automatic pooling**: if an open Tesla is picking up in your area and heading your way, you join it immediately.
- Live status: Waiting -> Matched -> Driver arrived -> In progress -> Completed (polls every 4 s).
- Sees the Tesla, driver and how many people share the ride - never the other passengers' names or fares.
- Cancel while waiting or before the ride starts.
- History with a per-ride timeline and a line-by-line fare breakdown.

**Driver**
- Go online / offline in an area; can't go offline mid-ride.
- Feed of waiting passengers in the area, each marked whether it fits the current ride (and why not).
- Accept -> creates a ride; accept again -> adds a compatible passenger to the open ride.
- Seat map of Bullet showing who sits where; every passenger's drop-off, seats, payment method and fare.
- Arrive -> start (locks fares) -> complete (marks everyone paid); cancel before start sends passengers back to the queue.
- Ride history with earnings.

**Engineering**
- Seat capacity enforced by a row lock **and** a database CHECK constraint.
- Invalid state transitions rejected (`409 INVALID_TRANSITION`).
- Append-only event log for every change.
- 79 automated tests against a real Postgres, including concurrent last-seat races.
- `docker compose up` runs web + API + Postgres with migrations, seed data and health checks.
- CI on every push: API tests, web lint/build, and a full `docker compose` smoke test.

## 3. Screenshots

| Passenger books (live quote) | Rafiq is pooled with Nusrat (mobile) |
| --- | --- |
| ![Booking](docs/screenshots/passenger-booking.png) | ![Matched](docs/screenshots/passenger-matched-mobile.png) |

| Jashim's pooled ride: seats and per-passenger fares | Nusrat's ride history: fare breakdown and timeline |
| --- | --- |
| ![Driver](docs/screenshots/driver-pooled-ride.png) | ![History](docs/screenshots/passenger-ride-history.png) |

## 4. Architecture and database

Full detail: [docs/architecture.md](docs/architecture.md) (written before the code and kept in sync).

```mermaid
flowchart LR
    B["Browser<br/>(passenger or driver)"] -- HTTPS --> W["React + Vite SPA<br/>web/"]
    W -- "REST / JSON<br/>Bearer JWT" --> A["Node.js API<br/>Express - api/"]
    A -- "Prisma<br/>transactions + row locks" --> D[("PostgreSQL")]
```

One API, one database. No Redis, queues or websockets: every piece of shared state (seats,
statuses, money) lives in Postgres, where a transaction can protect it. The API is layered
`routes -> services -> domain (pure functions) -> Prisma`.

```mermaid
erDiagram
    users ||--o| vehicles : drives
    users ||--o{ ride_requests : books
    vehicles ||--o{ rides : operates
    rides ||--o{ ride_requests : "pool membership (ride_id)"
    areas ||--o{ ride_requests : "pickup / destination"
    areas ||--o{ rides : pickup
    rides ||--o{ ride_events : history
    ride_requests ||--o{ ride_events : history
    users ||--o{ ride_events : actor
```

| Table | Purpose |
| --- | --- |
| `users` | Passengers and drivers (`role`). Drivers are seeded, not self-registered. |
| `vehicles` | Bullet: fixed `capacity` (CHECK 1-6), online flag, current area. One per driver. |
| `areas` | The predefined Dhaka areas with a lat/lng point each. |
| `rides` | A **pool**: one Tesla trip. `capacity` is a snapshot; `seats_booked` has `CHECK (seats_booked BETWEEN 0 AND capacity)`. |
| `ride_requests` | One passenger's booking. `ride_id` is the pool membership. Stores the fare breakdown in paisa. |
| `ride_events` | Append-only audit log: who changed what, when, from which status to which. |

Rules the database enforces itself (hand-written in the [migration](api/prisma/migrations)):
no overbooking, one active request per passenger, one active ride per vehicle, status and
`ride_id` always agree, non-negative money, pickup ≠ destination.

**Why no `pool_members` table?** A request is in at most one pool. A join table would allow
the invalid state "one request in two pools"; a nullable foreign key can't express it at all.

## 5. How pooling works

Full rules and worked numbers: [docs/domain.md](docs/domain.md).

**Geography**: 12 predefined Dhaka areas, each a lat/lng point. Distance = straight-line
(haversine), rounded to 100 m. No map API.

**Matching rule**: a request joins an open pool when
1. it has the **same pickup area**,
2. its destination is **within 2 km of every destination** already in the pool,
3. there are **enough free seats**, and
4. the ride **hasn't started** (`ACCEPTED` or `DRIVER_ARRIVED`).

Nusrat -> Mohakhali and Rafiq -> Gulshan 1 both start in Banani and their drop-offs are
1.7 km apart, so Rafiq joins Nusrat. Banani -> Uttara (~8 km from Mohakhali) would wait for
another Tesla.

**Fare model** (all integer paisa):

```
subtotal     = (baseFare 5,000 + distance_m x 3) x seats      (৳50 + ৳30/km, per seat)
poolDiscount = floor(subtotal x 25%)    only if 2+ passengers share the ride when it starts
fare         = subtotal - poolDiscount
```

| | Nusrat (Banani -> Mohakhali, 1.9 km) | Rafiq (Banani -> Gulshan 1, 1.8 km) |
| --- | --- | --- |
| Subtotal | 5,000 + 5,700 = 10,700 | 5,000 + 5,400 = 10,400 |
| Pool discount | 2,675 | 2,600 |
| **Fare** | **৳80.25** | **৳78.00** |
| Alone it would be | ৳107.00 | ৳104.00 |

The fare is **locked when the ride starts**, the moment membership can no longer change.
Money is stored as integer paisa because floats can't represent 0.1 exactly
(`0.1 + 0.2 !== 0.3`); integers sum exactly and never drift.

**Lifecycle.** The brief's single lifecycle doesn't fit a pool (Nusrat can cancel while
Rafiq's ride continues), so there are two state machines:

- **Ride**: `ACCEPTED -> DRIVER_ARRIVED -> STARTED -> COMPLETED`, `CANCELLED` before start.
- **Request**: `REQUESTED -> MATCHED -> COMPLETED`, `CANCELLED`; `MATCHED -> REQUESTED` if the driver cancels (back in the queue).

The passenger sees one combined status: `waiting -> matched -> driver arrived -> in progress -> completed / cancelled`.

## 6. The last-seat concurrency problem

> Bullet has 1 seat left. Nusrat and Shirin both try to claim it at nearly the same
> instant, and both initially see one seat available. (Brief, section 12.)

**How it's handled now** ([pool.service.js](api/src/modules/rides/pool.service.js)):

1. Every seat claim runs in a transaction that first takes a **row lock** on the ride:
   `SELECT ... FROM rides WHERE id = $1 FOR UPDATE`.
2. Shirin's transaction **waits** for Nusrat's to commit, then re-reads the committed
   `seats_booked = 3` and is refused. She stays `REQUESTED` (waiting), not an error.
3. `CHECK (seats_booked <= capacity)` is the safety net: even code that skipped the lock
   could not commit an overbooked ride.
4. Locks are always taken ride -> request, and candidate rides in ascending id, so two
   transactions can never wait on each other (no deadlocks).

**Proof**: [pooling.test.js](api/test/pooling.test.js) fires Nusrat and Shirin at the same
instant, then 6 passengers at 2 free seats five times over; exactly the right number get
seats every time. With the lock removed, that test fails (the CHECK constraint still stops
the overbooking, but passengers get 500 errors instead of a clean "waiting").

**At larger scale**: the lock is short and per ride, so it holds up well. What changes is
*matching*: a service partitioned by area serialises requests for the same area in order, so
transactions rarely compete for the same row. See [docs/scaling.md](docs/scaling.md).

## 7. Tech stack and why

Mandated: React (frontend) and Node.js (backend). Everything else was a choice.

| Choice | Alternatives considered | Why it fits this MVP | What would make me switch |
| --- | --- | --- | --- |
| **React 19 + Vite + React Router** | Next.js App Router | A dashboard behind a login needs no SSR or SEO. A static SPA deploys anywhere (Vercel, nginx) and keeps a clean split: UI in `web/`, every rule in the API. | Public, SEO-relevant pages (landing, driver sign-up), or wanting server components to cut client JS. |
| **Plain CSS with variables** | Tailwind, CSS Modules, a component library | One small stylesheet; no build plugin or class vocabulary to learn; easy to read in review. | A growing team or design system -> CSS Modules or Tailwind for scoping and consistency. |
| **Express 5** | NestJS, Fastify | Small and familiar; Express 5 forwards async errors to the error handler (no try/catch in every route). The app is a dozen routes - Nest's modules/DI would be structure without payoff. | Many more modules and developers -> NestJS; measured throughput limits -> Fastify. |
| **PostgreSQL 16** | MySQL, SQLite, MongoDB | Pooling is relational and transactional: seats, memberships and money need transactions, row locks, CHECK constraints and partial unique indexes. Postgres has all of them; SQLite locks the whole database on write, MongoDB makes multi-document invariants harder. | Nothing soon. Geospatial matching -> add PostGIS rather than switch. |
| **Prisma 6** | Knex, Drizzle, raw `pg` | Readable schema that doubles as documentation, typed queries, plain-SQL migrations I can edit (CHECK constraints and partial indexes are hand-written). Raw SQL is still available for `FOR UPDATE`. | Mostly raw SQL for locking/geospatial queries -> Kysely or plain `pg`. |
| **zod** | Joi, express-validator | One schema validates and converts input (strings -> numbers, trimming) and yields per-field messages. Also used to validate env vars at startup. | - |
| **JWT (Bearer) + bcrypt** | Sessions + cookies, Auth0/Clerk | Stateless auth works across the two Vercel domains without third-party cookies; bcrypt is the standard password hash. Drivers and passengers share one login with a `role` claim. | Rich user content (XSS risk) or refresh-token needs -> httpOnly cookie via a same-origin proxy; SSO needs -> an auth provider. |
| **Vitest + Supertest on a real Postgres** | Jest, mocking Prisma | The risky parts (locks, constraints, transactions) only exist in a real database, so tests use one - wiped between tests. Vitest runs ES modules without config. | Slow suite -> per-test transactions/rollbacks or Testcontainers. |
| **pino** | winston, console.log | Fast structured JSON logs with a request id per request, readable in dev via pino-pretty. | - |
| **Polling (4 s)** | Websockets, SSE | Status changes a few times per ride; polling needs no extra infrastructure and is trivial to reason about. | Many concurrent users or sub-second updates -> SSE / websockets. |
| **Vercel (web + API) + Neon (DB)** | Render, Railway, Fly.io; Render Postgres | All free with no card. The Express app runs unchanged as a Vercel serverless function (one small entry file), which wakes in seconds instead of Render's ~50 s. Neon's free Postgres doesn't expire (Render's is deleted after 30 days). `render.yaml` is kept as an alternative for running the API as a long-running server. | Websockets or background jobs (need a long-running process) -> Render / Fly.io; heavy traffic -> a paid plan with pooled connections. |
| **Docker Compose** | - (mandated) | nginx serves the SPA and proxies `/api`, so the browser sees one origin (no CORS) - same shape as production. | - |

## 8. Project structure

```
dhaka-tesla-pool/
├── api/                          Express API
│   ├── prisma/
│   │   ├── schema.prisma         data model
│   │   ├── migrations/           SQL migrations (+ hand-written constraints)
│   │   └── seed.js               areas + story cast (+ yesterday's pooled ride)
│   ├── src/
│   │   ├── app.js / server.js    app setup / start + graceful shutdown
│   │   ├── config/env.js         validated environment variables
│   │   ├── domain/               pure rules: fare, geo, matching, lifecycle, areas
│   │   ├── lib/                  prisma client, logger, errors
│   │   ├── middleware/           auth (JWT, roles), validation
│   │   └── modules/              auth, areas, rides (requests, pool, transitions), driver
│   ├── api/index.js              Vercel serverless entry (exports the Express app)
│   ├── test/                     unit + API tests (real Postgres)
│   ├── vercel.json               routes every path to the function
│   └── Dockerfile
├── web/                          React app
│   ├── src/
│   │   ├── api/client.js         fetch wrapper (token, errors, slow-server banner)
│   │   ├── context/AuthContext   who is signed in
│   │   ├── hooks/usePolling.js   refresh data every few seconds
│   │   ├── components/           shared, passenger/, driver/
│   │   ├── pages/                login, register, passenger/, driver/
│   │   └── styles/global.css
│   ├── nginx.conf / Dockerfile   static hosting + /api proxy in Docker
│   └── vercel.json               SPA rewrites on Vercel
├── docs/                         architecture, domain rules, API, scaling, screenshots
├── docker-compose.yml
├── render.yaml                   alternative: API on Render as a long-running server
├── .env.example
└── .github/workflows/ci.yml
```

## 9. Running it

### Prerequisites

- **Docker** (Docker Desktop) - for the one-command setup, **or**
- **Node.js 20+** and **PostgreSQL 14+** - to run the pieces directly.

### Environment variables

Copy the examples; never commit real `.env` files (they are git-ignored).

| Variable | Where | Meaning |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | root `.env` | Postgres container credentials |
| `DATABASE_URL` | `api/.env` | Postgres connection string (compose builds it for you) |
| `JWT_SECRET` | both | 32+ random characters used to sign tokens (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | both | Token lifetime, default `8h` |
| `CORS_ORIGIN` | both | Comma-separated browser origins allowed to call the API |
| `PORT`, `LOG_LEVEL`, `NODE_ENV` | `api/.env` | API port (4000), log level, environment |
| `WEB_PORT` / `API_PORT` | root `.env` | Host ports for compose (8080 / 4000) |
| `VITE_API_URL` | `web/.env` | API origin for the browser build. Empty = same origin (`/api`) |

The API validates its variables at startup and refuses to start with a clear message if one
is missing or too weak.

### Option A - Docker (recommended)

```bash
cp .env.example .env        # then change the password and JWT secret
docker compose up --build
```

- App: http://localhost:8080
- API: http://localhost:4000/api/health

On start the API container runs `prisma migrate deploy`, then the seed, then the server. The
seed is idempotent (upserts), so restarts never duplicate data. Reset everything with
`docker compose down -v`.

### Option B - run the pieces directly

```bash
# 1. Database
createdb teslapool

# 2. API
cd api
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate          # prisma migrate deploy
npm run db:seed             # areas + Jashim/Bullet, Nusrat, Rafiq, Shirin
npm run dev                 # http://localhost:4000

# 3. Web (second terminal)
cd web
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

### Demo accounts and a 2-minute tour

All passwords: `teslapool123`.

| Who | Email | Role |
| --- | --- | --- |
| Jashim | `jashim@teslapool.test` | Driver of Bullet (3 seats, starts offline in Banani) |
| Nusrat | `nusrat@teslapool.test` | Passenger |
| Rafiq | `rafiq@teslapool.test` | Passenger |
| Shirin | `shirin@teslapool.test` | Passenger |

Use one normal window and one or two private windows (each has its own login):

1. **Jashim** -> *Go online* in Banani.
2. **Nusrat** -> Banani -> Mohakhali -> *Request a seat* (waiting). **Jashim** -> *Accept*.
3. **Rafiq** -> Banani -> Gulshan 1 -> matched into Bullet instantly.
4. **Jashim** -> *Arrived* -> *Start trip*: fares lock at ৳80.25 and ৳78.00 -> *Complete*.
5. Each passenger's history shows their own fare breakdown and timeline.

Yesterday's pooled ride (Nusrat + Rafiq) is pre-seeded, so history isn't empty.

## 10. Tests

```bash
cd api
# needs an empty Postgres database; it is wiped between tests
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teslapool_test npm test
```

79 tests, focused on what's risky rather than on coverage numbers:

| The brief asks that... | Covered by |
| --- | --- |
| Bullet's capacity can never be exceeded | `pooling.test.js` - capacity; `matching.test.js`; DB CHECK test |
| Invalid state transitions are rejected | `lifecycle.test.js` (every illegal pair), `driver.test.js` (via the API) |
| Nusrat's and Rafiq's pooled fares calculate correctly | `fare.test.js` (৳80.25 / ৳78.00 by hand), `pooling.test.js` (end to end) |
| Users can't modify another user's ride | `requests.test.js` (Rafiq vs. Nusrat's request), role checks in `driver.test.js` |
| Cancellation rules hold | `requests.test.js`, `driver.test.js`, `pooling.test.js` |
| Two concurrent requests can't corrupt pool capacity | `pooling.test.js` - Nusrat vs. Shirin, and 6 riders for 2 seats x5; double-click booking in `requests.test.js` |

Frontend: `npm run lint` and `npm run build` in `web/` (both run in CI).

## 11. Deployment

Live: **https://dhaka-tesla-pool-nine-bay.vercel.app** - deployed from `release/v1.0.0`.
Everything is on free tiers; nothing is paid.

| Part | Where | How |
| --- | --- | --- |
| Web | **Vercel** project `dhaka-tesla-pool` | Root directory `web` (Vite). Env: `VITE_API_URL=https://dhaka-tesla-pool-api-gray.vercel.app`. `web/vercel.json` rewrites every path to `index.html`. |
| API | **Vercel** project `dhaka-tesla-pool-api` | Root directory `api`. [`api/api/index.js`](api/api/index.js) exports the same Express app as a serverless function; [`api/vercel.json`](api/vercel.json) routes every path to it. The build runs `prisma generate && prisma migrate deploy`. Env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (the web URL), `NODE_ENV=production` - stored as Vercel secrets. |
| DB | **Neon** free Postgres | Direct (non-pooled) connection string with `sslmode=require`. Seeded once with `npm run db:seed`. |

To redeploy from a checkout: `cd api && vercel deploy --prod`, then `cd web && vercel deploy --prod`.

**Serverless trade-offs**: each function instance holds its own small connection pool
(fine at this scale; at higher load use Neon's pooled endpoint), and the login rate limiter
is per instance rather than global. **Alternative**: [render.yaml](render.yaml) runs the API
as a normal long-running server on Render (migrations + seed in the start command); and
`docker compose up` above is the fully reproducible deployment.

## 12. API overview

REST, JSON, Bearer JWT. Full reference with error codes: [docs/api.md](docs/api.md).

| | |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Reference | `GET /api/areas`, `GET /api/fares/estimate` |
| Passenger | `POST/GET /api/ride-requests`, `GET /api/ride-requests/active`, `GET /api/ride-requests/:id`, `POST /api/ride-requests/:id/cancel` |
| Driver | `GET /api/driver/me`, `PATCH /api/driver/availability`, `GET /api/driver/requests`, `POST /api/driver/requests/:id/accept`, `GET /api/driver/rides` |
| Ride lifecycle | `GET /api/rides/:id`, `POST /api/rides/:id/{arrive,start,complete,cancel}` |
| Ops | `GET /api/health` (checks the database) |

Errors are always `{ "error": { "code", "message", "details?" } }`; business-rule refusals
are `409` with a stable `code` the UI can react to.

## 13. Key decisions and trade-offs

- **Two state machines instead of one.** Needed for pools; the passenger still sees one simple status.
- **Fares locked at `STARTED`.** Before that, membership can still change; the UI shows both prices.
- **Automatic joining.** Pooling is the product, so a fitting passenger is placed without waiting for the driver to click. Trade-off: the driver doesn't approve each co-rider (they can still cancel before starting).
- **Business rules in the API, backed by the database.** The UI only displays; every rule is enforced in a service *and*, where possible, by a constraint.
- **Row locks rather than optimistic retries.** Simple to reason about and correct under READ COMMITTED; contention is per ride, so it stays low.
- **Polling instead of websockets.** No extra infrastructure; 4-second freshness is fine for pickups.
- **Token in `localStorage`.** Works across two free-tier domains; XSS risk mitigated by React escaping and no raw HTML. Would move to an httpOnly cookie behind a same-origin proxy.
- **404 for other people's resources.** Doesn't reveal which ids exist.
- **Snapshot capacity on the ride.** Editing a vehicle can't change a ride already running.

## 14. Assumptions

- Everyone in a pool is picked up in the **same area**; only drop-offs differ.
- Drop-offs within **2 km** of each other count as "the same way".
- Max **3 seats per request** (Bullet's capacity).
- **Drivers are pre-registered** (the brief gives them "sign in" only).
- A driver who cancels before pickup sends passengers **back to the queue**, rather than cancelling their bookings.
- A passenger **can't cancel after the ride starts** (they are in the car).
- **No cancellation fees, ratings or real payments**; TeslaPay is a label + "paid" timestamp.

## 15. Known limitations and next steps

**Limitations**
- Straight-line distances between area centres; no real routing or live location.
- Polling, not push; a driver sees a new co-rider within ~4 s.
- Waiting requests are matched when *they* are created or accepted, not re-scanned when a new ride opens (the driver's feed shows which ones fit).
- No refresh tokens; sessions last 8 hours.
- Free tiers sleep when idle, so the first request can be slow; the login rate limiter is per serverless instance.
- `npm audit` reports advisories in Prisma CLI tooling dependencies (not in the request path).

**Next improvements**
1. Server-Sent Events for live status.
2. Re-scan the waiting queue when a ride opens or a seat frees up.
3. Idempotency keys on booking and accept.
4. Cancellation fee after the driver has arrived; ratings.
5. Real distances (OSRM) and multi-stop pickup.

Scaling to 1M passengers / 100k drivers (bonus): [docs/scaling.md](docs/scaling.md).

## 16. Git workflow

Following the brief's process:

- `master` - integration branch; every feature arrives through a `--no-ff` merge.
- `feature/*` - one logical change each, with incremental commits:
  `architecture-docs`, `api-setup`, `passenger-auth`, `fare-model`, `ride-requests`,
  `driver-flow`, `tesla-pooling`, `web-setup`, `passenger-ui`, `driver-ui`, `docker`.
- `pre-release` - cut from `master` once the MVP was integrated: CI, deployment config,
  demo data, integration fixes and documentation.
- `release/v1.0.0` - cut from `pre-release`; the version shown in the video and deployment
  (tagged `v1.0.0`).

Commits follow `<type>(<scope>): <description>` with `feat`, `fix`, `refactor`, `test`,
`docs`, `chore` or `build`.

## 17. AI usage

AI was used openly, as the brief allows. I own the result and am ready to explain, debug and
change any part of it.

**Tools**
- **Claude Code (Anthropic)** - the main tool, used heavily. From the brief it drafted the
  architecture, schema and domain rules, wrote most of the implementation, tests and docs,
  and ran the test suite and a browser walkthrough of the story. I chose the stack and hosting
  (React + Vite over Next.js; free hosting on Vercel and Neon).
- Official documentation (Prisma, Express 5, PostgreSQL explicit locking, React Router) to
  check details.

**One suggestion accepted**: enforce Bullet's capacity with a **row lock
(`SELECT ... FOR UPDATE`) plus a `CHECK (seats_booked <= capacity)` constraint**, instead of
only checking the count in JavaScript. It was verified by temporarily removing the lock: the
concurrent test then failed (passengers got 500 errors from the CHECK constraint instead of
a clean "waiting"), and passed again with the lock restored.

**One suggestion changed**: the first version of the passenger's ride timeline only showed
events recorded on their own request, so "driver arrived", "trip started" and "completed"
were missing - found while walking through the story in the browser. It now also includes
the ride's status changes, while still excluding anything about other passengers.

Also changed on review: Prisma's generated migration used `ON DELETE SET NULL` for the links
from requests and events to rides, which would silently erase history if a ride were ever
deleted; those relations are now `ON DELETE RESTRICT`.
