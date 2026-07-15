# Voxel implementation log

## Milestone 0 — Specification analysis and implementation plan

**Status:** Complete

**Completed work**

- Read every Markdown source in `/prompt` without modifying that directory.
- Recorded the dependency graph, milestone order, and naming/runtime conflict decisions in `IMPLEMENTATION_PLAN.md`.
- Established Voxel naming and Node terminology as the current rebuild rules.

**Modified files**

- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`

**Architectural decisions**

- Use a clean npm workspaces monorepo under `voxel/` rather than reusing the previous prototype.
- Build foundations in dependency order: contracts and configuration before applications and infrastructure.

**Blockers**

- None.

**Next milestone**

- Milestone 1: repository foundation, strict tooling, shared contracts, and design tokens.

## Milestone 1 — Repository foundation

**Status:** Complete

**Completed work**

- Created the Voxel npm workspaces monorepo and strict TypeScript project references.
- Added shared API response contracts, opaque request IDs, and an accompanying unit test.
- Added ESLint, Prettier, EditorConfig, Node versioning, environment templates, and repository ignore rules.
- Installed and audited the foundation dependencies with no reported vulnerabilities.
- Verified type checking, workspace build, linting, tests, and formatting.

**Modified files**

- `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.base.json`
- `eslint.config.js`, `prettier.config.mjs`, `.editorconfig`, `.gitignore`, `.nvmrc`, `.env.example`
- `packages/contracts/**`

**Architectural decisions**

- Shared HTTP contracts are isolated in `@voxel/contracts` so API and client code share one stable boundary.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled to make persistence and API contracts explicit.

**Blockers**

- None.

**Next milestone**

- Milestone 2: local infrastructure, API service skeleton, and persistence foundations.

## Milestone 2 — Local platform and API boundary

**Status:** Complete

**Completed work**

- Added the `@voxel/api` Fastify service with strict environment validation and secure defaults.
- Added versioned health, liveness, and readiness routes using the shared response contract.
- Added request IDs, structured failure responses, CORS allowlisting, cookie support, Helmet, rate limiting, and sensitive-log redaction.
- Defined the initial Prisma tenant model for users, sessions, refresh tokens, workspaces, memberships, dashboards, immutable dashboard versions, and audit events.
- Added Docker Compose development services for PostgreSQL, Redis, and MinIO with health checks and durable named volumes.
- Generated the Prisma client, verified the Compose configuration, and remediated the Prisma 7 development dependency advisories by pinning Prisma 6.19.3.

**Modified files**

- `apps/api/**`
- `docker-compose.yml`
- `package.json`, `package-lock.json`, `tsconfig.json`

**Architectural decisions**

- API requests use a shared versioned response envelope and never expose unexpected error details.
- The initial schema retains normalized tenant relationships and audit history before feature repositories are introduced.
- Infrastructure state stays in PostgreSQL, Redis, and object storage; no production data is persisted in the client.

- Google OAuth client credentials are intentionally external environment configuration and are not required to validate this platform milestone.

**Next milestone**

- Milestone 3: authentication, session rotation, authorization, and protected resource APIs.

## Milestone 3 — Identity and access & Dashboard Editor

**Status:** Complete

**Completed work**

- Added development environment authentication bypass (`POST /api/v1/auth/dev-login`) for quick onboarding and local testing.
- Created root `.env` configuration file and synced Prisma schemas with local PostgreSQL instance.
- Enhanced the dashboard editor canvas to support node selection, background dismiss, side property Inspector panel (editing title, content, size), and node deletion.
- Integrated dev scripts in package.json to easily launch components workspace-wide.
- Verified workspace building, lint checking, type safety, and test suites are passing.

**Modified files**

- `.env`, `package.json`
- `apps/api/src/features/auth/auth-routes.ts`
- `apps/web/src/features/auth/auth-service.ts`, `LoginPage.tsx`
- `apps/web/src/features/editor/EditorPage.tsx`
- `IMPLEMENTATION_LOG.md`

**Architectural decisions**

- Developer authentication bypass is locked strictly to `NODE_ENV=development` to prevent unauthorized execution in production.
- Selected node properties are synchronized with the central workspace layout `draft` state to preserve single source of truth prior to persistence.

**Blockers**

- None.

**Next milestone**

- Milestone 4: Backend platform - caching, queues, test databases, and OpenAPI schemas.
