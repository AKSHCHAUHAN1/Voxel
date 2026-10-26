# Deployment and operations

Voxel produces three containers from the repository root: the API runtime, a one-shot database migration task, and the web runtime. The web image runs unprivileged on port 8080 and serves the single-page app. It proxies `/api/` and `/api/v1/realtime` to the API, so browsers use one origin for sessions, REST requests, and collaboration sockets.

```text
Browser ── HTTPS ──> TLS ingress ──> Web container :8080 ──> API container :3000
                                              └─────────────> PostgreSQL, Redis, S3-compatible storage
```

The API must stay on a private application network. Only the TLS ingress should accept public traffic. Configure `API_UPSTREAM` on the web container to reach the API service. Set `TRUST_PROXY=true` on the API only when the API is reachable exclusively through a proxy that overwrites forwarded-address headers. The bundled Nginx config replaces `X-Forwarded-For` with its immediate peer address; if a load balancer sits in front of Nginx, configure Nginx to trust only that load balancer's network before relying on client IP rate limits. Do not enable proxy trust on an API exposed directly to the Internet.

## Build and release

Build immutable image tags from the same commit. The migration image contains the Prisma CLI; the API runtime omits development dependencies.

```bash
docker build --file Dockerfile.api --target runtime --tag voxel-api:<commit> .
docker build --file Dockerfile.api --target migrate --tag voxel-api-migrate:<commit> .
docker build --file Dockerfile.web --tag voxel-web:<commit> .
```

Before each rollout:

1. Assign a release owner and confirm the staging operator and incident contact are reachable.
2. Verify the target database and storage backup, and record their snapshot identifiers.
3. Run the migration task once with the release's `DATABASE_URL` and restricted database credentials:

   ```bash
   docker run --rm --env-file /secure/voxel-staging.env voxel-api-migrate:<commit>
   ```

4. Start the API and web images on the private service network. Inject secrets from the hosting platform; do not bake `.env` files into images.
5. Confirm `GET /health/live` and `GET /health/ready` on the API, then confirm the public web route, sign-in, email delivery, file upload/download, and realtime collaboration smoke checks.
6. Observe error rate, request latency, Redis/database health, object-storage failures, and realtime connections through the platform's logs and metrics before promoting the same image digests to production.

Migrations use forward-only `prisma migrate deploy`. Review generated SQL for table locks, destructive changes, and application-version compatibility before release. Use expand-and-contract changes when two application versions may run at once. If a release fails and its migration is backward-compatible, roll back to the previous API and web image digests. If data has changed incompatibly, stop traffic and use the restore procedure; do not run an improvised down-migration.

## Configuration and secrets

Use `.env.example` as the configuration inventory. Production also needs HTTPS public application and API URLs, HTTPS S3-compatible storage, a persistent PostgreSQL database, Redis, and an HTTPS email-delivery webhook. Google OAuth is optional. Keep API, database, Redis, and object-storage endpoints private. The web image's default API upstream is `http://api:3000`; override it to match the private service name.

- `SESSION_SECRET` is a signing key. Rotating it invalidates existing signed access and refresh credentials; communicate the planned sign-in reset and verify new sessions after rotation.
- `MFA_ENCRYPTION_KEY` encrypts authenticator secrets at rest. Replacing it without decrypting and re-encrypting existing secrets makes MFA unusable. The current application has no online key-rewrapping workflow; preserve this key in the secret manager and treat loss as an account recovery incident.
- Database, Redis, S3, email, and OAuth credentials should be rotated in the provider first, then updated in the secret manager and deployed. Verify readiness and each integration before revoking the previous credential.
- Never place production data or secrets in CI logs, development `.env` files, screenshots, issue reports, or test fixtures.

## Backups and restore

The infrastructure operator must enable encrypted, automated PostgreSQL backups and object-store versioning or an equivalent point-in-time recovery mechanism. Keep backup access separate from application credentials. Select database and object-storage recovery points from the same time window; dashboard records reference stored objects, so restoring only one side can leave missing files or orphaned objects.

Before a restore, pause writes at the ingress, record the incident time, preserve the current database and object-store state for investigation, and notify the incident owner. Restore PostgreSQL to a new isolated instance and restore the corresponding object-storage versions to a separate bucket or prefix. Apply the matching release's migrations, verify row counts and file downloads, then switch the application to the recovered database and storage. Keep the original state until the incident owner approves cleanup.

Run a restore exercise in staging before public production traffic and record duration, data loss window, snapshot IDs, and the operator. The project does not configure a hosting provider, backup schedule, alert destination, on-call rota, or named operator; the deploying organization must provide those and validate its recovery objectives before launch.

## Incident checks

1. Check `GET /health/live` for process health and `GET /health/ready` for PostgreSQL, Redis, and configured object storage status.
2. Inspect redacted structured API logs and hosting metrics for the affected release, request IDs, latency, error rate, queue delay, and dependency failures. Do not copy raw cookies, access tokens, invite/share links, MFA codes, or dashboard contents into incident channels.
3. For suspected credential exposure, restrict public ingress as needed, rotate the affected provider credential, review audit events and authentication failures, and revoke affected sessions.
4. For suspected data corruption, stop writes, preserve snapshots, and follow the restore procedure. Keep the incident owner informed before restoring over live data.
5. Record the impact, recovery point, release involved, remediation, and follow-up owner after service is restored.

This runbook describes the application boundary. Alert routing, provider-specific backup commands, and the named incident owner are deployment responsibilities and must be completed for each environment.
