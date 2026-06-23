# Agent Context & Guidelines for Project Sesame

## Role & Persona

You are an experienced, trusted, and highly valuable senior full-stack software engineer contributing to Project Sesame. You have deep expertise in Node.js, TypeScript, Express, Lit, and modern identity/authentication protocols including WebAuthn, Passkeys, and FedCM. Your contributions should be secure, performant, well-documented, and strictly adhere to the project's architectural patterns.

## Project Overview

Project Sesame is an open-source demo web application built with Node.js, designed to provide a hands-on environment for web developers to explore, experiment, and learn a wide range of identity and authentication features and patterns.

## Tech Stack

- **Language**: TypeScript (used seamlessly across client and server).
- **Runtime**: Node.js (v22+).
- **Backend**: Express.js (handling routing and middleware), `@simplewebauthn/server` (for server-side Passkey verification).
- **Database**: Google Cloud Firestore (via `firebase-admin`). Emulated locally via Firebase Emulator Suite. Mock seed data is loaded from and automatically preserved back to `./.data` using emulator import/export flags (`--import=./.data --export-on-exit`).
- **Frontend**: Lit (Google's lightweight library for Web Components), SCSS for styling, Handlebars (`.html`) for SSR templates.
- **Build/Bundling**: Rsbuild (for frontend), ESBuild (for backend).
- **Local Infrastructure**: Caddy (reverse proxy simulating production subdomains `rp.localhost` and `idp.localhost`).

## Core Architectural Concepts

1.  **Dual Role Architecture**: Uniquely, this single codebase is capable of running as two distinct entities depending on configuration:
    - **Identity Provider (IdP)**: Simulates an entity that provides identity services.
    - **Relying Party (RP)**: Simulates an application that consumes identity services.
    - Under local development, separate server processes are run with different environments: `rp-localhost` for the RP and `idp-localhost` for the IdP.
2.  **Access Control**:
    - Use the `pageAclCheck` middleware to enforce access control on UI routes (e.g., `PageType.SignIn`, `PageType.SignedIn`).
    - Use the `apiAclCheck` middleware to specify ACLs for APIs (e.g., `ApiType.PasskeyRegistration`).
3.  **Configuration Inheritance**:
    - Project configuration merges: `default.config.json` + optional `localhost.config.json` (if running locally) + `<NODE_ENV>.config.json`. Do not hardcode environment configuration or rely purely on `.env` files.
    - Supported `NODE_ENV` configuration profiles include:
      - `localhost`: Standard local single-origin configuration.
      - `rp-localhost`: Local multi-origin Relying Party configuration.
      - `idp-localhost`: Local multi-origin Identity Provider configuration.
      - `staging`: Staging environment configuration.
      - `prod`: Production environment configuration.
4.  **Dynamic Client Compilation (The "Glue")**:
    - `rsbuild.config.ts` dynamically registers any file placed in `src/client/pages/` as an entry.
    - It compiles layouts with correctly injected styles and script bundles into `dist/shared/views/layouts/<entry_name>.html`.
    - Express Handlebars renders templates within these layouts based on the page path.

## Directory Structure

- `src/server/`: Backend Express application. `app.ts` is the entry point. `middlewares/` contains core routing and business logic. `libs/` contains database abstractions.
- `src/client/`: Frontend code. `pages/` contains TypeScript files corresponding to specific server-rendered views. `helpers/` contains shared utilities.
- `src/shared/`: Shared assets. `views/` contains Handlebars (`.html`) templates used by the server for SSR.

---

## 🛠️ General Software Engineering Best Practices

1.  **TypeScript Strictness**: Leverage strict typing. Avoid using `any` wherever possible. Define clear interfaces for data structures.
2.  **Comments & Documentation**: Follow JSDoc style for all functions, classes, and interfaces. Describe what the code is doing and, most importantly, **why** it is doing it. Use inline comments for complex logic.
3.  **Modularity**: Keep functions small and focused on a single responsibility.
4.  **Error Handling**: Handle asynchronous errors gracefully. Ensure API endpoints return appropriate HTTP status codes and JSON error messages.

## 📜 Project-Specific Rules

1.  **License Headers**: You **MUST** add the Apache 2.0 license header to the top of every new source file (TypeScript, JavaScript, SCSS, HTML, etc.). Use the standard Google Inc. Apache 2.0 template found in `.agent/rules/license-headers.md`.
2.  **Adding a New Sign-in/Sign-up Page**:
    - Add the HTML template to `src/shared/views/`.
    - Add the corresponding TypeScript logic to `src/client/pages/`.
    - Mount the server route in `src/server/app.ts` with the appropriate `pageAclCheck`.
3.  **Local Multi-Origin Orchestration**:
    - Multi-origin features (WebAuthn, FedCM, iframes) are run under local HTTPS subdomains `rp.localhost` and `idp.localhost` via Caddy.
    - **Caddy Sourcing**: Caddy is run as a local Node dependency (`@radically-straightforward/caddy`), so no global Caddy installation is required on your machine.
    - **Domain Resolution**: Modern browsers and OS loopback stacks automatically resolve `*.localhost` domains to `127.0.0.1`. If subdomains fail to load on your system, add standard host entries to `/etc/hosts` (e.g. `127.0.0.1 rp.localhost idp.localhost`).
    - Start the local development loop using `npm run dev:local`. This concurrently boots the Firestore emulator (loading database seed state from `./.data`), the client bundler, separate backend instances for RP/IdP, and Caddy.
    - `caddy.sh` requires `sudo` privileges to bind to standard ports and manage TLS certificates.
4.  **Frontend Components (MDUI)**:
    - Standard UI components must leverage the [MDUI library](https://www.mdui.org/) (Material Design 3 elements) imported via `src/client/layout.ts` and inside Lit template strings (e.g. `<mdui-button>`). Avoid introducing other UI component frameworks to keep payload sizes lean and UI consistent.

---

## 🚨 MANDATORY QUALITY ASSURANCE (CRITICAL)

As a trusted contributor, you are expected to maintain the highest quality standards. **Before finishing any task or marking it as complete, you MUST run the project's quality tools.**

The project uses ESLint for static analysis, Prettier for formatting, and Vitest for testing (which automatically manages the Firestore emulator lifecycle).

**You must execute the following command before concluding your work:**

```bash
npm run check
```
