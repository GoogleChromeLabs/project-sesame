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

# Repository Architecture

## Overview
Project Sesame is a Node.js web application designed to provide a hands-on environment for exploring identity and authentication features.

## Tech Stack

### Core
*   **Language**: **TypeScript** (Used across both client and server).
*   **Runtime**: **Node.js**.

### Backend (`src/server`)
*   **Framework**: **Express.js** handling routing and middleware.
*   **Identity Protocols**:
    *   **SimpleWebAuthn**: (`@simplewebauthn/server`) Used for server-side verification of WebAuthn/Passkey registration and authentication ceremonies.
    *   **FedCM**: Custom middleware implementation for Federation Credential Management API.
*   **Database**:
    *   **Google Cloud Firestore**: NoSQL document database used for storing user accounts and credentials.
    *   **firebase-admin**: SDK for server-side Firestore interaction.
*   **Session Management**:
    *   **express-session**: Session middleware.
    *   **@google-cloud/connect-firestore**: Persists sessions to Firestore.

### Frontend (`src/client`)
*   **Framework**: **Lit** (Google's lightweight library for building fast, reactive Web Components).
*   **Styling**: SCSS (Sass) for modular styling.
*   **Build System**: **Rsbuild** (Rspack-based) for extremely fast bundling and HMR.

### Infrastructure & Tools
*   **Hosting**: Google App Engine (Standard Environment).
*   **Local Development**:
    *   **Caddy**: Reverse proxy to simulate production-like routing (subdomains for RP/IdP) and HTTPS locally.
    *   **Firebase Emulator Suite**: Runs a local instance of Firestore for development without connecting to the live cloud.

## Core Concepts

### Dual Role Architecture
Uniquely, this single codebase is capable of running as two distinct entities depending on configuration:
1.  **Identity Provider (IdP)**: Simulates an entity that provides identity services.
2.  **Relying Party (RP)**: Simulates an application that consumes identity services.

This is achieved via environment-specific configuration files (e.g., `idp-localhost.config.json` vs `rp-localhost.config.json`) loaded at runtime by `src/server/config.ts`.

### Local Development Environment
The local setup mimics a real-world scenario using **Caddy** as a reverse proxy:
*   **`rp.localhost`** -> Proxies to the RP instance (default port 8080).
*   **`idp.localhost`** -> Proxies to the IdP instance (default port 8000).
*   **Firebase Emulator**: Used for local Firestore database emulation.

## Directory Structure

### `src/server` (Backend)
*   **`app.ts`**: The main entry point. Initializes Express, configures Handlebars for SSR, and mounts middlewares.
*   **`middlewares/`**: Contains core logic.
    *   **`session.ts`**: Handles user session state.
    *   **`pageAclCheck`**: format-agnostic middleware to enforce access control on UI routes.
    *   **Feature Middlewares**: `webauthn`, `fedcm`, `auth`, `federation` are mounted as sub-apps to handle specific flows.
*   **`config.ts`**: Loads environment variables and JSON config files to set up the app mode (IdP vs RP).

### `src/client` (Frontend)
*   **Build Tool**: Uses **Rsbuild**.
*   **`pages/`**: TypeScript files corresponding to specific server-rendered views, adding client-side interactivity using **Lit**.
*   **`helpers/`**: Shared client-side utilities.
*   **`styles/`**: SCSS/CSS global styles.

### `src/shared` (Common)
*   **`views/`**: Handlebars (`.html`) templates used by the server for SSR.
    *   **`layouts/`**: Main page shells (e.g., `index.html`).
    *   **`partials/`**: Reusable template components.

## Build & Deploy
*   **Build**:
    *   **Client**: Built with `rsbuild` (`npm run build:client`).
    *   **Server**: Bundled with `esbuild` (`npm run build:server`).
*   **Deploy**: Configured for Google App Engine (GAE) via `app.yaml` variants (`staging.yaml`, `idp.yaml`, `prod.yaml`).

## Rules

### General rules

* Don't forget to add Appache 2.0 license header at the top of the source code.

### Adding a new sign-in/sign-up page

When a new page is being added, the following steps are required:
1. Add HTML to `src/shared/views/`.
2. Add TypeScript to `src/client/pages/`.
3. Add server code to `src/server/app.ts`.
