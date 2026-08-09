# CoBuy System Architecture

CoBuy is built using Next.js App Router, TypeScript (strict), and Supabase. The project adheres to a **Clean Architecture** pattern to isolate core business rules from database frameworks, networking, and UI presentation details.

## Core Architectural Layers

The source code under `src/` is structured as follows:

```
src/
├── app/                      # Presentation Layer (Next.js App Router)
│   ├── actions/              # Next.js Server Actions (CQRS boundaries)
│   ├── api/                  # API Route Handlers (Auth callbacks, PWA endpoints)
│   ├── app/                  # Application Dashboard and pages
│   └── (auth)/               # Auth pages (Login, Register, Password resets)
├── core/                     # Domain Layer (Strictly Framework-independent)
│   ├── entities/             # TypeScript domain models and enums
│   └── repositories/         # Repository contracts (Interfaces)
├── infrastructure/           # Data & Framework Layer
│   ├── repositories/         # Supabase database query mapper classes
│   ├── services/             # Core Business Engines (Allocation & Settlement)
│   └── supabase/             # Server/Client supabase initializers
├── components/               # Presentation UI Elements (Vanilla CSS + Tailwind)
│   ├── common/               # Shared components (MoneyInput, PWA register)
│   └── ui/                   # Primitive layout UI components (Shadcn)
└── hooks/                    # Reusable React state & sync hooks
```

---

### 1. Domain Layer (`src/core/`)
- Contains strictly framework-free logic.
- **Entities (`src/core/entities/`)**: Model schemas (`Group`, `GroupMember`, `ShoppingLog`, `Attendance`, `SettlementPeriod`, `Payment`) reflecting the database structures in camelCase format.
- **Repository Interfaces (`src/core/repositories/interfaces.ts`)**: Defines abstract CRUD methods. The service layer depends on these interfaces, not direct DB connectors, enabling mock injection during testing.

### 2. Infrastructure Layer (`src/infrastructure/`)
- Handles databases, external networks, and math engines.
- **Supabase Repositories (`src/infrastructure/repositories/supabase.repositories.ts`)**: Maps abstract repository queries to Supabase SQL calls, handling concurrency version checking (`version`).
- **Services (`src/infrastructure/services/`)**:
  - `AllocationService`: The math engine responsible for calculating daily splits based on active membership intervals and meal logs.
  - `SettlementService`: Calculates personal net balances and runs the Greedy Settlement algorithm to minimize debts.

### 3. Server Actions Layer (`src/app/actions/`)
- Serves as the CQRS (Command Query Responsibility Segregation) boundary between Client Components and Server logic.
- Actions instantiate their required repositories and services, perform validation, execute operations, and return serializable objects.

### 4. Presentation Layer (`src/app/` & `src/components/`)
- Utilizes React Server Components (RSC) to fetch and validate data at the routing level.
- Passes clean data to Client Components (e.g., `ExpensesClient`, `SettlementClient`, `AttendanceClient`) which control UI interactive states, modals, forms, and client-side validation using React Hook Form + Zod.
