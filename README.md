# unity-care

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

Project structure:

```bash
unity-care/
│
├── apps/
│   ├── backend/                     # Express API (MVC)
│   │   ├── src/
│   │   │   ├── controllers/          # HTTP controllers (req/res)
│   │   │   │   ├── incident.controller.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   └── user.controller.ts
│   │   │   │
│   │   │   ├── services/             # Business logic
│   │   │   │   ├── incident.service.ts
│   │   │   │   ├── verification.service.ts
│   │   │   │   └── auth.service.ts
│   │   │   │
│   │   │   ├── models/               # Domain models (NO DB)
│   │   │   │   ├── incident.model.ts
│   │   │   │   ├── user.model.ts
│   │   │   │   └── role.enum.ts
│   │   │   │
│   │   │   ├── routes/               # Route bindings
│   │   │   │   ├── incident.routes.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── validators/           # Request validation
│   │   │   │   ├── incident.validator.ts
│   │   │   │   └── auth.validator.ts
│   │   │   │
│   │   │   ├── middlewares/           # Cross-cutting concerns
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── requireRole.ts
│   │   │   │   └── rateLimit.ts
│   │   │   │
│   │   │   ├── utils/                # Helpers & constants
│   │   │   │   ├── errors.ts
│   │   │   │   └── logger.ts
│   │   │   │
│   │   │   ├── app.ts                # Express app config
│   │   │   └── server.ts             # App bootstrap
│   │   │
│   │   ├── prisma/                   # (added later)
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/                    # React + Tailwind
│   │   ├── src/
│   │   │   ├── api/                  # API clients (NO logic)
│   │   │   │   ├── incident.api.ts
│   │   │   │   └── auth.api.ts
│   │   │   │
│   │   │   ├── pages/                # Route-level pages
│   │   │   │   ├── incidents/
│   │   │   │   │   ├── IncidentList.tsx
│   │   │   │   │   └── IncidentDetail.tsx
│   │   │   │   ├── auth/
│   │   │   │   └── dashboard/
│   │   │   │
│   │   │   ├── components/           # Reusable UI components
│   │   │   │   ├── MapView.tsx
│   │   │   │   ├── IncidentCard.tsx
│   │   │   │   └── StatusBadge.tsx
│   │   │   │
│   │   │   ├── hooks/                # Custom hooks
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useIncidents.ts
│   │   │   │
│   │   │   ├── store/                # Global state (if needed)
│   │   │   │   └── auth.store.ts
│   │   │   │
│   │   │   ├── types/                # Frontend-specific types
│   │   │   ├── utils/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   │
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│
├── packages/
│   ├── types/                       # Shared API contracts
│   │   ├── incident.ts
│   │   ├── user.ts
│   │   └── auth.ts
│   │
│   ├── config/                      # Shared configs
│   │   ├── tsconfig.base.json
│   │   └── eslint.config.js
│
├── bun.lockb
├── package.json
└── README.md

```
