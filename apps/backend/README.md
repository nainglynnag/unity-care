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

## Emergency Profiles

> All emergency profile routes require authentication.
> Civilians can only access their own emergency profile.

### Endpoints

| Method  | Endpoint                  | Role                | Description                      |
| ------- | ------------------------- | ------------------- | -------------------------------- |
| `GET`   | `/emergency-profiles/me`  | `CIVILIAN`          | Get my emergency profile         |
| `POST`  | `/emergency-profiles/me`  | `CIVILIAN`          | Create my emergency profile      |
| `PATCH` | `/emergency-profiles/me`  | `CIVILIAN`          | Update my emergency profile      |
| `GET`   | `/emergency-profiles`     | `ADMIN`             | Get all emergency profiles       |
| `GET`   | `/emergency-profiles/:id` | `ADMIN / VOLUNTEER` | Get a specific emergency profile |

---

### `GET /emergency-profiles/me`

No request body.

**Response `200`**

```json
{
  "data": {
    "id": "uuid",
    "fullName": "Anna Lee",
    "dateOfBirth": "1990-01-01T00:00:00.000Z",
    "bloodType": "O+",
    "allergies": "Penicillin",
    "medicalConditions": null,
    "medications": null,
    "consentGivenAt": "2026-01-01T00:00:00.000Z",
    "contacts": [
      {
        "id": "uuid",
        "name": "Sarah Lee",
        "phone": "+66812345678",
        "relationship": "Sister",
        "isPrimary": true
      }
    ]
  }
}
```

---

### `POST /emergency-profiles/me`

**Request Body**

| Field               | Type      | Required | Rules             |
| ------------------- | --------- | -------- | ----------------- |
| `fullName`          | `string`  | ✅       | Min 2 characters  |
| `dateOfBirth`       | `string`  | ❌       | Valid date string |
| `bloodType`         | `string`  | ❌       | Max 5 characters  |
| `allergies`         | `string`  | ❌       | Free-text         |
| `medicalConditions` | `string`  | ❌       | Free-text         |
| `medications`       | `string`  | ❌       | Free-text         |
| `consentGiven`      | `boolean` | ✅       | Must be `true`    |

**Response `201`** — Returns the created profile.

---

### `PATCH /emergency-profiles/me`

**Request Body**

Same fields as `POST /emergency-profiles/me`, but all are optional. `consentGiven` cannot be revoked once given.

**Response `200`** — Returns the updated profile.

---

## Volunteer Applications

> All volunteer application routes require authentication.

### Endpoints

| Method  | Endpoint                     | Role       | Description                                                        |
| ------- | ---------------------------- | ---------- | ------------------------------------------------------------------ |
| `POST`  | `/applications`              | `CIVILIAN` | Submit a new volunteer application                                 |
| `GET`   | `/applications/me`           | `CIVILIAN` | List my volunteer applications                                     |
| `GET`   | `/applications/:id`          | Any        | Get a single application detail. Civilian can only view their own. |
| `PATCH` | `/applications/:id`          | `CIVILIAN` | Update a pending application                                       |
| `PATCH` | `/applications/:id/withdraw` | `CIVILIAN` | Withdraw a pending application                                     |

---

### `POST /applications`

**Request Body**

| Field              | Type       | Required | Rules                                                                                              |
| ------------------ | ---------- | -------- | -------------------------------------------------------------------------------------------------- |
| `agencyId`         | `string`   | ✅       | Valid UUID of an `Agency`                                                                          |
| `skillIds`         | `string[]` | ✅       | Array of valid `Skill` UUIDs (min 1)                                                               |
| `dateOfBirth`      | `string`   | ✅       | Valid date string. Must be 18+ years old.                                                          |
| `nationalIdNumber` | `string`   | ✅       | Min 5 characters                                                                                   |
| `nationalIdUrl`    | `string`   | ✅       | Valid URL                                                                                          |
| `address`          | `string`   | ✅       | Min 5 characters                                                                                   |
| `hasTransport`     | `boolean`  | ✅       | `true` or `false`                                                                                  |
| `experience`       | `string`   | ❌       | Free-text                                                                                          |
| `consentGiven`     | `boolean`  | ✅       | Must be `true`                                                                                     |
| `certificates`     | `array`    | ❌       | Max 10 items. Each item: `{ name: string, fileUrl: string, issuedBy?: string, issuedAt?: string }` |

**Response `201`** — Returns the created application with nested certificates and agency details.

---

### `GET /applications/me`

No request body.

**Response `200`** — List of the authenticated user's applications, ordered by `submittedAt` descending.

---

### `GET /applications/:id`

No request body.

- **ADMIN / VOLUNTEER** — can view any application.
- **CIVILIAN** — can only view their own applications. Returns `403` if the application belongs to another user.

**Response `200`** — Full application detail including `certificates`, `agency`, and `applicant`.

---

### `PATCH /applications/:id`

Update an application. Only allowed when the current status is `PENDING`.

**Request Body**

Same fields as `POST /applications`, but all are optional. `consentGiven` cannot be revoked once given.

**Response `200`** — Returns the updated application.

---

### `PATCH /applications/:id/withdraw`

Withdraw an application. Only allowed when the current status is `PENDING`.

No request body.

**Response `200`**

```json
{
  "data": {
    "application": {
      "id": "uuid",
      "status": "WITHDRAWN"
    },
    "message": "Application withdrawn. You may now apply to another agency."
  }
}
```

---

## Volunteer Profile

> All volunteer profile routes require authentication and the `VOLUNTEER` role.

### Endpoints

| Method  | Endpoint                              | Role        | Description                   |
| ------- | ------------------------------------- | ----------- | ----------------------------- |
| `GET`   | `/volunteer-profiles/me`              | `VOLUNTEER` | Get my volunteer profile      |
| `PATCH` | `/volunteer-profiles/me`              | `VOLUNTEER` | Update my volunteer profile   |
| `PATCH` | `/volunteer-profiles/me/availability` | `VOLUNTEER` | Update my availability status |

---

### `GET /volunteer-profiles/me`

No request body.

**Response `200`**

```json
{
  "data": {
    "userId": "uuid",
    "isAvailable": true,
    "availabilityRadiusKm": 10,
    "lastKnownLatitude": 13.7563,
    "lastKnownLongitude": 100.5018,
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "skills": [
      {
        "skill": {
          "id": "uuid",
          "name": "First Aid"
        }
      }
    ]
  }
}
```

---

### `PATCH /volunteer-profiles/me`

**Request Body**

| Field                  | Type       | Required | Rules                                                                |
| ---------------------- | ---------- | -------- | -------------------------------------------------------------------- |
| `availabilityRadiusKm` | `number`   | ❌       | Between `1` and `500`                                                |
| `lastKnownLatitude`    | `number`   | ❌       | Between `-90` and `90`. Must be provided with `lastKnownLongitude`.  |
| `lastKnownLongitude`   | `number`   | ❌       | Between `-180` and `180`. Must be provided with `lastKnownLatitude`. |
| `skillIds`             | `string[]` | ❌       | Array of valid `Skill` UUIDs                                         |

**Response `200`** — Returns the updated profile.

---

### `PATCH /volunteer-profiles/me/availability`

**Request Body**

| Field         | Type      | Required | Rules                                                       |
| ------------- | --------- | -------- | ----------------------------------------------------------- |
| `isAvailable` | `boolean` | ✅       | `true` = online · `false` = offline                         |
| `latitude`    | `number`  | ❌       | Between `-90` and `90`. Must be provided with `longitude`.  |
| `longitude`   | `number`  | ❌       | Between `-180` and `180`. Must be provided with `latitude`. |

**Response `200`** — Returns the updated profile.

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

| HTTP  | Code                           | Cause                                                                        |
| ----- | ------------------------------ | ---------------------------------------------------------------------------- |
| `401` | `UNAUTHORIZED`                 | No token provided                                                            |
| `401` | `INVALID_TOKEN`                | Token is malformed or expired                                                |
| `401` | `INVALID_CREDENTIALS`          | Wrong email or password                                                      |
| `403` | `FORBIDDEN`                    | Role not permitted for this route                                            |
| `403` | `ACCOUNT_INACTIVE`             | Account has been deactivated                                                 |
| `403` | `NOT_AN_APPROVED_VOLUNTEER`    | User must be an approved volunteer                                           |
| `404` | `INCIDENT_NOT_FOUND`           | Incident does not exist or does not belong to you                            |
| `404` | `CATEGORY_NOT_FOUND`           | `categoryId` does not match any active category                              |
| `404` | `AGENCY_NOT_FOUND`             | The selected agency does not exist                                           |
| `404` | `APPLICATION_NOT_FOUND`        | The requested application could not be found                                 |
| `404` | `PROFILE_NOT_FOUND`            | Volunteer profile not found                                                  |
| `409` | `DUPLICATE_FIELD`              | Email or phone already registered                                            |
| `409` | `APPLICATION_ALREADY_ACTIVE`   | User already has an active application with an agency                        |
| `400` | `INVALID_STATUS_TRANSITION`    | Cannot close incident from its current state                                 |
| `400` | `APPLICATION_NOT_EDITABLE`     | Application is no longer editable                                            |
| `400` | `CANNOT_WITHDRAW_AFTER_REVIEW` | Applications cannot be withdrawn after review has started                    |
| `400` | `INVALID_SKILL_IDS`            | One or more skill IDs do not exist                                           |
| `422` | `VALIDATION_ERROR`             | Request body failed schema validation · `details[]` lists each failing field |
