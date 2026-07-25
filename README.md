# Voxel ── Visual Canvas & Infrastructure Telemetry System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/Build-Passing-emerald.svg)](https://github.com/AKSHCHAUHAN1/Voxel)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-43853D.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/Frontend-React_18_%7C_Vite-61DAFB.svg)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Backend-Fastify_%7C_Prisma-000000.svg)](https://fastify.dev/)

**Voxel** is an enterprise-grade collaborative visual telemetry platform and spatial canvas editor designed for real-time system monitoring, flow architecture mapping, and operational dashboards. Built as a high-performance JavaScript monorepo, Voxel combines dynamic canvas layouting with real-time multi-user collaboration, automated checkpoint version control, and granular role-based access management.

---

## 🌟 Key Features

### 🎨 Infinite Spatial Canvas & Node Library
- **Interactive Grid System**: Drag-and-drop node positioning with snap-to-grid alignment and customizable grid patterns (*Dot Matrix*, *Grid Lines*, *Radial Mesh*, *Clean Canvas*).
- **Rich Telemetry Node Suite**:
  - **Metric Cards**: Real-time numerical metrics, trend percentages, and custom units (`ms`, `req/s`, `%`, `MB`).
  - **Status Indicators**: Operational health badges (`success`, `warning`, `error`) with pulse highlights.
  - **Chart Nodes**: Visual sparkline and trend graphs for system load monitoring.
  - **Rich Notes**: Markdown-supported documentation and team instruction cards.
  - **Log Streams & Tables**: Tabular telemetry displays and live terminal-style log streams.
- **Smart Connection Engine**: Dynamic bezier link paths with solid, dashed, pulsing, or glowing visual styles.

### 🔄 Autosave Engine & Git-Style Version Control
- **Configurable Autosave**: Multi-mode saving engine supporting Realtime (instant sync), 5-second, 30-second, or Manual Save modes.
- **Adaptive UI**: Automatically hides manual save buttons when Autosave is active and displays live status indicators.
- **Git-Style Version Control**:
  - Automated version snapshot creation on canvas mutations.
  - Comprehensive version history panel with node count, connection density, and timestamp metadata.
  - One-click **Revert to Version #X** workflow that safely rolls back canvas states while logging audit points.

### 👥 Real-Time Collaboration & Workspace RBAC
- **Live Multiplayer Awareness**: Real-time cursor tracking, live presence indicators, and conflict-free editing powered by Yjs.
- **Multi-Tenant Workspaces**: Multi-workspace organization, workspace switching, and workspace settings customization.
- **Role-Based Access Control (RBAC)**: Support for `OWNER`, `ADMIN`, `EDITOR`, and `VIEWER` permission levels with member invite workflows.

### ⚙️ Enterprise Settings Suite
- **Account & Persona**: Avatar customization, profile metadata, language preferences, timezone configurations, and user bios.
- **Visual Atelier**: Light & Dark mode theme transitions, accent color palette selectors, and grid density controls.
- **Security & Access**: Active device session list with instant session revocation, password update workflows, and audit event logs (`AuditEvent`).
- **Developer SDK & Webhooks**: Production API key generation (`vxl_live_...`), secret key regeneration, and webhook endpoint setup.

---

## 🏗️ Architecture & Monorepo Structure

Voxel is organized as an npm workspace monorepo separating frontend UI, backend API services, and shared data contracts:

```
voxel/
├── apps/
│   ├── api/                       # Fastify REST backend & Prisma ORM
│   │   ├── prisma/                # PostgreSQL Schema & Migrations
│   │   └── src/
│   │       ├── features/          # Auth, Workspaces, Audit Logs, Telemetry
│   │       └── db/                # Prisma client instantiation
│   └── web/                       # React 18 frontend web application
│       └── src/
│           ├── components/        # Layout, Command Palette, Modals
│           ├── features/          # Editor, Workspaces, Settings, Auth
│           └── store/             # Zustand state management stores
├── packages/
│   └── contracts/                 # Shared Zod validation schemas & types
├── docker-compose.yml             # Local PostgreSQL environment setup
├── eslint.config.js               # Shared ESLint configuration
└── package.json                   # Root monorepo workspace configuration
```

---

## 💻 Tech Stack

### Frontend (`@voxel/web`)
- **Core Framework**: React 18, Vite
- **State Management**: Zustand (Persistent stores for settings, theme, notifications, history), TanStack Query (React Query v5)
- **Styling & Motion**: Vanilla Tailwind CSS v4, Framer Motion, Lucide Icons
- **Real-Time Engine**: Yjs CRDTs, Y-Websockets

### Backend (`@voxel/api`)
- **HTTP Server**: Fastify
- **Database & ORM**: PostgreSQL, Prisma ORM
- **Security & Auth**: Node.js `crypto` (`scrypt` password hashing), `jose` (JWT authentication & HTTP-only secure cookies)
- **Validation**: Zod schema validation via `@voxel/contracts`

---

## 🚀 Quickstart Guide

### Prerequisites
Ensure you have the following installed on your system:
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **PostgreSQL**: `>= 16.0` (or Docker Desktop)

### 1. Repository Setup & Dependencies
Clone the repository and install dependencies across all monorepo workspaces:

```bash
git clone https://github.com/AKSHCHAUHAN1/Voxel.git
cd voxel
npm install
```

### 2. Environment Configuration
Create environment files for API and Web apps based on `.env.example`:

```bash
cp .env.example .env
```

### 3. Database Initialization
Start a local PostgreSQL container using Docker Compose and push the Prisma schema:

```bash
# Start PostgreSQL database container
docker compose up -d

# Generate Prisma Client & Push Database Schema
npx prisma db push --schema=apps/api/prisma/schema.prisma
```

### 4. Running Local Development Server
Start the client and server concurrently:

```bash
npm run dev
```

- **Web UI**: Access the application at `http://localhost:5173`
- **API Server**: Fastify backend runs at `http://localhost:3000`

---

## 🧪 Testing & Quality Gates

Run linting, automated test suites, and production builds across all workspaces:

```bash
# Run ESLint across all packages and apps
npm run lint

# Run Vitest test suites
npm test

# Build production bundle for deployment
npm run build
```

---

## 📄 License

Voxel is open-source software licensed under the **[MIT License](LICENSE)**.
