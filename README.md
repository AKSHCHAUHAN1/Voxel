# Voxel

Voxel is a collaborative visual workspace for building and sharing spatial dashboards. Teams can arrange editable canvas cards, organize dashboards in workspaces, invite members with role-based access, and share expiring view or edit links.

## Product capabilities

- **Canvas editor:** Add and configure metric, KPI display, progress, chart, note, status, logic, image, embed, table, timer, link, divider, and code cards. The built-in registry drives the element picker, defaults, inspector fields, and configuration checks. Drag, resize, snap to the canvas grid, connect, copy, paste, undo, and redo. A failing widget is isolated so the rest of the canvas stays usable.
- **Collaboration:** Yjs and Hocuspocus synchronize canvas updates and presence. Dashboard discussions support one-level reply threads, @email teammate mentions, node or selection anchors, and resolve/reopen state. Commenter access allows posting; authors and workspace editors can moderate. Account notifications persist across devices for comments, mentions, and invitations. Workspace roles control editor access; archived dashboards and workspaces are read-only.
- **Workspace management:** Create, rename, duplicate workspace settings, archive, restore, leave, and transfer ownership. Owners and admins can upload a workspace cover image. Deleted workspaces and dashboards stay in Trash for 30 days; restoring them does not reactivate old share or invite links.
- **Workspace files:** Upload, download, and remove image, PDF, CSV, JSON, and Markdown files. S3-compatible storage keeps file bytes outside Postgres; uploads are type-checked, limited to 10 MB each, and accounted against a locked 1 GiB workspace quota.
- **Sharing:** Create revocable links with view or edit access and an expiration. Invite links are scoped to an email and expire after seven days. Voxel creates the invite link; it is not sent by email in this release.
- **Account controls:** Email and Google sign-in, profile photo upload, profile and appearance preferences, password changes, session review and revocation, workspace member roles, and audit events.
- **Dashboard lifecycle:** Draft, publish, archive, restore, search, version history, and reusable workspace templates with private drafts, admin publishing, and personal favorites.

This release ships built-in widget definitions only. The third-party widget SDK, plugin sandbox, and marketplace described in the product prompt are not implemented. External data connectors (REST, GraphQL, SQL, and vendor integrations) are not implemented; metric and chart cards currently use manual or connected widget values. Announcements, browser push, two-factor authentication, billing, public APIs, and webhooks are also not implemented. Notification preferences do not control email or browser push delivery.

Email/password registration now requires a single-use, 24-hour verification link. Local development shows a verification link in the app. Production must configure an HTTPS email-delivery webhook using `VOXEL_EMAIL_DELIVERY_URL`, `VOXEL_EMAIL_DELIVERY_TOKEN`, and `VOXEL_EMAIL_FROM`; the API sends JSON with `from`, `to`, `subject`, `text`, and `html`. Google accounts are accepted only when Google reports a verified email. Invite links also require a signed-in account whose address matches the invited address; treat the invite URL as a secret.

## Architecture

This is an npm workspace monorepo:

```text
apps/
  api/       Fastify API, Prisma schema, auth, workspaces, sharing, realtime
  web/       React and Vite application
packages/
  contracts/ Shared request and response contracts
```

The app uses React 19, Vite, Tailwind CSS 4, TanStack Query, and Zustand in the web client. The API uses Fastify, Prisma, PostgreSQL, signed sessions, and Hocuspocus/Yjs for collaboration. Redis supports the realtime service.

## Requirements

- Node.js 22 or newer
- npm 11 or newer
- PostgreSQL 16 or newer
- Redis

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set the database, Redis, session secret, and public app URL. Google OAuth is optional; configure both Google client variables to enable it. The example includes local MinIO storage credentials; production must replace them with HTTPS S3-compatible storage and configure an HTTPS email-delivery webhook.

3. Start PostgreSQL, Redis, and MinIO (Compose creates the development bucket), then apply the Prisma schema:

   ```bash
   docker compose up -d
   npm run prisma:deploy -w @voxel/api
   ```

4. Start the API and web app:

   ```bash
   npm run dev
   ```

   The web app is served at `http://localhost:5173`; the API is served at `http://localhost:3000`.

## Project commands

```bash
npm run lint
npm test
npm run build
```

For an existing database created with `prisma db push`, baseline the current schema before the first `prisma migrate deploy`; subsequent releases should use the checked-in migrations.

## License

No license file is included yet.
