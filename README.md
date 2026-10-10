# CRM Sales Management System – Backend

A RESTful backend for a CRM that manages the complete sales process:

**Lead generation → Lead qualification → Customer conversion → Deal management → Deal closure**

Built with **Node.js, Express 5, MongoDB (Mongoose) and Zod**. It includes JWT authentication, role-based access control, transactional lead conversion, business rules enforced on the server, an audit timeline, and analytics built with aggregation pipelines.

> **Live API:** https://crm-backend-352l.onrender.com/api
> **Health check:** https://crm-backend-352l.onrender.com/api/health
> Hosted on Render's free plan: the first request after ~15 minutes of inactivity can take 30–50 seconds while the server wakes up.

---

## Table of contents

1. [Tech stack](#1-tech-stack)
2. [Project structure](#2-project-structure)
3. [Getting started](#3-getting-started)
4. [Environment variables](#4-environment-variables)
5. [Database setup and seed data](#5-database-setup-and-seed-data)
6. [Authentication](#6-authentication)
7. [Roles and permissions](#7-roles-and-permissions)
8. [API reference](#8-api-reference)
9. [Request and response format](#9-request-and-response-format)
10. [Business rules](#10-business-rules)
11. [Database design](#11-database-design)
12. [Indexing and performance](#12-indexing-and-performance)
13. [Security](#13-security)
14. [Deployment](#14-deployment)
15. [Assumptions](#15-assumptions)

---

## 1. Tech stack

| Concern | Choice |
|---|---|
| Runtime / framework | Node.js 20+, Express 5 (async errors are forwarded to the error handler automatically) |
| Database | MongoDB Atlas (replica set, required for transactions) with Mongoose |
| Validation | Zod |
| Auth | JWT access token + HTTP-only refresh-token cookie, bcrypt (12 rounds) |
| Security | helmet, cors, express-rate-limit |
| Logging | morgan (development only) |
| API docs | Postman collection (`CRM-Sales-Management.postman_collection.json`) |

## 2. Project structure

```
src/
├── config/        db.js (connection), constants.js (roles, enums, timeline actions)
├── models/        User, Lead, Customer, Deal, Activity, Timeline
├── validators/    Zod schemas per module + shared helpers (common.js)
├── middleware/    auth.js (protect, authorize), validate.js, errorHandler.js
├── services/      business logic (one file per module + conversion, timeline, dashboard)
├── controllers/   thin HTTP layer: read request -> call service -> send response
├── routes/        URL -> middleware -> controller
├── utils/         ApiError, apiResponse, queryHelper, access (role scoping), assignment, token
├── app.js         Express app (security middleware, routes, 404, error handler)
├── server.js      connects to MongoDB, starts the server
└── seed.js        demo data
```

Responsibilities are separated: **routes** only wire middleware, **controllers** only handle HTTP, and **services** contain all business rules, so no business logic lives in route files.

## 3. Getting started

**Requirements:** Node.js 20 or newer, and a MongoDB Atlas cluster (the free M0 tier works).

```bash
git clone <your-repo-url>
cd crm-backend
npm install
cp .env.example .env        # Windows: copy .env.example .env, then fill in the values
npm run seed -- --fresh     # optional: demo users and data
npm run dev                 # development (nodemon), http://localhost:5000
npm start                   # production
```

| Script | Description |
|---|---|
| `npm run dev` | Start with nodemon (auto-restart on file changes) |
| `npm start` | Start with node |
| `npm run seed` | Seed demo data (only if the DB has no users) |
| `npm run seed -- --fresh` | **Delete** all CRM data, then seed |

## 4. Environment variables

| Variable | Example | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `NODE_ENV` | `development` / `production` | In production, stack traces are hidden and cookies are `secure` |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/crm?retryWrites=true&w=majority` | Atlas connection string (database `crm`) |
| `JWT_ACCESS_SECRET` | 96-char random hex | Secret for access tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access-token lifetime |
| `JWT_REFRESH_SECRET` | 96-char random hex (different) | Secret for refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token lifetime |
| `CORS_ORIGIN` | `*` or `https://my-frontend.com` | Allowed origin(s) |

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 5. Database setup and seed data

1. Create a free cluster on MongoDB Atlas.
2. Under **Database Access**, add a user with *Read and write to any database*.
3. Under **Network Access**, allow `0.0.0.0/0` (needed for cloud hosting).
4. Copy the driver connection string, add the database name `crm` after `.net/`, and put it in `MONGO_URI`.

Atlas clusters are replica sets, which **MongoDB transactions** (used by lead conversion) require. A standalone local `mongod` does not support transactions.

**Seed:** `npm run seed -- --fresh` creates:

| Role | Email | Password |
|---|---|---|
| admin | admin@crm.com | Admin1234 |
| sales_manager | manager1@crm.com, manager2@crm.com | Manager1234 |
| sales_executive | exec1@crm.com, exec2@crm.com (Manager One's team) | Exec1234 |
| sales_executive | exec3@crm.com (Manager Two's team), exec4@crm.com (**inactive**) | Exec1234 |

It also creates 13 leads in every status, 5 converted leads with customers and deals (Won, Lost, Negotiation, Proposal), a direct customer, activities (including 2 overdue), and timeline entries.

## 6. Authentication

| Item | Implementation |
|---|---|
| Passwords | bcrypt-hashed in a Mongoose `pre('save')` hook; `select: false`; removed by `toJSON` |
| Access token | JWT (`sub`, `role`, `tv`), 15 minutes, sent as `Authorization: Bearer <token>` |
| Refresh token | JWT, 7 days, stored in an **HTTP-only** cookie (`secure` + `sameSite=none` in production, path `/api/auth`) |
| Logout | Increments the user's `tokenVersion`, which immediately invalidates **all** existing access and refresh tokens |
| Deactivation | Also increments `tokenVersion`; inactive users cannot log in or be assigned work |
| Brute force | Login/register limited to 20 requests per 15 minutes per IP |
| Registration | Always creates a `sales_executive` (a `role` sent by the client is stripped). The first user in an empty database becomes `admin` (bootstrap). |

Flow: `POST /auth/login` returns `accessToken` and sets the cookie. Send `Authorization: Bearer <accessToken>`. When it expires, call `POST /auth/refresh`, then `POST /auth/logout`.

## 7. Roles and permissions

Authorization is enforced on the server in two layers:

1. **Route level:** `authorize(...roles)` middleware (for example, user management is admin-only).
2. **Data level:** every query is combined with `getAccessFilter(user)`:

| Role | Leads / Customers / Deals / Activities visible |
|---|---|
| **admin** | All records |
| **sales_manager** | Records assigned to themselves or any executive in their team, plus records they created |
| **sales_executive** | Only records assigned to them |

A record outside the user's scope returns **404** (not 403), so IDs belonging to other teams are not revealed.

| Capability | Admin | Manager | Executive |
|---|:-:|:-:|:-:|
| Manage users (CRUD, activate/deactivate) | ✅ | ❌ | ❌ |
| View own team (`/users/team`) | ✅ (all executives) | ✅ | ❌ |
| Create / update leads, customers, deals, activities | ✅ | ✅ (team) | ✅ (own) |
| Assign / reassign leads and deals | ✅ any active executive | ✅ own team only | ❌ |
| Convert qualified leads, change deal stages | ✅ | ✅ | ✅ (own) |
| Delete leads / customers / deals | ✅ | ✅ (team) | ❌ |
| Delete activities | ✅ | ✅ | only pending ones they created |
| Reopen a Won/Lost deal (with reason) | ✅ | ❌ | ❌ |
| Dashboard stats and pipeline | ✅ all | ✅ team | ✅ own |
| Team performance | ✅ | ✅ | ❌ |

## 8. API reference

Base URL: `/api`. All routes except health, register, login and refresh require `Authorization: Bearer <token>`.
- **Sample requests and responses:** [`docs/API_EXAMPLES.md`](docs/API_EXAMPLES.md)
- **Postman collection:** `CRM-Sales-Management.postman_collection.json` (56 requests with descriptions and example bodies). Import it into Postman, send *Auth / Login (Admin)* first, then run the folders in order. The "Create" requests save the new IDs automatically.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register (role is always `sales_executive`) |
| POST | `/auth/login` | Login, returns an access token and sets the refresh cookie |
| POST | `/auth/refresh` | New access token from the refresh cookie |
| POST | `/auth/logout` | Invalidate all tokens of the user |
| GET | `/auth/me` | Current user profile |

### Users (admin)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/users` | Create a user (any role; `manager` for executives) |
| GET | `/users` | List: `search`, `role`, `isActive`, `manager`, `from`, `to`, `sort`, `page`, `limit` |
| GET | `/users/team` | Manager: own team. Admin: all executives |
| GET | `/users/:id` | Get a user |
| PATCH | `/users/:id` | Update name, email, phone, password, role, manager |
| PATCH | `/users/:id/status` | `{ "isActive": true \| false }` |
| DELETE | `/users/:id` | Delete (blocked if the user still owns records or has team members) |

### Leads
| Method | Endpoint | Description |
|---|---|---|
| POST | `/leads` | Create |
| GET | `/leads` | List: `status`, `priority`, `source` (comma-separated), `assignedTo` (id or `unassigned`), `search`, `from`, `to`, `sort`, `page`, `limit` |
| GET | `/leads/:id` | Get (includes converted customer/deal) |
| PATCH | `/leads/:id` | Update details |
| PATCH | `/leads/:id/status` | Change status (`reason` required for `Lost`) |
| PATCH | `/leads/:id/assign` | Assign/reassign (admin, manager) |
| POST | `/leads/:id/convert` | Convert to Customer (+ optional Deal) in a transaction |
| GET | `/leads/:id/timeline` | Audit history |
| DELETE | `/leads/:id` | Delete (admin, manager; not converted leads) |

### Customers
| Method | Endpoint | Description |
|---|---|---|
| POST | `/customers` | Create |
| GET | `/customers` | List: `status`, `assignedTo`, `search`, `from`, `to`, `sort`, `page`, `limit` |
| GET | `/customers/:id` | Get, with the original `lead` and all `deals` |
| PATCH | `/customers/:id` | Update (reassign: admin/manager) |
| GET | `/customers/:id/timeline` | Audit history |
| DELETE | `/customers/:id` | Delete (admin, manager; blocked if it has deals or came from a lead) |

### Deals
| Method | Endpoint | Description |
|---|---|---|
| POST | `/deals` | Create for an existing customer |
| GET | `/deals` | List: `stage`, `status` (Open/Won/Lost), `assignedTo`, `customer`, `minValue`, `maxValue`, `closeFrom`, `closeTo`, `search`, `from`, `to`, `sort`, `page`, `limit` |
| GET | `/deals/:id` | Get |
| PATCH | `/deals/:id` | Update name, value, probability, expectedCloseDate, description |
| PATCH | `/deals/:id/stage` | Change stage (`lostReason` for Lost, `reason` for an admin reopen) |
| PATCH | `/deals/:id/assign` | Reassign (admin, manager) |
| GET | `/deals/:id/timeline` | Audit history |
| DELETE | `/deals/:id` | Delete (admin, manager; Won deals cannot be deleted) |

### Activities
| Method | Endpoint | Description |
|---|---|---|
| POST | `/activities` | Create (Call, Email, Meeting, Demo, Follow-up, Reminder, Note) |
| GET | `/activities` | List: `status` (Pending/Overdue/Completed), `type`, `assignedTo`, `relatedType`, `relatedId`, `dueFrom`, `dueTo`, `search`, `sort`, `page`, `limit` |
| GET | `/activities/:id` | Get |
| PATCH | `/activities/:id` | Update title, description, dueDate, assignedTo |
| PATCH | `/activities/:id/complete` | Mark completed (optional `outcome`) |
| DELETE | `/activities/:id` | Delete |

### Dashboard
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/stats` | Leads (total/new/qualified/converted…), customers, deals (open/won/lost), total revenue, expected revenue, conversion rate, win rate, pending/overdue activities |
| GET | `/dashboard/pipeline` | Count, value, expected revenue and average probability per stage |
| GET | `/dashboard/team-performance` | Per-executive performance (admin, manager) |

All dashboard endpoints accept optional `from` / `to` and are scoped by role.

## 9. Request and response format

**Success**
```json
{
  "success": true,
  "message": "Leads fetched successfully",
  "data": { "leads": [ ... ] },
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

**Error**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Invalid email format" }]
}
```

| Status | When |
|---|---|
| 400 | Validation error, invalid ObjectId, invalid JSON, business rule violated (e.g. invalid status transition) |
| 401 | Missing/invalid/expired token, logged out, deactivated |
| 403 | Role not allowed (e.g. executive calling `/users`) |
| 404 | Resource not found **or not accessible** to this user, unknown route |
| 409 | Duplicate data, already converted, closed deal, completed activity |
| 429 | Rate limit exceeded |
| 500 | Unexpected error (details logged on the server only; no stack trace in production) |

**Pagination and filtering** (all list endpoints): `page` (default 1), `limit` (default 10, max 100), `sort=field` or `sort=-field` (whitelisted fields, comma-separated for multiple), `search` (case-insensitive, regex-escaped), and multiple values per filter as `?status=New,Contacted`.

## 10. Business rules

### Leads
- Status transitions are validated on the server:

  | From | Allowed to |
  |---|---|
  | New | Contacted, Qualified, Unqualified, Lost |
  | Contacted | Qualified, Unqualified, Lost |
  | Qualified | Contacted, Unqualified, Lost |
  | Unqualified | Contacted, Lost |
  | Lost | Contacted (re-open) |
  | Converted | — (final; only set by the convert endpoint) |
- `Lost` requires a reason. Either email or phone is required. No duplicate **active** lead with the same email.
- Executives' leads are always assigned to themselves.
- Assignment: only **active sales executives** can be assignees; managers can only assign within their own team. Every assignment is logged (`lead_assigned` / `lead_reassigned`).
- Converted leads are **read-only** (no edit, reassign or delete).

### Lead conversion (`POST /leads/:id/convert`)
- Only **Qualified** and **assigned** leads can be converted. A converted lead cannot be converted again (409).
- Runs inside a **MongoDB transaction** (`session.withTransaction`): create the Customer (`customer.lead`), optionally create the Deal (`deal.lead` + `deal.customer`), set the lead to `Converted` (`convertedCustomer`, `convertedDeal`, `convertedAt`), and write the timeline entries. If any step fails, **everything is rolled back**.
- **Double-conversion protection** at two levels: the lead update is conditional (`{ _id, status: 'Qualified' }`), and `Customer.lead` has a **unique index**.

### Deals
- `value > 0`; `probability` 0–100.
- **`expectedRevenue = value × probability / 100` is always calculated by the server** (Mongoose `pre('validate')` hook); a client-sent value is ignored.
- Default probability per stage: Qualification 10, Discovery 25, Proposal 50, Negotiation 75, Won 100, Lost 0.
- `expectedCloseDate` cannot be in the past and must be within 5 years.
- **Won** requires an active customer and a positive value; it sets probability 100, status `Won` and `closedAt`.
- **Lost** requires a `lostReason`; it sets probability 0, status `Lost` and `closedAt`.
- **Won/Lost are closed.** They cannot be edited, reassigned or moved by managers/executives (409). Only an admin can reopen one, to an active stage, with a `reason` (logged).
- Won deals cannot be deleted (revenue history).
- `status` (`Open` / `Won` / `Lost`) is derived from the stage for fast filtering.

### Customers
- Keep the reference to the original lead and expose their deals (`GET /customers/:id`).
- Cannot be deleted when they have deals or came from a converted lead; set them `Inactive` instead.
- Deals can only be created for **Active** customers.

### Activities
- Stored status is `Pending` or `Completed`. **`Overdue` is computed by the backend** (`Pending` and `dueDate < now`) in both responses and the `?status=Overdue` filter. This is always accurate without a cron job.
- `dueDate` is required (except for Notes) and cannot be in the past. Notes are stored as Completed.
- The related record (lead/customer/deal) must be accessible to the user.
- Completed activities are read-only; completing twice returns 409.

### Users
- An admin cannot change their own role or status, or delete themselves.
- A manager with team members cannot be demoted or deleted. Users who still own CRM records cannot be deleted (deactivate them instead).

### Timeline / audit
Recorded events: `lead_created`, `lead_assigned`, `lead_reassigned`, `lead_status_changed`, `lead_priority_changed`, `lead_updated`, `lead_converted`, `lead_deleted`, `note_added`, `follow_up_created`, `follow_up_completed`, `activity_created`, `activity_completed`, `customer_created`, `customer_updated`, `customer_deleted`, `deal_created`, `deal_updated`, `deal_stage_changed`, `deal_assigned`, `deal_won`, `deal_lost`.
Each entry stores `action`, `entityType`, `entityId`, `performedBy`, `previousValue`, `newValue` and `createdAt`. Timeline entries are append-only and are kept even when the entity is deleted.

## 11. Database design

```
User ──< Lead ──1:1── Customer ──< Deal
  │        │              │          │
  │        └──────< Activity >───────┘   (relatedType + relatedId)
  └── manager (self-reference: executive -> manager)

Timeline (entityType + entityId) -> Lead | Customer | Deal
```

| Collection | Key fields | Relationships |
|---|---|---|
| **users** | name, email (unique), phone, password (hashed), role, manager, isActive, tokenVersion, lastLoginAt | `manager` → User (team structure) |
| **leads** | name, email, phone, company, source, status, priority, description, lostReason, convertedAt | `assignedTo`, `createdBy` → User; `convertedCustomer` → Customer; `convertedDeal` → Deal |
| **customers** | name, email, phone, company, address (embedded), status | `lead` → Lead (unique, sparse); `assignedTo`, `createdBy` → User; virtual `deals` |
| **deals** | name, value, probability, expectedRevenue, expectedCloseDate, stage, status, lostReason, closedAt | `customer` → Customer; `lead` → Lead; `assignedTo`, `createdBy` → User |
| **activities** | type, title, description, status, dueDate, completedAt, outcome | `relatedType` + `relatedId` (polymorphic, `refPath`) → Lead/Customer/Deal/User; `assignedTo`, `createdBy` → User |
| **timelines** | action, entityType, entityId, previousValue, newValue, createdAt | `performedBy` → User; polymorphic `entityType` + `entityId` |

**References vs embedding**
- **References** are used between the main entities (leads, customers, deals, activities, users). They are queried independently, grow without limit, change separately, and are filtered and aggregated on their own.
- **Embedding** is used for the customer `address` (always read with the customer, small, never queried on its own).
- **Timeline and activities are separate collections** rather than arrays inside a lead or deal. They grow without bound (MongoDB's 16 MB document limit), need their own pagination, and one collection can serve leads, customers and deals.
- A small amount of **denormalization** for speed: `deal.status` (derived from the stage) and `deal.expectedRevenue` (derived from value × probability) are stored so filters and dashboard aggregations don't recompute them.

## 12. Indexing and performance

| Collection | Indexes | Supports |
|---|---|---|
| users | `email` (unique), `{role, isActive}`, `manager`, `createdAt` | login, role/status filters, team lookups |
| leads | `{assignedTo, status, createdAt}`, `{status, createdAt}`, `source`, `priority`, `createdBy`, `email`, `createdAt` | scoped lists, status/source/priority filters, date ranges, duplicate check |
| customers | `lead` (unique, sparse), `{assignedTo, createdAt}`, `email`, `status`, `createdBy`, `createdAt` | double-conversion guard, scoped lists |
| deals | `{assignedTo, stage}`, `{stage, value}`, `status`, `customer`, `lead`, `expectedCloseDate`, `createdBy`, `createdAt` | pipeline, value ranges, closing-date filters, customer → deals |
| activities | `{assignedTo, status, dueDate}`, `{relatedType, relatedId, createdAt}`, `{status, dueDate}`, `createdBy`, `createdAt` | pending/overdue queries, activities of a record |
| timelines | `{entityType, entityId, createdAt}`, `{performedBy, createdAt}` | the timeline of a record, newest first |

Other optimizations:
- List endpoints run the **data query and `countDocuments` in parallel** (`Promise.all`).
- Dashboards use **aggregation pipelines** (`$match` → `$group` with `$cond`), with **one aggregation per collection grouped by user**, so there are no N+1 queries.
- Only needed fields are populated (`select`), page size is capped at 100, and sort fields are whitelisted.
- Search input is **regex-escaped**.

## 13. Security

- **helmet** security headers; **CORS** origin set by configuration; JSON body limit of **10 kb**.
- **Rate limiting:** 200 requests per 15 minutes per IP on `/api`, and 20 per 15 minutes on login/register.
- **Validation** of every body, query and params with Zod. Unknown fields are stripped, so clients can't set `role`, `createdBy`, `expectedRevenue` and so on.
- **NoSQL injection:** inputs are typed by Zod (strings, enums, ObjectIds), so operator objects such as `{"$gt": ""}` are rejected.
- Passwords are hashed with bcrypt and never returned. JWT secrets live only in environment variables, the refresh token is in an HTTP-only cookie, and logout or deactivation revoke tokens.
- **Centralized error handler** with a consistent format. In production it returns no stack traces, database details or internal messages, and unexpected errors are logged only on the server.
- **Object-level authorization** on every record (access filters), not only route-level role checks.

## 14. Deployment

Deployed on **Render** (free web service) with **MongoDB Atlas**:

1. Push the code to GitHub (`.env` is git-ignored).
2. Render → **New → Web Service** → connect the repository.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the environment variables from section 4, with `NODE_ENV=production` and new secrets.
5. In Atlas **Network Access**, allow `0.0.0.0/0`.
6. After deploying, check https://crm-backend-352l.onrender.com/api/health. To get demo data, run `npm run seed -- --fresh` locally with the production `MONGO_URI`.

`app.set('trust proxy', 1)` is enabled so the rate limiter and secure cookies work correctly behind Render's proxy.

## 15. Assumptions

- **Teams:** a sales executive belongs to at most one sales manager (`user.manager`). A manager's team is the executives who reference them.
- **Assignees:** leads, customers and deals are owned by **sales executives**. Managers and admins supervise but are not assignees.
- **Registration** is public but always creates a sales executive (without a manager). An admin creates managers and assigns teams. The first registered user in an empty database becomes admin, to bootstrap a new installation.
- **Customer `status`** is `Active` or `Inactive`.
- **Deal creation** can happen during lead conversion or later for an existing customer (for example, upsells). In both cases the deal references the customer, and the original lead when there is one.
- **Total revenue** is the sum of **Won** deal values. **Expected revenue** is the probability-weighted value of **open** deals. **Conversion rate** is converted leads ÷ total leads.
- **Dashboard date range** (`from`/`to`) filters records by creation date. Activity counts always reflect the current pending/overdue state.
- **Logout** invalidates the user's sessions on all devices (`tokenVersion`). Per-device sessions would require storing refresh tokens.
- All times are stored in UTC. Date-only inputs (e.g. `2026-12-31`) are interpreted as UTC midnight, and `to` dates include the whole day.
