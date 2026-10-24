# Voxel

Voxel is a collaborative visual workspace for building and sharing spatial dashboards. Teams can arrange editable canvas cards, organize dashboards in workspaces, invite members with role-based access, and share expiring view or edit links.

## Product capabilities

- **Canvas editor:** Add and configure metric, KPI display, progress, chart, note, status, logic, image, embed, table, timer, link, divider, and code cards. The built-in registry drives the element picker, defaults, inspector fields, and configuration checks. The dnd-kit engine supports mouse, touch, pen, and keyboard dragging, multi-selection movement, grid snapping, drop targets, source placeholders, and edge auto-scroll. Shift-click or drag a selection marquee to select multiple widgets. Group and ungroup widgets; grouped widgets select, move, and duplicate together. Align and distribute selections or match their dimensions. Resize from all four edges and corners with pointer or keyboard controls; connect, copy, paste, undo, and redo. Right-click menus expose canvas and widget actions with keyboard navigation. Large scenes render widgets near the canvas viewport while keeping selected or actively dragged widgets mounted; timers keep their elapsed state while offscreen. A failing widget is isolated so the rest of the canvas stays usable.
- **Collaboration:** Yjs and Hocuspocus synchronize canvas updates and authenticated presence. Editors see member avatars, live cursors, selections, typing status, and each collaborator’s viewport in a clickable canvas overview. Dashboard discussions support one-level reply threads, @email teammate mentions, node or selection anchors, and resolve/reopen state. Commenter access allows posting; authors and workspace editors can moderate. Account notifications persist across devices for comments, mentions, and invitations. Workspace roles control editor access; archived dashboards and workspaces are read-only.
- **Workspace management:** Create, rename, duplicate workspace settings, archive, restore, leave, and transfer ownership. Owners and admins can upload a workspace cover image. Deleted workspaces and dashboards stay in Trash for 30 days; restoring them does not reactivate old share or invite links.
- **Workspace files:** Upload, download, and remove image, PDF, CSV, JSON, and Markdown files. S3-compatible storage keeps file bytes outside Postgres; uploads are type-checked, limited to 10 MB each, and accounted against a locked 1 GiB workspace quota.
- **Data-backed widgets:** Metric, display, chart, progress, status, and table cards can read authorized workspace CSV/JSON files, public HTTPS JSON REST endpoints, or public GraphQL endpoints. Configure a column or property path, refresh on demand, or poll every 30 seconds, minute, or five minutes. REST and GraphQL requests use a bounded server proxy that blocks private network targets, redirects, credentials, and oversized responses. Record tables display at most 1,000 rows; failed refreshes identify when the last successful data is being shown.
- **Sharing:** Create revocable links with view or edit access and an expiration. Shared views resolve connected widget values but do not fetch private workspace files or external REST/GraphQL responses; data-backed cards explain that limit, and edit links can switch them to a manual value. Read-only links omit data-source URLs, GraphQL queries, and file identifiers. Workspace invitations are scoped to an email, expire after seven days, and are sent through the configured email delivery webhook. Existing verified members also receive an in-app invitation notification.
- **Account controls:** Email and Google sign-in, verified sign-in email changes for password accounts, profile photo upload, profile and appearance preferences, password changes and recovery, TOTP two-factor authentication with single-use recovery codes, session review and revocation, workspace member roles, and audit events.
- **Dashboard lifecycle:** Draft, publish, archive, restore, search, version history, and reusable workspace templates with private drafts, admin publishing, and personal favorites.
- **Global search and commands:** Search authorized, active workspaces across dashboards, widgets, templates, and members. Search runs on demand with bounded, categorized results; dashboard scenes are indexed in Postgres and remain on the server. The command palette also creates dashboards and workspaces, invites members, switches themes, and keeps account-scoped recent pages.
- **Widget packs:** Browse and search curated, declarative widget packs by category, view installed packs and available updates, and install, update, or remove packs. Workspace owners and admins manage packs; Voxel validates their schemas and versions, packs declare no additional permissions, updates are audited, and updates or removals are blocked while affected widget types are still used by a dashboard or reusable template.

The widget catalog currently contains Voxel-published declarative packs that use the built-in renderer set. Third-party code plugins, their isolated execution sandbox, plugin settings, ratings, and marketplace publishing are not implemented. Authenticated REST, GraphQL, SQL, and vendor data integrations are not implemented; REST and GraphQL sources support public HTTPS endpoints without credentials. Widgets also use manual values, connected widget values, or workspace CSV/JSON files. Announcements, browser push, billing, public APIs, and webhooks are also not implemented. Notification preferences do not control email or browser push delivery.

Email/password registration now requires a single-use, 24-hour verification link. Local development shows a verification link in the app; invitations return a link that an administrator can copy when email delivery is not configured. Production must configure an HTTPS email-delivery webhook using `VOXEL_EMAIL_DELIVERY_URL`, `VOXEL_EMAIL_DELIVERY_TOKEN`, and `VOXEL_EMAIL_FROM`; the API sends JSON with `from`, `to`, `subject`, `text`, and `html` for verification and workspace invitation emails. Google accounts are accepted only when Google reports a verified email. Invite links also require a signed-in account whose address matches the invited address; treat the invite URL as a secret.

Accounts can enable TOTP two-factor authentication from Settings → Security. Authenticator secrets are encrypted at rest, sign-in challenges expire after five minutes, and recovery codes are single-use. Production must set a stable random `MFA_ENCRYPTION_KEY` of at least 32 characters; changing it makes existing authenticator secrets unreadable. Recovery codes are shown once when enabled or regenerated, so save them before closing the page.

Password accounts can change their sign-in email from Settings → Account after signing in within the last 10 minutes. Voxel sends a single-use confirmation link to the new address and keeps the current address active until confirmation. The link expires after 24 hours; confirming it signs out every session. Google-managed sign-in addresses are changed through Google.

Password reset requests return the same production response whether or not the email matches an eligible account. Reset links expire after one hour, are stored only as token hashes, and can be used once. Resetting a password revokes every active session and pending MFA sign-in challenge. The token stays in the link fragment so it is not sent in the page request URL.

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

2. Copy `.env.example` to `.env` and set the database, Redis, session secret, MFA encryption key, and public app URL. Google OAuth is optional; configure both Google client variables to enable it. The example includes local RustFS storage credentials; production must replace them with HTTPS S3-compatible storage and configure an HTTPS email-delivery webhook.

3. Start PostgreSQL, Redis, and RustFS (Compose creates the development bucket), then apply the Prisma schema:

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
