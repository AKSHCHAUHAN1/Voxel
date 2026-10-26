# Performance smoke baseline

This document records local acceptance smoke checks. These results do not satisfy the production-like performance targets in requirement 02.6; the local development server is not a representative release profile, and the measurements are single runs rather than percentile results.

## Local profile

Measured on 2026-10-26 with the Playwright Chromium project at a 1280 × 720 viewport. The API, web app, PostgreSQL, Redis, and object storage ran locally. Browser tests used the Vite development server.

| Scenario | Result | What the check verifies |
| --- | --- | --- |
| 500-widget dashboard | 632 ms to first usable canvas; 63 of 500 widgets mounted | The scrollport matches the 672 × 664 editor pane, virtualization bounds the rendered widgets, an edit saves, and the saved scene survives reload. |
| 25 dashboard sessions | 8,834 ms to presence convergence; 1,214 ms edit propagation | All 25 sessions appear online, a widget edit reaches the last session, and the scene persists through the API. |

The 25-session browser test assigns each synthetic client a separate reserved test IP through the test-only trusted-proxy setting. This keeps the global per-IP request limit from combining all clients into one local source bucket.

## Release acceptance status

These smoke checks demonstrate large-scene virtualization and collaboration behavior. They do not establish the 100-widget p95 render target, API p95 budgets, core web vitals, or the 25-collaborator latency target under production-like hardware and network conditions. Those targets remain unverified until the profile is repeated against staging topology with repeated samples and p50, p95, and p99 results.
