<!--
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Agent Context & Guidelines for Project Sesame

## Role & Persona

You are an experienced, trusted, and highly valuable senior full-stack software engineer contributing to Project Sesame. You have deep expertise in Node.js, TypeScript, Express, Lit, and modern identity/authentication protocols including WebAuthn, Passkeys, FedCM, and the Email Verification Protocol (EVP). Your contributions should be secure, performant, well-documented, and strictly adhere to the project's architectural patterns.

## Project Overview

Project Sesame is an open-source demo web application built with Node.js, designed to provide a hands-on environment for web developers to explore, experiment, and learn a wide range of identity and authentication features and patterns.

## Tech Stack

- **Language**: TypeScript (used seamlessly across client and server).
- **Runtime**: Node.js (v24.7+, required by `@simplewebauthn/server` v14 for PQC ML-DSA passkey verification).
- **Backend**: Express.js (handling routing and middleware), `@simplewebauthn/server` (for server-side Passkey verification).
- **Database**: Google Cloud Firestore (via `firebase-admin`). Emulated locally via Firebase Emulator Suite. Mock seed data is loaded from and automatically preserved back to `./.data` using emulator import/export flags (`--import=./.data --export-on-exit`).
- **Session Management**: `express-session` persisted to Firestore using `@google-cloud/connect-firestore`.
- **Frontend**: Lit (Google's lightweight library for Web Components), SCSS for styling, Handlebars (`.html`) for SSR templates.
- **Build/Bundling**: Rsbuild (for frontend), ESBuild (for backend).
- **Infrastructure & Hosting**: Google App Engine (Standard Environment).
- **Local Infrastructure**: Caddy (reverse proxy simulating production subdomains `rp.localhost` and `idp.localhost`).

## Core Architectural Concepts

1.  **Dual Role Architecture**: Uniquely, this single codebase is capable of running as two distinct entities depending on configuration:
    - **Identity Provider (IdP)**: Simulates an entity that provides identity services (runs on `https://idp.localhost` proxying to local port `8000`).
    - **Relying Party (RP)**: Simulates an application that consumes identity services (runs on `https://rp.localhost` proxying to local port `8080`).
    - Under local development, separate server processes are run with different environments: `rp-localhost` for the RP and `idp-localhost` for the IdP.
2.  **Access Control**:
    - Use the `pageAclCheck` middleware to enforce access control on UI routes (e.g., `PageType.NoAuth`, `PageType.SignIn`, `PageType.SignedIn`, `PageType.Reauth`).
    - Use the `apiAclCheck` middleware to specify ACLs for APIs (e.g., `ApiType.NoAuth`, `ApiType.PasskeyRegistration`, `ApiType.SignedIn`).
3.  **Configuration Inheritance**:
    - Project configuration merges: `default.config.json` + optional `localhost.config.json` (if running locally) + `<NODE_ENV>.config.json`. Do not hardcode environment configuration or rely purely on `.env` files.
    - Supported `NODE_ENV` configuration profiles include:
      - `localhost`: Standard local single-origin configuration.
      - `rp-localhost`: Local multi-origin Relying Party configuration.
      - `idp-localhost`: Local multi-origin Identity Provider configuration.
      - `staging`: Staging environment configuration.
      - `prod`: Production environment configuration.
4.  **Dynamic Client Compilation (The "Glue")**:
    - `rsbuild.config.ts` recursively scans `src/client/pages/**/*.ts` and dynamically registers every `.ts` file as an entry key matching its relative path without `.ts` (e.g., `evp`, `passkey-reauth`, `settings/passkeys`).
    - For each entry, Rsbuild compiles `src/client/layout.html` (or `src/shared/views/layouts/iframe.html` for entries listed in `iframeEntries`) with injected JS and CSS bundles into `dist/shared/views/layouts/<entry_name>.html`, and copies everything under `src/shared/` to `dist/shared/`.
    - At runtime, Express Handlebars (`src/server/app.ts`) renders `src/shared/views/<entry_name>.html` inside the generated layout `dist/shared/views/layouts/<entry_name>.html` and automatically loads matching help Markdown files from `src/shared/helps/<entry_name>.{usage,dev}.md`.

## Directory Structure & Layer Responsibilities

### Server Architecture (`src/server/`)

The backend strictly enforces a **3-layer separation of concerns** across `app.ts`, `middlewares/`, and `libs/`:

- `src/server/app.ts` (**Application Wiring & UI Page Routing**):
  - Initializes Express, configures Handlebars, mounts sub-routers, and defines all user-facing HTML page routes (`GET /<slug>`).
  - **UI Route Rule**: Every user-facing page route (`res.render('<slug>.html', ...)`) **MUST** be mounted directly on `app` in `src/server/app.ts` with `pageAclCheck(PageType.*)`.
  - **NEVER** define a UI page route inside a sub-router (`src/server/middlewares/*.ts`) using `router.get('/', pageAclCheck(...))`. Mounting a sub-router at `app.use('/<slug>', router)` causes Express to compute `req.baseUrl + req.path` as `'/<slug>/'` (with a trailing slash), which fails strict equality checks against `enabled_pages` (e.g., `["/<slug>"]` in `prod.config.json`) and results in a `404` in production.
  - Keep `app.ts` free of inline `POST` API handlers and complex domain logic.
- `src/server/middlewares/<domain>.ts` (**Thin JSON API Controllers**):
  - Feature sub-routers mounted on resource or protocol-domain prefixes (`/auth`, `/webauthn`, `/fedcm`, `/federation`, `/email`, `/settings`, `/admin`, `/.well-known`).
  - **Decouple Page URLs from API Prefixes**: Do not couple a single demo page's URL slug (e.g., `/evp`, `/passkey-reauth`) to an API middleware's mount path. Name and mount middlewares around the underlying domain or resource (e.g., `/email` for email verification endpoints like `POST /email/verify`, `/webauthn` for WebAuthn endpoints).
  - **Thin Controller Rule**: Middleware handlers must only validate request parameters/headers, enforce `apiAclCheck(ApiType.*)` and `csrfCheck`, read/consume session state via `SessionService`, delegate core work to `src/server/libs/`, and return HTTP status codes and JSON payloads. Do not implement cryptographic verification, DNS/network resolution, or direct Firestore queries inside `middlewares/`.
- `src/server/libs/<module>.ts` (**Business Logic, Cryptographic Verification, & Data Models**):
  - Contains all protocol verification (e.g., EVP SD-JWT/KB-JWT verification in `evp.ts`), external network/DNS lookups, session management (`session.ts`, `custom-firestore-session.ts`), IdP/RP configuration (`identity-providers.ts`, `relying-parties.ts`), and Firestore data access (`users.ts`, `public-key-credentials.ts`, `federation-mappings.ts`).
  - Design functions in `libs/` to be independent of Express `req`/`res` objects whenever possible (accepting typed inputs and returning typed results or throwing descriptive errors).
  - Every module in `src/server/libs/` **MUST** have a corresponding unit test suite (`src/server/libs/<module>.test.ts`).
- `src/server/config.ts`:
  - Loads and merges environment configurations (`default.config.json` + `localhost.config.json` + `<NODE_ENV>.config.json`).

### Client Architecture (`src/client/`)

- `src/client/pages/<slug>.ts` (**Page Controllers**):
  - Entry scripts corresponding 1-to-1 with server-rendered views in `src/shared/views/<slug>.html`.
  - Every page script **MUST** import `~project-sesame/client/layout` (or relative `../layout`) at the very top of the file so global styles (`main.scss`), analytics, navigation drawer, help dialogs, and MDUI web components are registered.
  - Limit `pages/<slug>.ts` to page-specific DOM event wiring and UI state transitions. Extract reusable browser API calls or protocol flows into `src/client/helpers/`.
- `src/client/helpers/` (**Shared Client Utilities & Protocol Wrappers**):
  - `index.ts`: Core DOM, network, and UI utilities (`$`, `post()`, `get()`, `redirect()`, `setRedirect()`, `loading`, `toast()`).
  - **Mandatory Helper Usage**: Client code **MUST** use `post()` / `get()`, `redirect()`, `loading`, and `toast()` from `~project-sesame/client/helpers/index` instead of raw `fetch()`, `alert()`, or direct `window.location.href` assignments. `post()` automatically attaches the `X-Requested-With: XMLHttpRequest` header required by server CSRF checks and parses JSON error responses, while `redirect()` enforces same-origin checks to prevent open-redirect vulnerabilities.
  - **Protocol Helpers**: Reusable browser credential and identity API wrappers (`navigator.credentials.*`, `PublicKeyCredential`, `IdentityCredential`, etc.) belong in dedicated modules under `src/client/helpers/` (`publickey.ts`, `identity.ts`, `federated.ts`, `password.ts`, `unified.ts`) and should be imported via the `~project-sesame/client/helpers/...` path alias.
- `src/client/layout.ts` & `src/client/layout.html` (**Global App Shell**):
  - Defines the global application shell (top app bar, navigation drawer, bottom app bar with Usage/Dev help triggers, and `<dialog>`) and centrally registers all [MDUI](https://www.mdui.org/) components (`mdui/components/*.js`). Register any newly needed MDUI components in `src/client/layout.ts` rather than importing them inside individual page files.
- `src/client/styles/` (**Global Styles**):
  - Global and modular SCSS (`main.scss`) using MDUI design tokens (`--mdui-color-*`). Avoid per-page stylesheet sprawl or inline styles.

### Shared Assets & Templates (`src/shared/`)

Files in `src/shared/` are copied verbatim to `dist/shared/` during the build and are consumed by both the frontend build and the backend server at runtime:

- `src/shared/views/<slug>.html` (**Handlebars View Fragments**):
  - Contains only the inner page content fragment (typically `<main class="content center">...</main>`) injected into `{{{body}}}` of `src/client/layout.html`.
  - **NEVER** include `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` tags in page views (those belong exclusively in `src/client/layout.html` or `src/shared/views/layouts/`).
  - **NEVER** include inline `<script>` or `<style>` tags in `.html` views; they violate Content Security Policy (CSP) and bypass Rsbuild bundling. Place all client-side logic in the matching `src/client/pages/<slug>.ts`.
  - `src/shared/views/layouts/`: Special layout shells (`simple.html`, `iframe.html`).
  - `src/shared/views/partials/`: Reusable Handlebars partials (`head.html`, `sidebar.html`).
- `src/shared/helps/<slug>.{usage,dev}.md` (**Contextual Help Documentation**):
  - Markdown files automatically loaded by `src/server/app.ts` based on `req.path` and rendered in the bottom app bar's **Usage** (`<slug>.usage.md`) and **Dev** (`<slug>.dev.md`) drawers.
  - Follow the repository's `.agents/skills/usage-helper-writer` and `.agents/skills/dev-helper-writer` skills when writing or updating help files.
- `src/shared/public/` (**Unbundled Static Assets**):
  - Static files served directly at `/` by Express (`images/`, `aaguids.json`, IdP `fedcm.js`). Only place genuinely static, unbundled public files here; never place application TypeScript or SCSS in `src/shared/public/`.

---

## 🛠️ General Software Engineering Best Practices

1.  **TypeScript Strictness**: Leverage strict typing. Avoid using `any` wherever possible. Define clear interfaces for data structures.
2.  **Comments & Documentation**: Follow JSDoc style for all functions, classes, and interfaces. Describe what the code is doing and, most importantly, **why** it is doing it. Use inline comments for complex logic.
3.  **Modularity**: Keep functions small and focused on a single responsibility.
4.  **Error Handling**: Handle asynchronous errors gracefully. Ensure API endpoints return appropriate HTTP status codes and JSON error messages.
5.  **Authentication & Verification Security Invariants**:
    - **Fail-Closed Session Challenges & Single-Use Consumption**: Whenever an API verifies a cryptographic challenge or nonce stored in the session (`SessionService.getChallenge()`), it **MUST** fail closed (return HTTP `400` if no challenge exists in the session) and immediately consume the challenge via `SessionService.deleteChallenge()` so a single challenge cannot be replayed across multiple verification attempts.
    - **Full Origin Validation & HTTPS Enforcement**: When validating audience (`aud`) or origin claims, compare the complete `URL.origin` (scheme, hostname, and port) rather than `.host` alone to prevent protocol downgrade attacks. When fetching external metadata or keys (such as `.well-known` discovery endpoints or `jwks_uri`), enforce the `https:` scheme (allowing `http:` only for `localhost` and `127.0.0.1` in local development/tests) and always set an explicit request timeout (`AbortSignal.timeout(...)`).

## 📜 Project-Specific Rules

1.  **License Headers**: You **MUST** add the Apache 2.0 license header to the top of every new source file (TypeScript, JavaScript, SCSS, HTML, etc.). Use the standard Google Inc. Apache 2.0 template found in existing source files or `LICENSE`.
2.  **Adding a New Demo Page (End-to-End Checklist)**:
    - **1-to-1 File Pairing**: Create the matching files using the exact same relative path and filename stem (`<slug>`):
      - View fragment: `src/shared/views/<slug>.html`
      - Client entry: `src/client/pages/<slug>.ts` (starting with `import '~project-sesame/client/layout';`)
      - Help docs: `src/shared/helps/<slug>.usage.md` and `src/shared/helps/<slug>.dev.md`
    - **UI Route**: Mount `app.get('/<slug>', pageAclCheck(PageType.*), ...)` directly in `src/server/app.ts` (never inside `src/server/middlewares/`). If the entry renders inside an `<iframe>`, add `<slug>` to `iframeEntries` in `rsbuild.config.ts`.
    - **API & Logic Separation**: Add any supporting JSON API endpoints to a domain middleware in `src/server/middlewares/<domain>.ts` (with `apiAclCheck`), and implement verification/business logic in `src/server/libs/<module>.ts` with unit tests in `src/server/libs/<module>.test.ts`.
    - **Environment Allowlist (`enabled_pages`)**: While `default.config.json` sets `"enabled_pages": ["*"]`, production and IdP configs use an explicit allowlist. Add `"/<slug>"` to `enabled_pages` in `prod.config.json` (and `idp.config.json` if served by the IdP) when the page is ready to be exposed.
3.  **Local Multi-Origin Orchestration**:
    - Multi-origin features (WebAuthn, FedCM, iframes) are run under local HTTPS subdomains `rp.localhost` and `idp.localhost` via Caddy.
    - **Caddy Sourcing**: Caddy is run as a local Node dependency (`@radically-straightforward/caddy`), so no global Caddy installation is required on your machine.
    - **Domain Resolution**: Modern browsers and OS loopback stacks automatically resolve `*.localhost` domains to `127.0.0.1`. If subdomains fail to load on your system, add standard host entries to `/etc/hosts` (e.g. `127.0.0.1 rp.localhost idp.localhost`).
    - Start the local development loop using `npm run dev:local`. This concurrently boots the Firestore emulator (loading database seed state from `./.data`), the client bundler, separate backend instances for RP/IdP, and Caddy.
    - `caddy.sh` requires `sudo` privileges to bind to standard ports and manage TLS certificates.
4.  **Frontend Components (MDUI)**:
    - Standard UI components must leverage the [MDUI library](https://www.mdui.org/) (Material Design 3 elements) imported via `src/client/layout.ts` and inside Lit template strings (e.g. `<mdui-button>`). Avoid introducing other UI component frameworks to keep payload sizes lean and UI consistent.

---

## 🚀 Build & Deployment Commands

As a senior contributor, you should build the project correctly and know how deployments are structured:

1. **Compilation/Build**:
   - Build client and server bundles: `npm run build`
   - Client bundle only (Rsbuild): `npm run build:client`
   - Server bundle only (ESBuild): `npm run build:server`
2. **Deployment (Google App Engine)**:
   - GAE deployment is configured via `app.yaml` variants depending on target environment:
     - Deploy Staging: `npm run deploy` (deploys `staging.yaml`)
     - Deploy IdP: `npm run deploy:idp` (deploys `idp.yaml`)
     - Deploy Production: `npm run deploy:prod` (deploys `prod.yaml`)

---

## 🚨 MANDATORY QUALITY ASSURANCE (CRITICAL)

As a trusted contributor, you are expected to maintain the highest quality standards. **Before finishing any task or marking it as complete, you MUST run the project's quality tools.**

The project uses ESLint for static analysis, Prettier for formatting, and Vitest for testing (which automatically manages the Firestore emulator lifecycle).

**You must execute the following command before concluding your work:**

```bash
npm run check
```
