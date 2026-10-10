# Sample API Requests and Responses

Base URL: `http://localhost:5000/api` (local) or `https://<app>.onrender.com/api` (deployed).
All protected requests send `Authorization: Bearer <accessToken>`.
IDs below are examples from a test run.

---

## 1. Login

**Request**
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@crm.com", "password": "Admin1234" }
```

**Response 200**: the refresh token is also set as an HTTP-only cookie
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "6ac9d9949eba51c880d14db7",
      "name": "Admin User",
      "email": "admin@crm.com",
      "phone": "9876543210",
      "role": "admin",
      "manager": null,
      "isActive": true,
      "createdAt": "2026-10-10T06:22:12.063Z",
      "updatedAt": "2026-10-10T07:59:31.456Z",
      "lastLoginAt": "2026-10-10T07:59:31.455Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 401**: wrong password (same message for an unknown email)
```json
{ "success": false, "message": "Invalid email or password" }
```

---

## 2. Create user (admin)

**Request**
```http
POST /api/users

{
  "name": "Sales Exec Two",
  "email": "exec2@crm.com",
  "phone": "9876543213",
  "password": "Exec1234",
  "role": "sales_executive",
  "manager": "6aca17a8701b9ed66d5dca3f"
}
```

**Response 201**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "_id": "6aca1834701b9ed66d5dca40",
      "name": "Sales Exec Two",
      "email": "exec2@crm.com",
      "phone": "9876543213",
      "role": "sales_executive",
      "manager": { "_id": "6aca17a8701b9ed66d5dca3f", "name": "Manager One", "email": "manager1@crm.com" },
      "isActive": true,
      "createdAt": "2026-10-10T10:49:24.732Z",
      "updatedAt": "2026-10-10T10:49:24.732Z"
    }
  }
}
```

**Response 403**: the same request sent by a sales executive
```json
{ "success": false, "message": "You do not have permission to perform this action" }
```

---

## 3. List users (pagination, filter, sort)

```http
GET /api/users?role=sales_executive&search=exec&page=1&limit=5&sort=-createdAt
```
```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": { "users": [ { "_id": "6aca1834701b9ed66d5dca40", "name": "Sales Exec Two", "...": "..." } ] },
  "meta": { "page": 1, "limit": 5, "total": 2, "totalPages": 1 }
}
```

---

## 4. Create lead

**Request**
```http
POST /api/leads

{
  "name": "Rahul Sharma",
  "email": "rahul@acme.com",
  "phone": "9123456780",
  "company": "Acme Pvt Ltd",
  "source": "Website",
  "priority": "High",
  "description": "Interested in annual plan"
}
```

**Response 201**
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "lead": {
      "_id": "6aca1d66c0450c99b1aa814a",
      "name": "Rahul Sharma",
      "email": "rahul@acme.com",
      "phone": "9123456780",
      "company": "Acme Pvt Ltd",
      "source": "Website",
      "status": "New",
      "priority": "High",
      "assignedTo": null,
      "createdBy": { "_id": "6ac9d9949eba51c880d14db7", "name": "Admin User", "email": "admin@crm.com" },
      "description": "Interested in annual plan",
      "createdAt": "2026-10-10T11:11:34.037Z",
      "updatedAt": "2026-10-10T11:11:34.037Z"
    }
  }
}
```

**Response 400**: validation error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "source", "message": "Invalid option: expected one of \"Website\"|\"Referral\"|\"Social Media\"|\"Email\"|\"Phone\"|\"Other\"" }
  ]
}
```

**Response 409**: duplicate
```json
{ "success": false, "message": "An active lead with this email already exists" }
```

---

## 5. Assign lead

```http
PATCH /api/leads/6aca1d66c0450c99b1aa814a/assign

{ "assignedTo": "6aca1834701b9ed66d5dca40" }
```
```json
{
  "success": true,
  "message": "Lead assigned successfully",
  "data": {
    "lead": {
      "_id": "6aca1d66c0450c99b1aa814a",
      "status": "New",
      "assignedTo": { "_id": "6aca1834701b9ed66d5dca40", "name": "Sales Exec Two", "email": "exec2@crm.com", "role": "sales_executive" },
      "...": "..."
    }
  }
}
```

Assigning to a user who does not exist returns `400 { "success": false, "message": "Assignee not found" }`.

---

## 6. Update lead status

```http
PATCH /api/leads/6aca1d66c0450c99b1aa814a/status

{ "status": "Qualified" }
```
**200**: `"message": "Lead status updated successfully"`, `lead.status = "Qualified"`

Invalid transition:
```json
{ "success": false, "message": "Cannot change status from Contacted to New. Allowed: Qualified, Unqualified, Lost" }
```

---

## 7. Convert lead (MongoDB transaction)

**Request**
```http
POST /api/leads/6aca1d66c0450c99b1aa814a/convert

{
  "customer": { "address": { "city": "Bengaluru", "state": "Karnataka", "country": "India" } },
  "deal": {
    "name": "Acme Annual Plan",
    "value": 250000,
    "expectedCloseDate": "2026-12-31",
    "description": "Annual subscription for 50 users"
  }
}
```

**Response 201**
```json
{
  "success": true,
  "message": "Lead converted successfully",
  "data": {
    "lead": {
      "_id": "6aca1d66c0450c99b1aa814a",
      "name": "Rahul Sharma",
      "status": "Converted",
      "convertedAt": "2026-10-10T11:56:51.625Z",
      "convertedCustomer": "6aca2803b1de3d4ddb2ab49d",
      "convertedDeal": "6aca2803b1de3d4ddb2ab49e"
    },
    "customer": {
      "_id": "6aca2803b1de3d4ddb2ab49d",
      "name": "Rahul Sharma",
      "email": "rahul@acme.com",
      "company": "Acme Pvt Ltd",
      "address": { "city": "Bengaluru", "state": "Karnataka", "country": "India" },
      "lead": "6aca1d66c0450c99b1aa814a",
      "assignedTo": "6aca1834701b9ed66d5dca40",
      "status": "Active"
    },
    "deal": {
      "_id": "6aca2803b1de3d4ddb2ab49e",
      "name": "Acme Annual Plan",
      "lead": "6aca1d66c0450c99b1aa814a",
      "customer": "6aca2803b1de3d4ddb2ab49d",
      "assignedTo": "6aca1834701b9ed66d5dca40",
      "value": 250000,
      "stage": "Qualification",
      "probability": 10,
      "expectedRevenue": 25000,
      "status": "Open",
      "expectedCloseDate": "2026-12-31T00:00:00.000Z"
    }
  }
}
```

Lead not qualified: `400 { "success": false, "message": "Only Qualified leads can be converted (current status: Contacted)" }`
Converting again: `409 { "success": false, "message": "Lead has already been converted" }`

---

## 8. Get customer (with original lead and deals)

```http
GET /api/customers/6aca2803b1de3d4ddb2ab49d
```
```json
{
  "success": true,
  "message": "Customer fetched successfully",
  "data": {
    "customer": {
      "_id": "6aca2803b1de3d4ddb2ab49d",
      "name": "Rahul Sharma",
      "status": "Active",
      "lead": {
        "_id": "6aca1d66c0450c99b1aa814a",
        "name": "Rahul Sharma",
        "source": "Website",
        "status": "Converted",
        "convertedAt": "2026-10-10T11:56:51.625Z"
      },
      "assignedTo": { "_id": "6aca1834701b9ed66d5dca40", "name": "Sales Exec Two", "...": "..." },
      "deals": [
        {
          "_id": "6aca2803b1de3d4ddb2ab49e",
          "name": "Acme Annual Plan",
          "customer": "6aca2803b1de3d4ddb2ab49d",
          "value": 250000,
          "expectedRevenue": 25000,
          "stage": "Qualification",
          "status": "Open",
          "probability": 10
        }
      ]
    }
  }
}
```

Deleting this customer returns `409 { "success": false, "message": "Customer has 1 deal(s) and cannot be deleted. Set status to Inactive instead." }`

---

## 9. Change deal stage

```http
PATCH /api/deals/6aca2803b1de3d4ddb2ab49e/stage

{ "stage": "Proposal" }
```
```json
{
  "success": true,
  "message": "Deal moved to Proposal",
  "data": {
    "deal": {
      "_id": "6aca2803b1de3d4ddb2ab49e",
      "value": 250000,
      "stage": "Proposal",
      "probability": 50,
      "expectedRevenue": 125000,
      "status": "Open",
      "...": "..."
    }
  }
}
```

`{ "stage": "Won" }` returns 200 with `probability: 100`, `expectedRevenue: 250000`, `status: "Won"` and `closedAt` set.

Errors:
```json
{ "success": false, "message": "Validation failed",
  "errors": [{ "field": "lostReason", "message": "lostReason is required when marking a deal as Lost" }] }
```
```json
{ "success": false, "message": "A reason is required to reopen a closed deal" }
```

---

## 10. Filter deals

```http
GET /api/deals?status=Won&minValue=100000&sort=-value
```
```json
{
  "success": true,
  "message": "Deals fetched successfully",
  "data": { "deals": [ { "_id": "6aca2803b1de3d4ddb2ab49e", "name": "Acme Annual Plan", "value": 250000, "stage": "Won", "...": "..." } ] },
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

---

## 11. Activities (overdue computed by the backend)

**Create**
```http
POST /api/activities

{
  "type": "Follow-up",
  "title": "Call Rahul about onboarding",
  "description": "Confirm start date for 50 users",
  "dueDate": "2026-10-15",
  "relatedType": "Customer",
  "relatedId": "6aca2803b1de3d4ddb2ab49d",
  "assignedTo": "6aca1834701b9ed66d5dca40"
}
```
201: `"status": "Pending"`, `"relatedId": { "_id": "6aca2803b1de3d4ddb2ab49d", "name": "Rahul Sharma" }`

**List pending and overdue**
```http
GET /api/activities?status=Pending,Overdue
```
```json
{
  "success": true,
  "message": "Activities fetched successfully",
  "data": {
    "activities": [
      {
        "_id": "6aca903b73ce88e9bc53d2c0",
        "type": "Follow-up",
        "title": "Send invoice",
        "status": "Overdue",
        "dueDate": "2026-10-10T18:31:00.000Z",
        "assignedTo": { "_id": "6aca1834701b9ed66d5dca40", "name": "Sales Exec Two", "email": "exec2@crm.com", "role": "sales_executive" },
        "relatedType": "Customer",
        "relatedId": { "_id": "6aca2803b1de3d4ddb2ab49d", "name": "Rahul Sharma" },
        "isOverdue": true
      },
      {
        "_id": "6aca89bf2b1ac66495d039bc",
        "type": "Follow-up",
        "title": "Call Rahul about onboarding",
        "status": "Pending",
        "dueDate": "2026-10-15T00:00:00.000Z",
        "isOverdue": false
      }
    ]
  },
  "meta": { "page": 1, "limit": 10, "total": 2, "totalPages": 1 }
}
```

**Complete**
```http
PATCH /api/activities/6aca89bf2b1ac66495d039bc/complete

{ "outcome": "Start date confirmed for 1 Nov" }
```
200: `"message": "Activity marked as completed"`, `"status": "Completed"`, `completedAt` set.
Again: `409 { "success": false, "message": "Activity is already completed" }`

---

## 12. Timeline

```http
GET /api/deals/6aca2803b1de3d4ddb2ab49e/timeline
```
```json
{
  "success": true,
  "message": "Deal timeline fetched successfully",
  "data": {
    "events": [
      {
        "_id": "6aca8291bb4fc0c42311b6eb",
        "action": "deal_won",
        "entityType": "Deal",
        "entityId": "6aca2803b1de3d4ddb2ab49e",
        "performedBy": { "_id": "6ac9d9949eba51c880d14db7", "name": "Admin User", "email": "admin@crm.com", "role": "admin" },
        "previousValue": null,
        "newValue": { "value": 250000, "closedAt": "2026-10-10T18:22:41.000Z" },
        "createdAt": "2026-10-10T18:22:41.010Z"
      },
      {
        "action": "deal_stage_changed",
        "previousValue": { "stage": "Proposal", "probability": 50, "expectedRevenue": 125000 },
        "newValue": { "stage": "Won", "probability": 100, "expectedRevenue": 250000 }
      },
      {
        "action": "deal_stage_changed",
        "previousValue": { "stage": "Qualification", "probability": 10, "expectedRevenue": 25000 },
        "newValue": { "stage": "Proposal", "probability": 50, "expectedRevenue": 125000 }
      },
      { "action": "deal_created", "newValue": { "name": "Acme Annual Plan", "value": 250000, "stage": "Qualification" } }
    ]
  },
  "meta": { "page": 1, "limit": 10, "total": 4, "totalPages": 1 }
}
```

---

## 13. Dashboard

**Stats**
```http
GET /api/dashboard/stats
```
```json
{
  "success": true,
  "message": "Dashboard stats fetched successfully",
  "data": {
    "leads": { "total": 1, "new": 0, "contacted": 0, "qualified": 0, "unqualified": 0, "converted": 1, "lost": 0 },
    "customers": { "total": 1 },
    "deals": { "total": 1, "open": 0, "won": 1, "lost": 0 },
    "revenue": { "totalRevenue": 250000, "expectedRevenue": 0, "openPipelineValue": 0 },
    "rates": { "conversionRate": 100, "winRate": 100 },
    "activities": { "pending": 1, "overdue": 1 }
  }
}
```

**Pipeline**
```http
GET /api/dashboard/pipeline
```
```json
{
  "success": true,
  "message": "Sales pipeline fetched successfully",
  "data": {
    "stages": [
      { "stage": "Qualification", "count": 0, "totalValue": 0, "expectedRevenue": 0, "avgProbability": 0 },
      { "stage": "Discovery", "count": 0, "totalValue": 0, "expectedRevenue": 0, "avgProbability": 0 },
      { "stage": "Proposal", "count": 0, "totalValue": 0, "expectedRevenue": 0, "avgProbability": 0 },
      { "stage": "Negotiation", "count": 0, "totalValue": 0, "expectedRevenue": 0, "avgProbability": 0 },
      { "stage": "Won", "count": 1, "totalValue": 250000, "expectedRevenue": 250000, "avgProbability": 100 },
      { "stage": "Lost", "count": 0, "totalValue": 0, "expectedRevenue": 0, "avgProbability": 0 }
    ],
    "totals": { "deals": 1, "totalValue": 250000, "expectedRevenue": 250000 }
  }
}
```

**Team performance** (admin/manager)
```http
GET /api/dashboard/team-performance
```
```json
{
  "success": true,
  "message": "Team performance fetched successfully",
  "data": {
    "summary": {
      "members": 2, "leads": 1, "convertedLeads": 1, "dealsWon": 1,
      "revenueWon": 250000, "overdueActivities": 1, "conversionRate": 100
    },
    "team": [
      {
        "user": { "_id": "6aca1834701b9ed66d5dca40", "name": "Sales Exec Two", "email": "exec2@crm.com", "isActive": true,
                  "manager": { "_id": "6aca17a8701b9ed66d5dca3f", "name": "Manager One" } },
        "leads": { "total": 1, "converted": 1, "conversionRate": 100 },
        "deals": { "total": 1, "won": 1, "lost": 0, "winRate": 100 },
        "revenue": { "won": 250000, "openPipelineValue": 0, "expectedRevenue": 0 },
        "activities": { "pending": 1, "overdue": 1 }
      }
    ]
  }
}
```

---

## 14. Common errors

| Case | Response |
|---|---|
| No token | `401 { "success": false, "message": "Not authenticated. Please log in." }` |
| Expired token | `401 { "success": false, "message": "Token expired, please log in again" }` |
| After logout | `401 { "success": false, "message": "Session expired. Please log in again." }` |
| Executive calls `/users` | `403 { "success": false, "message": "You do not have permission to perform this action" }` |
| Another team's lead | `404 { "success": false, "message": "Lead not found" }` |
| Invalid ID | `400 { "success": false, "message": "Validation failed", "errors": [{ "field": "id", "message": "Invalid ID format" }] }` |
| Unknown route | `404 { "success": false, "message": "Route GET /api/abc not found" }` |
| Too many requests | `429 { "success": false, "message": "Too many requests, please try again later." }` |
