# UnityCare API — Route Reference

Base URL: `/api/v1`

All protected routes require:

```
Authorization: Bearer <accessToken>
```

All success responses use:

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": {
      "limit": 200,
      "remaining": 199,
      "reset": 845
    }
  },
  "data": {}
}
```

`meta.rateLimit` is populated from rate-limit headers when a limiter is applied.
If no limiter headers are present for a response, `meta.rateLimit` is `null`.

---

## Rate Limiting

UnityCare uses `express-rate-limit` with standard headers enabled.

### Active limits

| Route                              | Window     | Limit | Key    |
| ---------------------------------- | ---------- | ----- | ------ |
| `POST /auth/register`              | 1 hour     | 5     | IP     |
| `POST /auth/login`                 | 15 minutes | 10    | IP     |
| `POST /auth/refresh`               | 15 minutes | 30    | IP     |
| `POST /auth/signout`               | 15 minutes | 10    | userId |
| `POST /auth/signout-all`           | 15 minutes | 10    | userId |
| `POST /incidents`                  | 1 hour     | 10    | userId |
| `POST /incidents/:id/verification` | 1 hour     | 20    | userId |
| `POST /applications`               | 1 hour     | 5     | userId |
| `GET /dashboard/*`                 | 15 minutes | 30    | userId |
| `GET /notifications*`              | 15 minutes | 120   | userId |
| `POST /missions/:id/tracking`      | 15 minutes | 60    | userId |
| `PATCH /account/password`          | 15 minutes | 10    | userId |
| `PATCH /users/:id/password/reset`  | 15 minutes | 20    | userId |
| `PATCH /users/:id/status`          | 15 minutes | 20    | userId |
| `DELETE /users/:id`                | 15 minutes | 20    | userId |
| All other routes                   | 15 minutes | 200   | IP     |

### Response metadata

On rate-limited routes, `meta.rateLimit` contains:

```json
{
  "limit": 10,
  "remaining": 9,
  "reset": 840,
  "retryAfter": 840
}
```

- `retryAfter` appears on `429` responses.
- `reset` is the seconds until the current window resets.

### `429 Too Many Requests` shape

```json
{
  "meta": {
    "success": false,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": {
      "limit": 10,
      "remaining": 0,
      "reset": 300,
      "retryAfter": 300
    }
  },
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please wait 15 minutes before trying again.",
    "details": []
  }
}
```

---

## Authentication

### Endpoints

| Method | Endpoint            | Auth     | Description                               |
| ------ | ------------------- | -------- | ----------------------------------------- |
| `POST` | `/auth/register`    | None     | Register a new civilian account           |
| `POST` | `/auth/login`       | None     | Sign in and receive access/refresh tokens |
| `POST` | `/auth/refresh`     | None     | Rotate and issue a new token pair         |
| `GET`  | `/auth/me`          | Required | Get current authenticated user profile    |
| `POST` | `/auth/signout`     | Required | Revoke current refresh token session      |
| `POST` | `/auth/signout-all` | Required | Revoke all refresh token sessions         |

### `POST /auth/register`

**Request Body**

| Field             | Type     | Required | Rules                            |
| ----------------- | -------- | -------- | -------------------------------- |
| `name`            | `string` | ✅       | Min 2 characters                 |
| `email`           | `string` | ✅       | Valid email format               |
| `phone`           | `string` | ✅       | 7–15 digits, optional `+` prefix |
| `password`        | `string` | ✅       | Min 6 characters                 |
| `confirmPassword` | `string` | ✅       | Must match `password`            |

**Sample Response `201`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
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

### `POST /auth/login`

**Request Body**

| Field      | Type     | Required | Rules              |
| ---------- | -------- | -------- | ------------------ |
| `email`    | `string` | ✅       | Valid email format |
| `password` | `string` | ✅       | Min 6 characters   |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": {
      "id": "uuid",
      "name": "Anna Lee",
      "email": "anna@mail.com",
      "phone": "+66812345678",
      "role": "CIVILIAN"
    }
  }
}
```

### `POST /auth/refresh`

**Request Body**

| Field          | Type     | Required | Rules                     |
| -------------- | -------- | -------- | ------------------------- |
| `refreshToken` | `string` | ✅       | Valid refresh token value |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "accessToken": "<new-jwt>",
    "refreshToken": "<new-jwt>"
  }
}
```

### `GET /auth/me`

No request body.

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "id": "uuid",
    "name": "Anna Lee",
    "email": "anna@mail.com",
    "phone": "+66812345678",
    "role": "CIVILIAN",
    "lastLoginAt": "2026-03-02T10:00:00.000Z"
  }
}
```

### `POST /auth/signout`

**Request Body**

| Field          | Type     | Required | Rules                      |
| -------------- | -------- | -------- | -------------------------- |
| `refreshToken` | `string` | ✅       | Current device token value |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "revokedCount": 1
  }
}
```

### `POST /auth/signout-all`

No request body.

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "revokedCount": 3
  }
}
```

---

## Account (`/account`)

| Method   | Endpoint            | Role                   | Description                                    |
| -------- | ------------------- | ---------------------- | ---------------------------------------------- |
| `PATCH`  | `/account/profile`  | Any authenticated user | Update own profile (`name`, `profileImageUrl`) |
| `PATCH`  | `/account/password` | Any authenticated user | Change own password                            |
| `DELETE` | `/account`          | Any authenticated user | Soft delete own account                        |

### `PATCH /account/profile`

| Field             | Type     | Required | Rules          |
| ----------------- | -------- | -------- | -------------- |
| `name`            | `string` | ❌       | Min 2, max 100 |
| `profileImageUrl` | `string` | ❌       | Valid URL      |

> At least one field is required.

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "id": "uuid",
    "name": "Anna Lee",
    "email": "anna@mail.com",
    "phone": "+66812345678",
    "profileImageUrl": "https://cdn.example.com/avatar.jpg"
  }
}
```

### `PATCH /account/password`

| Field                | Type     | Required | Rules                              |
| -------------------- | -------- | -------- | ---------------------------------- |
| `currentPassword`    | `string` | ✅       | Required                           |
| `newPassword`        | `string` | ✅       | Min 6, must differ from current    |
| `confirmNewPassword` | `string` | ✅       | Must match `newPassword`           |
| `refreshToken`       | `string` | ✅       | Current session token (kept alive) |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "message": "Password updated successfully."
  }
}
```

### `DELETE /account`

No request body.

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "message": "Account deleted."
  }
}
```

---

## User Management (`/users`)

> All `/users` routes require `SUPERADMIN`.

| Method   | Endpoint                    | Role         | Description                            |
| -------- | --------------------------- | ------------ | -------------------------------------- |
| `GET`    | `/users`                    | `SUPERADMIN` | List users with filters and pagination |
| `PATCH`  | `/users/:id/password/reset` | `SUPERADMIN` | Reset target user password             |
| `PATCH`  | `/users/:id/status`         | `SUPERADMIN` | Activate or deactivate target user     |
| `DELETE` | `/users/:id`                | `SUPERADMIN` | Permanently delete target user         |

### `GET /users`

**Query Parameters**

| Param      | Type     | Required | Rules                                                  |
| ---------- | -------- | -------- | ------------------------------------------------------ |
| `role`     | `string` | ❌       | `CIVILIAN` · `VOLUNTEER` · `ADMIN` · `SUPERADMIN`      |
| `isActive` | `string` | ❌       | Must be exactly `true` or `false`                      |
| `search`   | `string` | ❌       | Case-insensitive partial match on name/email (max 100) |
| `page`     | `number` | ❌       | Default `1`                                            |
| `perPage`  | `number` | ❌       | Default `20`, max `100`                                |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null,
    "pagination": {
      "totalPages": 2,
      "totalRecords": 22,
      "currentPage": 1,
      "perPage": 20
    }
  },
  "data": [
    {
      "id": "uuid",
      "name": "Anna Lee",
      "email": "anna@mail.com",
      "role": "CIVILIAN",
      "isActive": true,
      "deletedAt": null,
      "lastLoginAt": "2026-03-02T10:00:00.000Z"
    }
  ],
  "links": {
    "self": "/api/v1/users?page=1&perPage=20",
    "next": "/api/v1/users?page=2&perPage=20"
  }
}
```

### `PATCH /users/:id/password/reset`

| Field                | Type      | Required | Rules                    |
| -------------------- | --------- | -------- | ------------------------ |
| `newPassword`        | `string`  | ✅       | Min 6                    |
| `confirmNewPassword` | `string`  | ✅       | Must match `newPassword` |
| `deactivate`         | `boolean` | ❌       | Default `true`           |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "message": "Password reset successfully."
  }
}
```

### `PATCH /users/:id/status`

| Field      | Type      | Required | Rules                          |
| ---------- | --------- | -------- | ------------------------------ |
| `isActive` | `boolean` | ✅       | Required                       |
| `reason`   | `string`  | ❌       | Min 5 characters when provided |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "message": "Account deactivated."
  }
}
```

### `DELETE /users/:id`

No request body.

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "message": "Account permanently deleted."
  }
}
```

---

## Incidents (`/incidents`)

> All `/incidents` routes require authentication.

### Endpoints

| Method  | Endpoint                              | Role                               | Description                                           |
| ------- | ------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `POST`  | `/incidents`                          | `CIVILIAN`                         | Create a new incident                                 |
| `GET`   | `/incidents/me`                       | `CIVILIAN`                         | List incidents created by current civilian            |
| `GET`   | `/incidents/assigned`                 | `VOLUNTEER`                        | List incidents assigned to current volunteer          |
| `GET`   | `/incidents/:id`                      | Any authenticated user             | Get incident detail (access scoped in service)        |
| `PATCH` | `/incidents/:id/close`                | `CIVILIAN`                         | Close own incident                                    |
| `PATCH` | `/incidents/:id/assign-verifier`      | Any authenticated user             | Assign verifier (agency authority checked in service) |
| `POST`  | `/incidents/:id/verification`         | `VOLUNTEER`, `SUPERADMIN`          | Submit verification result                            |
| `PATCH` | `/incidents/:id/verification/confirm` | `VOLUNTEER`, `SUPERADMIN`          | Confirm verification result                           |
| `PATCH` | `/incidents/:id/verification/retry`   | `VOLUNTEER`, `SUPERADMIN`          | Retry verification assignment                         |
| `GET`   | `/incidents/:id/verifications`        | `SUPERADMIN`, `ADMIN`, `VOLUNTEER` | List incident verifications                           |
| `GET`   | `/incidents`                          | `SUPERADMIN`, `ADMIN`, `VOLUNTEER` | List incidents                                        |
| `PATCH` | `/incidents/:id/status`               | `VOLUNTEER`, `SUPERADMIN`          | Update incident status                                |
| `PATCH` | `/incidents/:id/resolve`              | Any authenticated user             | Resolve incident (authority checked in service)       |

### `POST /incidents`

| Field          | Type      | Required | Rules                                                                              |
| -------------- | --------- | -------- | ---------------------------------------------------------------------------------- |
| `title`        | `string`  | ✅       | Min 3 characters                                                                   |
| `categoryId`   | `string`  | ✅       | Valid UUID                                                                         |
| `latitude`     | `number`  | ✅       | -90 to 90                                                                          |
| `longitude`    | `number`  | ✅       | -180 to 180                                                                        |
| `forSelf`      | `boolean` | ✅       | `true` or `false`                                                                  |
| `description`  | `string`  | ❌       | Optional                                                                           |
| `addressText`  | `string`  | ❌       | Optional                                                                           |
| `landmark`     | `string`  | ❌       | Optional                                                                           |
| `accuracy`     | `string`  | ❌       | `GPS` · `MANUAL` · `VERIFIED`                                                      |
| `reporterNote` | `string`  | ⚠️       | Required when `forSelf = false`                                                    |
| `media`        | `array`   | ❌       | Max 5 items. Item shape: `{ url, mediaType }`, mediaType = `IMAGE`/`VIDEO`/`AUDIO` |

**Sample Response `201`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "incident": {
      "id": "uuid",
      "title": "Road accident",
      "status": "REPORTED"
    },
    "emergencyProfile": null
  }
}
```

### `GET /incidents/me`

| Param     | Type     | Required | Rules                   |
| --------- | -------- | -------- | ----------------------- |
| `status`  | `string` | ❌       | Incident status enum    |
| `page`    | `number` | ❌       | Default `1`             |
| `perPage` | `number` | ❌       | Default `10`, max `100` |

**Sample Response `200`**: paginated incident list.

### `GET /incidents/assigned`

| Param     | Type     | Required | Rules                   |
| --------- | -------- | -------- | ----------------------- |
| `status`  | `string` | ❌       | Incident status enum    |
| `page`    | `number` | ❌       | Default `1`             |
| `perPage` | `number` | ❌       | Default `20`, max `100` |

**Sample Response `200`**: paginated incident list assigned to current volunteer.

### `PATCH /incidents/:id/close`

| Field  | Type     | Required | Rules            |
| ------ | -------- | -------- | ---------------- |
| `note` | `string` | ✅       | Min 5 characters |

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": {
    "id": "uuid",
    "status": "CLOSED"
  }
}
```

### `PATCH /incidents/:id/assign-verifier`

| Field         | Type     | Required | Rules |
| ------------- | -------- | -------- | ----- |
| `volunteerId` | `string` | ✅       | UUID  |

**Sample Response `200`**: verification assignment data.

### `POST /incidents/:id/verification`

| Field      | Type     | Required | Rules                                                             |
| ---------- | -------- | -------- | ----------------------------------------------------------------- |
| `decision` | `string` | ✅       | `VERIFIED` · `UNREACHABLE` · `FALSE_REPORT`                       |
| `comment`  | `string` | ⚠️       | Required when decision is `UNREACHABLE` or `FALSE_REPORT` (min 5) |
| `media`    | `array`  | ✅       | Max 5 items (`url`, `mediaType`)                                  |

**Sample Response `200`**: submitted verification payload.

### `PATCH /incidents/:id/verification/confirm`

| Field         | Type      | Required | Rules                                     |
| ------------- | --------- | -------- | ----------------------------------------- |
| `confirmed`   | `boolean` | ✅       | Required                                  |
| `confirmNote` | `string`  | ⚠️       | Required when `confirmed = false` (min 5) |

**Sample Response `200`**: confirmed verification payload.

### `PATCH /incidents/:id/verification/retry`

| Field         | Type     | Required | Rules |
| ------------- | -------- | -------- | ----- |
| `volunteerId` | `string` | ✅       | UUID  |

**Sample Response `200`**: retry assignment payload.

### `GET /incidents`

| Param        | Type     | Required | Rules                                           |
| ------------ | -------- | -------- | ----------------------------------------------- |
| `status`     | `string` | ❌       | Incident status enum                            |
| `categoryId` | `string` | ❌       | UUID                                            |
| `lat`        | `number` | ❌       | -90 to 90 (must pair with `lng`)                |
| `lng`        | `number` | ❌       | -180 to 180 (must pair with `lat`)              |
| `radiusKm`   | `number` | ❌       | 0.1 to 500                                      |
| `sortBy`     | `string` | ❌       | `distance` or `createdAt` (default `createdAt`) |
| `page`       | `number` | ❌       | Default `1`                                     |
| `perPage`    | `number` | ❌       | Default `10`, max `100`                         |

**Sample Response `200`**: paginated incident list.

### `PATCH /incidents/:id/status`

| Field    | Type     | Required | Rules                |
| -------- | -------- | -------- | -------------------- |
| `status` | `string` | ✅       | Incident status enum |

**Sample Response `200`**: updated incident.

### `PATCH /incidents/:id/resolve`

| Field  | Type     | Required | Rules            |
| ------ | -------- | -------- | ---------------- |
| `note` | `string` | ✅       | Min 5 characters |

**Sample Response `200`**: resolved incident payload.

---

## Emergency Profiles (`/emergency-profiles`)

> All `/emergency-profiles` routes require authentication.

| Method  | Endpoint                  | Role                 | Description                  |
| ------- | ------------------------- | -------------------- | ---------------------------- |
| `POST`  | `/emergency-profiles/me`  | `CIVILIAN`           | Create own emergency profile |
| `PATCH` | `/emergency-profiles/me`  | `CIVILIAN`           | Update own emergency profile |
| `GET`   | `/emergency-profiles/me`  | `CIVILIAN`           | Get own emergency profile    |
| `GET`   | `/emergency-profiles/:id` | `ADMIN`, `VOLUNTEER` | Get emergency profile by ID  |
| `GET`   | `/emergency-profiles`     | `ADMIN`              | List emergency profiles      |

### `POST /emergency-profiles/me`

| Field               | Type     | Required | Rules                                                                          |
| ------------------- | -------- | -------- | ------------------------------------------------------------------------------ |
| `fullName`          | `string` | ✅       | Min 2                                                                          |
| `dateOfBirth`       | `string` | ❌       | Date                                                                           |
| `bloodType`         | `string` | ❌       | `A+`/`A-`/`B+`/`B-`/`AB+`/`AB-`/`O+`/`O-`                                      |
| `allergies`         | `string` | ❌       | Optional                                                                       |
| `medicalConditions` | `string` | ❌       | Optional                                                                       |
| `medications`       | `string` | ❌       | Optional                                                                       |
| `consentGivenAt`    | `string` | ✅       | Date timestamp                                                                 |
| `contacts`          | `array`  | ❌       | Max 5 contacts; contact fields: `name`, `phone`, `relationship?`, `isPrimary?` |

**Sample Response `201`**: created profile with nested contacts.

### `PATCH /emergency-profiles/me`

Same fields as create, all optional.

**Sample Response `200`**: updated profile.

### `GET /emergency-profiles`

| Param     | Type     | Required | Rules                   |
| --------- | -------- | -------- | ----------------------- |
| `page`    | `number` | ❌       | Default `1`             |
| `perPage` | `number` | ❌       | Default `10`, max `100` |

**Sample Response `200`**: paginated emergency profiles.

---

## Volunteer Applications (`/applications`)

> All `/applications` routes require authentication.

| Method  | Endpoint                         | Role                               | Description                                |
| ------- | -------------------------------- | ---------------------------------- | ------------------------------------------ |
| `POST`  | `/applications`                  | `CIVILIAN`                         | Submit volunteer application               |
| `GET`   | `/applications/me`               | `CIVILIAN`, `VOLUNTEER`            | List own applications                      |
| `GET`   | `/applications`                  | `SUPERADMIN`, `ADMIN`, `VOLUNTEER` | List all applications                      |
| `GET`   | `/applications/:id`              | Any authenticated user             | Get application detail (scoped in service) |
| `PATCH` | `/applications/:id/start-review` | `SUPERADMIN`, `VOLUNTEER`          | Claim application for review               |
| `PATCH` | `/applications/:id/review`       | `SUPERADMIN`, `VOLUNTEER`          | Approve or reject application              |
| `PATCH` | `/applications/:id/withdraw`     | `CIVILIAN`                         | Withdraw own application                   |
| `PATCH` | `/applications/:id`              | `CIVILIAN`                         | Update own application                     |

### `POST /applications`

| Field              | Type       | Required | Rules                                                            |
| ------------------ | ---------- | -------- | ---------------------------------------------------------------- |
| `agencyId`         | `string`   | ✅       | UUID                                                             |
| `skillIds`         | `string[]` | ✅       | At least 1 UUID                                                  |
| `dateOfBirth`      | `string`   | ✅       | ISO date, age must be 18+                                        |
| `nationalIdNumber` | `string`   | ✅       | Min 8                                                            |
| `nationalIdUrl`    | `string`   | ✅       | URL                                                              |
| `address`          | `string`   | ✅       | Min 5                                                            |
| `hasTransport`     | `boolean`  | ✅       | Required                                                         |
| `experience`       | `string`   | ❌       | Max 500                                                          |
| `consentGiven`     | `boolean`  | ✅       | Must be `true`                                                   |
| `certificates`     | `array`    | ❌       | Max 10; item fields: `name`, `fileUrl`, `issuedBy?`, `issuedAt?` |

**Sample Response `201`**: created application with certificates.

### `PATCH /applications/:id`

Same fields as submit, all optional. `consentGiven` cannot be `false` if sent.

**Sample Response `200`**: updated application.

### `PATCH /applications/:id/review`

| Field        | Type     | Required | Rules                                       |
| ------------ | -------- | -------- | ------------------------------------------- |
| `decision`   | `string` | ✅       | `APPROVED` or `REJECTED`                    |
| `reviewNote` | `string` | ⚠️       | Required when `decision = REJECTED` (min 5) |

**Sample Response `200`**: reviewed application.

### `GET /applications`

| Param      | Type     | Required | Rules                                                              |
| ---------- | -------- | -------- | ------------------------------------------------------------------ |
| `agencyId` | `string` | ❌       | UUID                                                               |
| `status`   | `string` | ❌       | `PENDING` · `UNDER_REVIEW` · `APPROVED` · `REJECTED` · `WITHDRAWN` |
| `page`     | `number` | ❌       | Default `1`                                                        |
| `perPage`  | `number` | ❌       | Default `20`, max `100`                                            |

**Sample Response `200`**: paginated application list.

### `PATCH /applications/:id/start-review`

No request body.

**Sample Response `200`**: application moved to `UNDER_REVIEW`.

### `PATCH /applications/:id/withdraw`

No request body.

**Sample Response `200`**

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
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

## Reference Data (`/skills`, `/categories`, `/agencies`)

All routes in this section require authentication.

### Skills (`/skills`)

| Method   | Endpoint      | Role                      | Description                                                 |
| -------- | ------------- | ------------------------- | ----------------------------------------------------------- |
| `GET`    | `/skills`     | Any authenticated user    | List skills (inactive hidden for non-admin)                 |
| `GET`    | `/skills/:id` | Any authenticated user    | Get skill detail                                            |
| `POST`   | `/skills`     | `SUPERADMIN`, `VOLUNTEER` | Create skill (`VOLUNTEER` must be `COORDINATOR`/`DIRECTOR`) |
| `PATCH`  | `/skills/:id` | `SUPERADMIN`, `VOLUNTEER` | Update skill (`VOLUNTEER` cannot change `isActive`)         |
| `DELETE` | `/skills/:id` | `SUPERADMIN`              | Delete skill (blocked when linked to volunteers)            |

Notes:

- For `VOLUNTEER` role, service-layer authority is enforced via `AgencyMember` and only `COORDINATOR` / `DIRECTOR` are allowed for write operations.
- Name uniqueness is case-insensitive.

### Categories (`/categories`)

| Method   | Endpoint          | Role                      | Description                                                    |
| -------- | ----------------- | ------------------------- | -------------------------------------------------------------- |
| `GET`    | `/categories`     | Any authenticated user    | List incident categories (inactive hidden for non-admin)       |
| `GET`    | `/categories/:id` | Any authenticated user    | Get category detail                                            |
| `POST`   | `/categories`     | `SUPERADMIN`, `VOLUNTEER` | Create category (`VOLUNTEER` must be `COORDINATOR`/`DIRECTOR`) |
| `PATCH`  | `/categories/:id` | `SUPERADMIN`, `VOLUNTEER` | Update category (`VOLUNTEER` cannot change `isActive`)         |
| `DELETE` | `/categories/:id` | `SUPERADMIN`              | Delete category (blocked when linked to incidents)             |

Notes:

- For `VOLUNTEER` role, service-layer authority is enforced via `AgencyMember` and only `COORDINATOR` / `DIRECTOR` are allowed for write operations.
- Name uniqueness is case-insensitive.

### Agencies (`/agencies`)

| Method   | Endpoint                   | Role                               | Description                                                        |
| -------- | -------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `GET`    | `/agencies`                | Any authenticated user             | List agencies (inactive hidden for non-admin)                      |
| `GET`    | `/agencies/:id`            | Any authenticated user             | Get agency detail                                                  |
| `POST`   | `/agencies`                | `SUPERADMIN`                       | Create agency                                                      |
| `PATCH`  | `/agencies/:id`            | `SUPERADMIN`, `VOLUNTEER`          | Update agency (`VOLUNTEER`: own agency only, no `isActive` update) |
| `DELETE` | `/agencies/:id`            | `SUPERADMIN`                       | Delete agency (blocked when linked to missions/applications)       |
| `GET`    | `/agencies/:id/volunteers` | `SUPERADMIN`, `ADMIN`, `VOLUNTEER` | List available volunteers for mission assignment                   |

`GET /agencies/:id/volunteers` query params:

| Param     | Type     | Required | Rules                    |
| --------- | -------- | -------- | ------------------------ |
| `search`  | `string` | ❌       | Filter by volunteer name |
| `skillId` | `string` | ❌       | UUID skill filter        |
| `page`    | `number` | ❌       | Default `1`              |
| `perPage` | `number` | ❌       | Default `20`, max `100`  |

Scope rules for `GET /agencies/:id/volunteers`:

- `SUPERADMIN` / `ADMIN`: can query any `agencyId`.
- `VOLUNTEER` must be `COORDINATOR` or `DIRECTOR` of an agency.
- For `COORDINATOR` / `DIRECTOR`, provided `agencyId` must match their own agency; otherwise request is rejected with `FORBIDDEN`.

---

## Volunteer Profiles (`/volunteer-profiles`)

> All `/volunteer-profiles` routes require `VOLUNTEER`.

| Method  | Endpoint                              | Role        | Description                  |
| ------- | ------------------------------------- | ----------- | ---------------------------- |
| `GET`   | `/volunteer-profiles/me`              | `VOLUNTEER` | Get own volunteer profile    |
| `PATCH` | `/volunteer-profiles/me/availability` | `VOLUNTEER` | Update own availability      |
| `PATCH` | `/volunteer-profiles/me`              | `VOLUNTEER` | Update own volunteer profile |

### `PATCH /volunteer-profiles/me`

| Field                  | Type       | Required | Rules                                           |
| ---------------------- | ---------- | -------- | ----------------------------------------------- |
| `availabilityRadiusKm` | `number`   | ❌       | 1 to 500                                        |
| `lastKnownLatitude`    | `number`   | ❌       | -90 to 90, must pair with `lastKnownLongitude`  |
| `lastKnownLongitude`   | `number`   | ❌       | -180 to 180, must pair with `lastKnownLatitude` |
| `skillIds`             | `string[]` | ❌       | UUID array                                      |

**Sample Response `200`**: updated volunteer profile.

### `PATCH /volunteer-profiles/me/availability`

| Field         | Type      | Required | Rules                                  |
| ------------- | --------- | -------- | -------------------------------------- |
| `isAvailable` | `boolean` | ✅       | Required                               |
| `latitude`    | `number`  | ❌       | -90 to 90, must pair with `longitude`  |
| `longitude`   | `number`  | ❌       | -180 to 180, must pair with `latitude` |

**Sample Response `200`**: updated volunteer availability.

---

## Missions (`/missions`)

> All `/missions` routes require authentication.

| Method  | Endpoint                           | Role                               | Description                                                    |
| ------- | ---------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `POST`  | `/missions`                        | Any authenticated user             | Create mission (agency authority checked in service)           |
| `GET`   | `/missions`                        | `ADMIN`, `SUPERADMIN`, `VOLUNTEER` | List missions                                                  |
| `GET`   | `/missions/assigned`               | `VOLUNTEER`                        | List missions assigned to current volunteer                    |
| `GET`   | `/missions/:id`                    | Any authenticated user             | Get mission detail (scoped in service)                         |
| `PATCH` | `/missions/:id/accept`             | `VOLUNTEER`                        | Accept mission                                                 |
| `PATCH` | `/missions/:id/reject`             | `VOLUNTEER`                        | Reject mission                                                 |
| `PATCH` | `/missions/:id/start-travel`       | `VOLUNTEER`                        | Start travel to mission                                        |
| `PATCH` | `/missions/:id/arrive`             | `VOLUNTEER`                        | Mark arrival on site                                           |
| `PATCH` | `/missions/:id/start-work`         | `VOLUNTEER`                        | Start mission work                                             |
| `POST`  | `/missions/:id/completion-report`  | `VOLUNTEER`                        | Submit mission completion report                               |
| `PATCH` | `/missions/:id/report-failure`     | Any authenticated user             | Report mission failure (authority checked in service)          |
| `PATCH` | `/missions/:id/agency-decision`    | Any authenticated user             | Agency decision after rejection (authority checked in service) |
| `PATCH` | `/missions/:id/confirm-completion` | Any authenticated user             | Confirm mission completion (authority checked in service)      |
| `PATCH` | `/missions/:id/cancel`             | Any authenticated user             | Cancel mission (authority checked in service)                  |
| `POST`  | `/missions/:id/tracking`           | `VOLUNTEER`                        | Push GPS point while mission is active                         |
| `GET`   | `/missions/:id/tracking`           | `VOLUNTEER`, `ADMIN`, `SUPERADMIN` | Get mission tracking history                                   |
| `GET`   | `/missions/:id/tracking/latest`    | `VOLUNTEER`, `ADMIN`, `SUPERADMIN` | Get latest point per assigned volunteer                        |

### `POST /missions`

| Field               | Type       | Required | Rules                                                        |
| ------------------- | ---------- | -------- | ------------------------------------------------------------ | ----------------------------- |
| `primaryIncidentId` | `string`   | ✅       | UUID                                                         |
| `linkedIncidentIds` | `string[]` | ❌       | Max 20 UUIDs, no duplicates, cannot include primary incident |
| `missionType`       | `string`   | ✅       | 2 to 100 chars                                               |
| `priority`          | `string`   | ✅       | `LOW` · `MEDIUM` · `HIGH` · `CRITICAL`                       |
| `volunteers`        | `array`    | ✅       | At least 1. Item: `{ volunteerId: UUID, role: LEADER         | MEMBER }`; exactly one LEADER |

**Sample Response `201`**: created mission with assignments.

### `GET /missions`

| Param        | Type     | Required | Rules                            |
| ------------ | -------- | -------- | -------------------------------- |
| `status`     | `string` | ❌       | Mission status enum              |
| `priority`   | `string` | ❌       | `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` |
| `agencyId`   | `string` | ❌       | UUID                             |
| `incidentId` | `string` | ❌       | UUID                             |
| `page`       | `number` | ❌       | Default `1`                      |
| `perPage`    | `number` | ❌       | Default `20`, max `100`          |

**Sample Response `200`**: paginated mission list.

### `PATCH /missions/:id/reject`

| Field  | Type     | Required | Rules            |
| ------ | -------- | -------- | ---------------- |
| `note` | `string` | ✅       | Min 5 characters |

**Sample Response `200`**: mission transitioned to rejection state.

### `PATCH /missions/:id/start-travel`

| Field       | Type     | Required | Rules       |
| ----------- | -------- | -------- | ----------- |
| `latitude`  | `number` | ✅       | -90 to 90   |
| `longitude` | `number` | ✅       | -180 to 180 |

**Sample Response `200`**: mission transitioned to `EN_ROUTE`.

### `PATCH /missions/:id/arrive`

| Field       | Type     | Required | Rules       |
| ----------- | -------- | -------- | ----------- |
| `latitude`  | `number` | ✅       | -90 to 90   |
| `longitude` | `number` | ✅       | -180 to 180 |

**Sample Response `200`**: mission transitioned to `ON_SITE`.

### `PATCH /missions/:id/start-work`

| Field       | Type     | Required | Rules       |
| ----------- | -------- | -------- | ----------- |
| `latitude`  | `number` | ✅       | -90 to 90   |
| `longitude` | `number` | ✅       | -180 to 180 |

**Sample Response `200`**: mission transitioned to `IN_PROGRESS`.

### `POST /missions/:id/completion-report`

| Field            | Type     | Required | Rules             |
| ---------------- | -------- | -------- | ----------------- |
| `latitude`       | `number` | ✅       | -90 to 90         |
| `longitude`      | `number` | ✅       | -180 to 180       |
| `summary`        | `string` | ✅       | Min 10 characters |
| `actionsTaken`   | `string` | ❌       | Optional          |
| `resourcesUsed`  | `string` | ❌       | Optional          |
| `casualties`     | `number` | ❌       | Integer >= 0      |
| `propertyDamage` | `string` | ❌       | Optional          |

**Sample Response `200`**: mission report submitted.

### `PATCH /missions/:id/report-failure`

| Field       | Type     | Required | Rules            |
| ----------- | -------- | -------- | ---------------- |
| `reason`    | `string` | ✅       | Min 5 characters |
| `latitude`  | `number` | ❌       | -90 to 90        |
| `longitude` | `number` | ❌       | -180 to 180      |

**Sample Response `200`**: mission marked failed.

### `PATCH /missions/:id/agency-decision`

| Field         | Type     | Required | Rules                                |
| ------------- | -------- | -------- | ------------------------------------ |
| `decision`    | `string` | ✅       | `CONTINUE` or `FAIL`                 |
| `volunteerId` | `string` | ⚠️       | Required when decision is `CONTINUE` |
| `note`        | `string` | ❌       | Min 5 when provided                  |

**Sample Response `200`**: decision applied.

### `PATCH /missions/:id/confirm-completion`

| Field       | Type      | Required | Rules                                     |
| ----------- | --------- | -------- | ----------------------------------------- |
| `confirmed` | `boolean` | ✅       | Required                                  |
| `note`      | `string`  | ⚠️       | Required when `confirmed = false` (min 5) |

**Sample Response `200`**: completion confirmed/rejected.

### `PATCH /missions/:id/cancel`

| Field  | Type     | Required | Rules            |
| ------ | -------- | -------- | ---------------- |
| `note` | `string` | ✅       | Min 5 characters |

**Sample Response `200`**: mission cancelled.

### `PATCH /missions/:id/accept`

No request body.

**Sample Response `200`**: mission accepted.

### `POST /missions/:id/tracking`

> Requires mission assignment and trackable mission status (`EN_ROUTE`, `ON_SITE`, `IN_PROGRESS`).
> Service-level guard enforces one point per volunteer+mission every 15 seconds.

| Field        | Type     | Required | Rules                                                     |
| ------------ | -------- | -------- | --------------------------------------------------------- |
| `latitude`   | `number` | ✅       | -90 to 90                                                 |
| `longitude`  | `number` | ✅       | -180 to 180                                               |
| `recordedAt` | `string` | ❌       | ISO datetime, within last 5 minutes and not in the future |

**Sample Response `201`**: created tracking point.

### `GET /missions/:id/tracking`

| Param         | Type     | Required | Rules                             |
| ------------- | -------- | -------- | --------------------------------- |
| `volunteerId` | `string` | ❌       | UUID                              |
| `since`       | `string` | ❌       | ISO datetime                      |
| `limit`       | `number` | ❌       | Default `100`, min `1`, max `500` |

**Sample Response `200`**: ordered tracking history.

### `GET /missions/:id/tracking/latest`

No request body.

**Sample Response `200`**: latest GPS point per volunteer assigned to the mission.

---

## Notifications (`/notifications`)

> All `/notifications` routes require authentication and are scoped to the authenticated user.

| Method   | Endpoint                      | Role                   | Description                                           |
| -------- | ----------------------------- | ---------------------- | ----------------------------------------------------- |
| `GET`    | `/notifications`              | Any authenticated user | List own notifications with filters + pagination      |
| `GET`    | `/notifications/unread-count` | Any authenticated user | Get unread badge count                                |
| `PATCH`  | `/notifications/:id/read`     | Any authenticated user | Mark one notification as read                         |
| `PATCH`  | `/notifications/read-all`     | Any authenticated user | Mark all unread notifications as read                 |
| `DELETE` | `/notifications/:id`          | Any authenticated user | Delete one notification                               |
| `DELETE` | `/notifications`              | Any authenticated user | Bulk delete (safe default keeps unread notifications) |

### `GET /notifications`

| Param        | Type     | Required | Rules                            |
| ------------ | -------- | -------- | -------------------------------- |
| `type`       | `string` | ❌       | Notification type enum           |
| `unreadOnly` | `string` | ❌       | `"true"` or `"false"`            |
| `page`       | `number` | ❌       | Default `1`                      |
| `perPage`    | `number` | ❌       | Default `20`, min `1`, max `100` |

Response includes paginated links (`self`, `next`, `prev`) and `unreadCount` in metadata.

### `DELETE /notifications`

| Param        | Type     | Required | Rules                                             |
| ------------ | -------- | -------- | ------------------------------------------------- |
| `keepUnread` | `string` | ❌       | `"true"` or `"false"`; default behavior is `true` |

When `keepUnread` is omitted (or `true`), only read notifications are deleted.
Pass `keepUnread=false` to delete both read and unread notifications.

### Notification cleanup job

Read notifications older than 90 days are removed automatically by a daily background cleanup job.

---

## Dashboard (`/dashboard`)

All dashboard endpoints require authentication and are rate-limited (`30 req / 15 min / userId`).

### Query parameters

| Param      | Type            | Required | Allowed values                              | Default |
| ---------- | --------------- | -------- | ------------------------------------------- | ------- |
| `period`   | `string`        | ❌       | `7d`, `30d`, `90d`, `1y`, `all`             | `30d`   |
| `agencyId` | `string` (UUID) | ❌       | Required for SUPERADMIN on agency endpoints | -       |

Granularity mapping used by time-series responses:

- `7d` / `30d` -> `day`
- `90d` -> `week`
- `1y` / `all` -> `month`

### Endpoints

#### Volunteer (role: `VOLUNTEER`)

| Method | Endpoint                             | Description                                                                   |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------- |
| `GET`  | `/dashboard/volunteer/summary`       | Personal KPI summary (missions, success rate, hours served, average duration) |
| `GET`  | `/dashboard/volunteer/missions`      | Mission breakdown by type/priority with recent missions                       |
| `GET`  | `/dashboard/volunteer/verifications` | Verification performance and recent verification activity                     |

Notes:

- Scope is always the authenticated volunteer (`req.user.sub`).
- No `userId` query/body param is accepted.

#### Agency (roles: `VOLUNTEER`, `SUPERADMIN`)

| Method | Endpoint                         | Description                                                 |
| ------ | -------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/dashboard/agency/live`         | Real-time operational snapshot (no `period`)                |
| `GET`  | `/dashboard/agency/incidents`    | Incident funnel, average incident timings, and trend series |
| `GET`  | `/dashboard/agency/missions`     | Mission funnel, response/duration metrics, and trend series |
| `GET`  | `/dashboard/agency/volunteers`   | Workforce totals, top performers, dormant volunteers        |
| `GET`  | `/dashboard/agency/categories`   | Incident category breakdown with outcome rates              |
| `GET`  | `/dashboard/agency/applications` | Volunteer application pipeline metrics                      |

Scope rules:

- `VOLUNTEER` role is further validated via `AgencyMember` (`COORDINATOR`/`DIRECTOR`) in service layer.
- `SUPERADMIN` must pass `agencyId` for agency dashboard endpoints.
- `/dashboard/agency/applications` is restricted to `DIRECTOR` (within `VOLUNTEER`) or `SUPERADMIN`.

#### Admin (roles: `ADMIN`, `SUPERADMIN`)

| Method | Endpoint                        | Description                                       |
| ------ | ------------------------------- | ------------------------------------------------- |
| `GET`  | `/dashboard/admin/overview`     | Platform top-line KPIs with period deltas         |
| `GET`  | `/dashboard/admin/retention`    | User retention/engagement metrics                 |
| `GET`  | `/dashboard/admin/health`       | Platform health indicators and registration trend |
| `GET`  | `/dashboard/admin/agencies`     | Cross-agency mission comparison                   |
| `GET`  | `/dashboard/admin/applications` | Platform-wide application backlog                 |

### Response shape

Dashboard endpoints use the standard success envelope:

```json
{
  "meta": {
    "success": true,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": {
      "limit": 30,
      "remaining": 29,
      "reset": 840
    }
  },
  "data": {
    "period": "30d"
  }
}
```

---

## Error Response Shape

```json
{
  "meta": {
    "success": false,
    "timestamp": "...",
    "requestId": "...",
    "rateLimit": null
  },
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message.",
    "details": []
  }
}
```
