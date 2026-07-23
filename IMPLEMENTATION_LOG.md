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

- Milestone 4: Codebase Audit & Compliance Verification with Prompt Specs.

## Milestone 4 — Audit Logging & Quality Gates Verification

**Status:** Complete

**Completed work**

- Fixed ESLint configuration (`eslint.config.js`) to support Node and Browser environments for JS/JSX monorepo files, resolving all 34 lint errors.
- Added automated `AuditEvent` security logging in `workspace-routes.js` for workspace and dashboard mutations (create, update, delete).
- Added `GET /api/v1/workspaces/:workspaceId/audit-events` API endpoint for workspace admin audit log review.
- Verified clean passage of `npm run lint` (0 errors, 0 warnings), `npm test`, and production build `npm run build`.

**Modified files**

- `eslint.config.js`
- `apps/api/src/features/workspaces/workspace-routes.js`
- `apps/web/src/components/command/CommandPalette.jsx`
- `apps/web/src/components/feedback/CustomConfirmModal.jsx`
- `apps/web/src/components/layout/AppShell.jsx`
- `apps/web/src/features/editor/EditorPage.jsx`
- `apps/web/src/features/editor/VersionHistory.jsx`
- `apps/web/src/features/editor/use-yjs.js`
- `apps/web/src/features/landing/LandingPage.jsx`
- `apps/web/src/lib/keyboard.js`
- `apps/web/src/store/notification-store.js`
- `IMPLEMENTATION_LOG.md`

**Architectural decisions**

- Audit events log non-blocking security mutations without disrupting active requests.
- ESLint ignores unused variables prefixed with an underscore to align with TypeScript conventions across shared packages and apps.

**Next milestone**

- Milestone 5: Full Email & Password Sign In & Sign Up Authentication.

## Milestone 5 — Full Sign In & Sign Up Authentication

**Status:** Complete

**Completed work**

- Added `passwordHash` field to Prisma `User` schema (`apps/api/prisma/schema.prisma`) and synchronized local database using `prisma db push`.
- Built secure Node.js `scryptSync` password hashing and constant-time verification in `apps/api/src/features/auth/auth-service.js`.
- Added email/password registration (`POST /api/v1/auth/signup`) and email/password authentication (`POST /api/v1/auth/login`) API endpoints in `auth-routes.js`.
- Implemented automatic initial workspace creation (`ensureDefaultWorkspace`) for newly signed-up users so they land in a ready workspace.
- Redesigned `LoginPage.jsx` with an interactive tabbed **Sign In** and **Sign Up** UI, inline validation, password show/hide toggle, loading feedback, and smooth mode switching.
- Updated `LandingPage.jsx` header links to route directly to `?mode=signin` and `?mode=signup`.
- Added unit tests for password hashing in `auth-service.test.js`.

**Modified files**

- `apps/api/prisma/schema.prisma`
- `apps/api/src/features/auth/auth-service.js`
- `apps/api/src/features/auth/auth-routes.js`
- `apps/api/src/features/auth/auth-service.test.js`
- `apps/web/src/features/auth/auth-service.js`
- `apps/web/src/features/auth/LoginPage.jsx`
- `apps/web/src/features/landing/LandingPage.jsx`
- `apps/web/src/components/layout/AppShell.jsx`
- `IMPLEMENTATION_LOG.md`

**Architectural decisions**

- Password hashing relies on Node.js built-in `crypto.scryptSync` with random salt per user to avoid external dependency vulnerabilities.
- New accounts automatically seed a initial default workspace so first-time users can immediately start building canvas dashboards.

**Blockers**

- None.

**Next milestone**

- Milestone 6: Enterprise Platform Settings Suite Remake.

## Milestone 6 — Enterprise Platform Settings Suite Remake

**Status:** Complete

**Completed work**

- Redesigned [SettingsPage.jsx](file:///Users/akshchauhan/Igris/NOTES/PROJECTS/voxel/apps/web/src/features/settings/SettingsPage.jsx) into an enterprise-grade multi-tab settings suite.
- Implemented **7 dedicated settings modules**:
  1. **Account & Profile**: Avatar badge color customizer, display name, email, job title, primary language, timezone selector, and bio notes.
  2. **Appearance & Canvas**: Dark/Light theme toggle, Canvas accent color palette, Default grid style selection (Dot Matrix, Grid Lines, Radial Mesh, Clean Canvas), Autosave sync frequency, snap-to-grid toggle, and reduced motion settings.
  3. **Workspace & Team**: Member search, role-based access control badges (OWNER, ADMIN, EDITOR, VIEWER), invite link generator, member removal, and invitation modal.
  4. **Security & Sessions**: Password update form with strength checks, Active browser & device session revocation list, and immutable audit event log viewer.
  5. **Notifications**: Email digests, collaboration mention alerts, real-time desktop notifications, and feature update toggles.
  6. **API & Developer SDK**: Production API secret key viewer with copy-to-clipboard and key regeneration, plus webhook URL endpoint settings.
  7. **Danger Zone**: Account soft-deletion confirmation workflow with mandatory text verification.
- Verified clean build (`npm run build`), linting (`npm run lint`), and tests (`npm test`).

**Modified files**

- `apps/web/src/features/settings/SettingsPage.jsx`
- `IMPLEMENTATION_LOG.md`

**Architectural decisions**

- Modular tabbed layout maintains clean focus per administrative task without cluttering the screen.
- State feedback is piped to the central notification store for instant feedback on actions.

**Blockers**

- None.

**Next milestone**

- Milestone 7: Dynamic Autosave Settings & Git-Style Version Reverting.

## Milestone 7 — Dynamic Autosave Settings & Git-Style Version Reverting

**Status:** Complete

**Completed work**

- Created persistent Zustand settings store ([settings-store.js](file:///Users/akshchauhan/Igris/NOTES/PROJECTS/voxel/apps/web/src/store/settings-store.js)) for Autosave configurations (`autosaveEnabled`, `autosaveInterval`).
- Integrated **Master Autosave Engine Switch** into [SettingsPage.jsx](file:///Users/akshchauhan/Igris/NOTES/PROJECTS/voxel/apps/web/src/features/settings/SettingsPage.jsx) (Supports Realtime, Every 5s, Every 30s, or Manual Save Only).
- Updated [EditorPage.jsx](file:///Users/akshchauhan/Igris/NOTES/PROJECTS/voxel/apps/web/src/features/editor/EditorPage.jsx) header toolbar:
  - When **Autosave is ON**, the manual Save button is hidden and debounced background autosave automatically persists changes to the backend.
  - When **Autosave is OFF**, the manual Save button is shown and autosave is disabled.
- Redesigned [VersionHistory.jsx](file:///Users/akshchauhan/Igris/NOTES/PROJECTS/voxel/apps/web/src/features/editor/VersionHistory.jsx) to display version checkpoints:
  - Clicking any version card expands a Git-style checkpoint inspector with node/link metadata.
  - Provides a one-click **"Revert to Version #X"** action button that restores the target canvas layout state and commits a new version checkpoint to the backend database.
- Added unit tests for settings store in `settings-store.test.js`. Verified clean passage of `npm run lint`, `npm test`, and `npm run build`.

**Modified files**

- `apps/web/src/store/settings-store.js`
- `apps/web/src/store/settings-store.test.js`
- `apps/web/src/features/settings/SettingsPage.jsx`
- `apps/web/src/features/editor/EditorPage.jsx`
- `apps/web/src/features/editor/VersionHistory.jsx`
- `IMPLEMENTATION_LOG.md`

**Architectural decisions**

- Persistent Zustand store syncs user autosave preferences across pages instantly via reactive state listeners.
- Reverting a historical version creates a new incremented version snapshot in the backend transaction log, preserving full auditability.

**Blockers**

- None.



