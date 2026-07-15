# Voxel implementation plan

## Authority and conflict decisions

`/prompt` is read-only and remains the governing documentation set. The newest rebuild instruction establishes these binding adaptations:

- Product, package, service, image, metadata, and documentation names use `Voxel` exclusively.
- Voxel is a visual workspace platform, not a conventional CRUD dashboard product.
- The canvas model uses `Node` terminology and an entity-component-system-inspired runtime.
- React 19, Vite, strict TypeScript, Tailwind CSS v4, Fastify, Prisma, PostgreSQL, Redis, BullMQ, Yjs, Hocuspocus, Docker, and the specified testing stack are mandatory.

## Dependency graph

```text
Repository conventions and quality gates
  └─ Shared contracts, validation, tokens, and configuration
      ├─ Local infrastructure: PostgreSQL, Redis, object storage
      │   └─ Prisma schema, migrations, repositories, Fastify platform
      │       ├─ Authentication, session, RBAC, audit infrastructure
      │       │   └─ Workspace and dashboard APIs
      │       │       └─ Node runtime, history, autosave, and search
      │       │           └─ Yjs/Hocuspocus collaboration and presence
      │       └─ Queue workers, notifications, and file processing
      └─ Frontend providers, tokens, routes, and error boundaries
          └─ Authentication and workspace shell
              └─ Canvas, selection, command/history, and inspector
                  └─ Collaborative editor and product modules
```

## Milestones

1. **Foundation** — monorepo, strict compiler and lint settings, formatting, environment validation, shared contracts, tokens, error conventions, and implementation log.
2. **Local platform** — Docker Compose services for PostgreSQL, Redis, MinIO, API, client, realtime, and workers; health checks and secrets templates.
3. **Identity and access** — Google OAuth authorization-code flow with PKCE, secure cookie sessions, refresh-token rotation, RBAC, audit events, and protected routes.
4. **Backend platform** — Fastify plugins, versioned responses, validation, repositories/services/controllers, Prisma migrations, caching, queues, OpenAPI, and test database support.
5. **Frontend platform** — application providers, token-driven design system, routes, app shell, command palette, accessibility primitives, API client, and error/loading/offline states.
6. **Workspace engine** — workspace/dashboard lifecycle, node registry, scene serialization, grid layout, selection, commands, undo/redo, clipboard, and autosave.
7. **Realtime collaboration** — Yjs document model, Hocuspocus authorization and persistence, awareness/presence, collaboration recovery, version snapshots, and offline synchronization.
8. **Core modules** — templates, comments, notifications, search, sharing, file uploads, settings, and activity/audit views.
9. **Hardening** — authorization review, rate limits, CSP and headers, performance budgets, virtualization, monitoring, CI, E2E/accessibility/security tests, and deployment manifests.

## Milestone acceptance policy

No milestone advances until its TypeScript build, ESLint, relevant automated tests, accessibility review, documentation, and production configuration checks pass. External credentials and managed-service access are supplied only through environment variables; no secrets are placed in source control.
