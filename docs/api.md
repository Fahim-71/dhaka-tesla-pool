# API reference

Base URL: `/api` (e.g. `http://localhost:4000/api`). JSON in, JSON out.

**REST** was chosen over GraphQL: the app has a handful of screens, each needing one or two
fixed resources, and the interesting logic is in state transitions (`POST .../start`), which map
naturally to REST actions. GraphQL would add a schema layer and resolver complexity without
removing any round trips that matter here.

## Conventions

- **Auth**: `Authorization: Bearer <jwt>` from `/auth/login` or `/auth/register`. Tokens expire after 8 h.
- **Roles**: passenger endpoints return `403` for drivers and vice versa.
- **Ownership**: someone else's request or ride returns `404` (not `403`), so ids can't be probed.
- **Money**: every `...Paisa` field is an integer number of paisa (৳1 = 100 paisa).
- **Errors** always look like:

```json
{ "error": { "code": "NOT_ENOUGH_SEATS", "message": "Not enough free seats", "details": { } } }
```

| Status | When | Example `code` |
| --- | --- | --- |
| 400 | Invalid input | `VALIDATION_ERROR` (with per-field `details`), `BAD_REQUEST`, `INVALID_JSON` |
| 401 | Missing / expired token, wrong password | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | Wrong role | `FORBIDDEN` |
| 404 | Not found or not yours | `NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | Business rule refused the action | `INVALID_TRANSITION`, `ACTIVE_REQUEST_EXISTS`, `CANNOT_CANCEL`, `DRIVER_OFFLINE`, `ACTIVE_RIDE`, `DOES_NOT_FIT_POOL`, `REQUEST_NOT_AVAILABLE`, `EMAIL_TAKEN` |
| 429 | Too many login / sign-up attempts | `TOO_MANY_REQUESTS` |
| 500 | Bug - logged with a request id, generic message to the client | `INTERNAL_ERROR` |

## Endpoints

### Public

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | `{ status, database }`; 503 if Postgres is unreachable |
| POST | `/auth/register` | Passenger sign-up `{ name, email, password, phone? }` -> `{ user, token }` |
| POST | `/auth/login` | `{ email, password }` -> `{ user, token }` (passengers and drivers) |
| GET | `/areas` | The predefined Dhaka areas |
| GET | `/fares/estimate?pickupAreaId=&destinationAreaId=&seats=` | Distance, solo fare and pooled fare |

### Any signed-in user

| Method | Path | Description |
| --- | --- | --- |
| GET | `/auth/me` | The current user |

### Passenger

| Method | Path | Description |
| --- | --- | --- |
| POST | `/ride-requests` | Book `{ pickupAreaId, destinationAreaId, seats (1-3), paymentMethod (CASH/TESLAPAY) }`. Tries to join an open pool immediately; the response `status` is `MATCHED` or `REQUESTED` |
| GET | `/ride-requests` | My history, newest first |
| GET | `/ride-requests/active` | My current request, or `null` (polled by the UI) |
| GET | `/ride-requests/:id` | One of my requests, with its event timeline |
| POST | `/ride-requests/:id/cancel` | Cancel while waiting or before the ride starts |

A passenger's request includes `displayStatus` (`WAITING`, `MATCHED`, `DRIVER_ARRIVED`,
`IN_PROGRESS`, `COMPLETED`, `CANCELLED`), their own fare breakdown, and - if matched - the
Tesla, the driver and `passengerCount`. Never other passengers' names or fares.

### Driver

| Method | Path | Description |
| --- | --- | --- |
| GET | `/driver/me` | Vehicle + current ride with every passenger, seat and fare |
| PATCH | `/driver/availability` | `{ online, areaId? }`; refused mid-ride |
| GET | `/driver/requests` | Waiting requests in my area; each has `poolFit` (can it join my open ride, and if not why) |
| POST | `/driver/requests/:id/accept` | Creates a ride, or adds the passenger to my open ride |
| GET | `/driver/rides` | My completed and cancelled rides |
| GET | `/rides/:id` | One of my rides with its event timeline |
| POST | `/rides/:id/arrive` | `ACCEPTED -> DRIVER_ARRIVED` |
| POST | `/rides/:id/start` | `DRIVER_ARRIVED -> STARTED`, locks every passenger's fare |
| POST | `/rides/:id/complete` | `STARTED -> COMPLETED`, marks everyone paid |
| POST | `/rides/:id/cancel` | Before start only; passengers go back to `REQUESTED` |

## Try it with curl

```bash
# Nusrat books Banani -> Mohakhali
TOKEN=$(curl -s localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"nusrat@teslapool.test","password":"teslapool123"}' | jq -r .token)

curl -s localhost:4000/api/ride-requests -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pickupAreaId":"banani","destinationAreaId":"mohakhali","seats":1}' | jq .request.displayStatus
```
