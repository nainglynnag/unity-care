# UnityCare API — Public (Civilian) Routes

Base URL: `/api/v1`

All protected routes require the header:

```
Authorization: Bearer <accessToken>
```

---

## Authentication

### Endpoints

| Method | Endpoint         | Auth     | Description                     |
| ------ | ---------------- | -------- | ------------------------------- |
| `POST` | `/auth/register` | None     | Register a new civilian account |
| `POST` | `/auth/login`    | None     | Login and receive tokens        |
| `POST` | `/auth/refresh`  | None     | Refresh an expired access token |
| `GET`  | `/auth/me`       | Required | Get current authenticated user  |

---

### `POST /auth/register`

**Request Body**

| Field             | Type     | Required | Rules                           |
| ----------------- | -------- | -------- | ------------------------------- |
| `name`            | `string` | ✅       | Min 2 characters                |
| `email`           | `string` | ✅       | Valid email format              |
| `phone`           | `string` | ✅       | 7–15 digits, may start with `+` |
| `password`        | `string` | ✅       | Min 6 characters                |
| `confirmPassword` | `string` | ✅       | Must match `password`           |

**Response `201`**

```json
{
  "meta": { "success": true, "timestamp": "...", "requestId": "..." },
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "uuid",
      "name": "Anna Lee",
      "email": "anna@mail.com",
      "phone": "+66812345678",
      "role": "CIVILIAN",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

---

### `POST /auth/login`

**Request Body**

| Field      | Type     | Required | Rules              |
| ---------- | -------- | -------- | ------------------ |
| `email`    | `string` | ✅       | Valid email format |
| `password` | `string` | ✅       | Min 6 characters   |

**Response `200`** — same shape as register.

---

### `POST /auth/refresh`

**Request Body**

| Field          | Type     | Required | Rules                           |
| -------------- | -------- | -------- | ------------------------------- |
| `refreshToken` | `string` | ✅       | Valid non-expired refresh token |

**Response `200`**

```json
{
  "data": {
    "accessToken": "<new jwt>",
    "refreshToken": "<new jwt>"
  }
}
```

---

### `GET /auth/me`

No request body. Returns the decoded JWT payload of the current user.

---

## Incidents

> All incident routes require authentication.
> Civilians can only access their own incidents except `GET /incidents/:id`.

### Endpoints

| Method  | Endpoint               | Role       | Description                                                                   |
| ------- | ---------------------- | ---------- | ----------------------------------------------------------------------------- |
| `POST`  | `/incidents`           | `CIVILIAN` | Report a new incident                                                         |
| `GET`   | `/incidents/me`        | `CIVILIAN` | List my reported incidents                                                    |
| `GET`   | `/incidents/:id`       | Any        | Get a single incident detail. Civilian can only view incidents they reported. |
| `PATCH` | `/incidents/:id/close` | `CIVILIAN` | Self-close your own incident                                                  |

---

### `POST /incidents`

**Request Body**

| Field          | Type      | Required | Rules                                                                                 |
| -------------- | --------- | -------- | ------------------------------------------------------------------------------------- |
| `title`        | `string`  | ✅       | Min 3 characters                                                                      |
| `categoryId`   | `string`  | ✅       | Valid UUID of an active `IncidentCategory`                                            |
| `latitude`     | `number`  | ✅       | Between `-90` and `90`                                                                |
| `longitude`    | `number`  | ✅       | Between `-180` and `180`                                                              |
| `forSelf`      | `boolean` | ✅       | `true` = reporting for yourself · `false` = reporting for someone else                |
| `description`  | `string`  | ❌       | Free-text description                                                                 |
| `addressText`  | `string`  | ❌       | Human-readable address                                                                |
| `landmark`     | `string`  | ❌       | Nearby landmark                                                                       |
| `accuracy`     | `string`  | ❌       | `GPS` · `MANUAL` · `VERIFIED`                                                         |
| `reporterNote` | `string`  | ⚠️       | **Required when `forSelf` is `false`** — describe the victim/situation                |
| `media`        | `array`   | ❌       | Up to 5 items. Each item: `{ url: string, mediaType: "IMAGE" \| "VIDEO" \| "AUDIO" }` |

> **`forSelf: true`** — System attaches the reporter's `EmergencyProfile` and emergency contacts to the response if they exist.
>
> **`forSelf: false`** — `EmergencyProfile` is skipped. `reporterNote` is required to give the agency context about the victim.

**Response `201`**

```json
{
  "data": {
    "incident": {
      "id": "uuid",
      "title": "...",
      "status": "REPORTED",
      "latitude": 13.7563,
      "longitude": 100.5018,
      "category": { "id": "...", "name": "Medical Emergency" },
      "reporter": { "id": "...", "name": "Anna Lee", "email": "..." },
      "media": [{ "id": "...", "url": "https://...", "mediaType": "IMAGE" }]
    },
    "emergencyProfile": {
      "bloodType": "O+",
      "allergies": "Penicillin",
      "medicalConditions": null,
      "contacts": [
        { "name": "Sarah Lee", "phone": "+66812345678", "isPrimary": true }
      ]
    }
  }
}
```

> `emergencyProfile` is `null` when `forSelf` is `false` or when the reporter has not set up a profile.

---

### `GET /incidents/me`

**Query Parameters**

| Param     | Type     | Required | Rules                                                                                                                        |
| --------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `status`  | `string` | ❌       | Filter by status: `REPORTED` · `AWAITING_VERIFICATION` · `VERIFIED` · `UNREACHABLE` · `FALSE_REPORT` · `RESOLVED` · `CLOSED` |
| `page`    | `number` | ❌       | Default `1`                                                                                                                  |
| `perPage` | `number` | ❌       | Default `10` · Max `100`                                                                                                     |

**Response `200`** — paginated list of the authenticated user's incidents.

---

### `GET /incidents/:id`

No request body.

- **ADMIN / VOLUNTEER** — can view any incident.
- **CIVILIAN** — can only view incidents they reported. Returns `404` if the incident exists but belongs to another user.

**Response `200`** — full incident detail including `category`, `reporter`, `emergencyProfile`, `verifications`, and `media`.

---

### `PATCH /incidents/:id/close`

Self-close an incident you reported. Only allowed when the current status is `REPORTED` or `VERIFIED`.

> Incidents in `UNREACHABLE`, or `FALSE_REPORT` cannot be self-closed — the agency owns those states.

**Request Body**

| Field  | Type     | Required | Rules                                 |
| ------ | -------- | -------- | ------------------------------------- |
| `note` | `string` | ✅       | Min 5 characters — reason for closing |

**Response `200`**

```json
{
  "data": {
    "id": "uuid",
    "status": "CLOSED",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

## Error Responses

All errors follow the same shape:

```json
{
  "meta": { "success": false, "timestamp": "...", "requestId": "..." },
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message.",
    "details": []
  }
}
```

| HTTP  | Code                        | Cause                                                                        |
| ----- | --------------------------- | ---------------------------------------------------------------------------- |
| `401` | `UNAUTHORIZED`              | No token provided                                                            |
| `401` | `INVALID_TOKEN`             | Token is malformed or expired                                                |
| `401` | `INVALID_CREDENTIALS`       | Wrong email or password                                                      |
| `403` | `FORBIDDEN`                 | Role not permitted for this route                                            |
| `403` | `ACCOUNT_INACTIVE`          | Account has been deactivated                                                 |
| `404` | `INCIDENT_NOT_FOUND`        | Incident does not exist or does not belong to you                            |
| `404` | `CATEGORY_NOT_FOUND`        | `categoryId` does not match any active category                              |
| `409` | `DUPLICATE_FIELD`           | Email or phone already registered                                            |
| `400` | `INVALID_STATUS_TRANSITION` | Cannot close incident from its current state                                 |
| `422` | `VALIDATION_ERROR`          | Request body failed schema validation · `details[]` lists each failing field |
