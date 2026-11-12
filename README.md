# PRODTRACK

**ProdTrack** is an inventory, stock and billing system for small businesses. It has a Go backend backed by MongoDB Atlas and a React frontend.

## 🚀 Live Demo
-   **Frontend (Vercel):** (https://prodtrack-coral.vercel.app/)
-   **Backend API (Render):** (https://prodtrack-api-iyk3.onrender.com). It only serves the API, so opening this address shows "ProdTrack API is running"; use the Vercel link to open the app.

> The backend runs on Render's free plan, which sleeps when idle. The first request after a quiet period can take 30 to 60 seconds.

## ✨ Key Features
-   **Simple accounts**: owners sign up with name, business name, email and password; owners create staff logins.
-   **Secure auth**: JWT sessions and bcrypt-hashed passwords; staff lose access the moment they are removed.
-   **Products with SKU & warehouse**: instant search and filters (SKU, name, vendor, warehouse, category, stock status); SKUs are generated automatically when left blank.
-   **Billing**: point-of-sale screen (type or scan a SKU + Enter), PDF bills, stock deducted automatically.
-   **Log book (owners)**: everything added, sold, removed and changed on any day, with opening/closing stock per product, a timeline of who did what, CSV export and print.
-   **Safe with many users at once**: see *Concurrency* below.
-   **Dashboard, alerts and history**: revenue chart, best sellers, low-stock alerts, full history.
-   **Light / dark mode** switch (top bar) and a mobile-friendly layout.
-   **Custom branding**: a ProdTrack logo (hexagon with a checklist clipboard) used in the sidebar, login/signup, landing page, loading screen and browser tab.

## 🛠️ Technology Stack
-   **Backend**: Go, MongoDB (Atlas) with the official driver, JWT (`golang-jwt`), bcrypt.
-   **Frontend**: React 19 + Vite, React Router, plain CSS design system.
-   **Deployment**: Vercel (frontend) and Render (Go backend), or a single Go server serving both frontend and API.

## 🧰 Tools Used
-   **VS Code**: code editor used for development
-   **Claude** (Anthropic): AI assistant used for coding help, debugging and testing
-   **ChatGPT** (OpenAI): AI assistant used for coding help and explanations
-   **Git & GitHub**: version control and collaboration
-   **MongoDB Atlas**: cloud database

## 🔒 Concurrency
When several employees work on the same inventory at the same time:
-   **Stock** only changes through atomic increments; a removal only succeeds if enough stock is left, so stock never goes negative and no update is lost.
-   **Every stock change and its log entry** are written in one MongoDB transaction. A **bill** (all stock deductions, bill number, bill, log entries) is saved completely or not at all.
-   **Editing product details** uses optimistic locking (a version number). If someone else saved first, you see both versions side by side and choose which to keep, instead of silently overwriting their work.
-   Screens refresh in the background every 15 seconds, so everyone sees current stock.

## 💻 Local Development

### 1. Prerequisites
-   Go 1.26+
-   Node.js 20+
-   A MongoDB Atlas cluster (or a local MongoDB)

### 2. Configure
Copy `backend/.env.example` to `backend/.env` and fill in:
-   `MONGODB_URI` – your Atlas connection string (with the real user name and password)
-   `JWT_SECRET` – a long random value

`backend/.env` is git-ignored; never commit it.

### 3. Run
```powershell
npm install
npm run dev
```
-   Starting the frontend automatically builds and starts the Go backend, and stops it when you stop the frontend.
-   Open `http://localhost:5173`. Vite forwards `/api/*` to the Go server on port 8080, so no CORS setup is needed locally.

### Project Layout
```
prodtrack/
├── src/                React app (pages, components incl. Logo.jsx, hooks, lib)
├── public/             Static files (favicon.svg)
├── scripts/            Dev helpers (Go launcher, Vite backend plugin)
├── backend/            Go API server
│   ├── main.go         Server setup and routes
│   ├── config.go       Settings from backend/.env
│   ├── db.go           MongoDB models, indexes, transactions
│   ├── auth.go         JWT + bcrypt + auth middleware
│   ├── handlers.go     Auth, staff, bills list, analytics
│   ├── inventory.go    Products, stock, history, billing (concurrency-safe)
│   ├── logbook.go      Daily log book
│   └── main_test.go    Unit, end-to-end and concurrency tests
└── vite.config.js
```

### Scripts
-   `npm run dev` – frontend + backend for development
-   `npm start` – build the frontend and serve everything from the Go server at `http://localhost:8080`
-   `npm run test:backend` – Go tests (set `MONGODB_TEST_URI` to also run the database, end-to-end and concurrency tests; they use a temporary database that is deleted afterwards)
-   `npm run dev:backend` – backend only
-   `npm run lint` / `npm run build`

## 🌐 Deployment
-   **Render (Go backend)**: create a *Web Service* from this repository with **Language** `Go`, **Root Directory** `backend`, **Build Command** `go build -o app .` and **Start Command** `./app`. Set these environment variables: `MONGODB_URI`, `MONGODB_DB=prodtrack`, `JWT_SECRET`, `CORS_ORIGIN=https://<your-vercel-app>` (no trailing slash) and, if the build needs it, `GO_VERSION=1.26.0`. Render sets `PORT` itself. In Atlas Network Access, allow `0.0.0.0/0` because Render's IP addresses can change.
-   **Vercel (frontend)**: set `VITE_API_URL=https://<your-render-app>.onrender.com/api` (Project Settings → Environment Variables) and **redeploy**, because Vite reads it at build time. Leave **Settings → Build and Deployment → Root Directory** empty, because the React app lives in the repository root (there is no `frontend/` folder). Framework preset **Vite**, build command `npm run build`, output directory `dist`.

> **Troubleshooting:**
> -   The login page says *"Can't reach the server. Check that the backend is running"*: the frontend has no backend to call. Check that the Render service is running and that `VITE_API_URL` is set on Vercel (then redeploy). Locally, it usually means MongoDB Atlas is refusing your IP: see *Atlas "tls: internal error"* below.
> -   **Atlas "tls: internal error" / backend stops at start-up:** Atlas Network Access doesn't allow your current IP address (it changes when you switch Wi-Fi or hotspot). Add it under Atlas → Network Access, or allow `0.0.0.0/0`, wait until it shows *Active*, then restart `npm run dev`.
> -   A Vercel build that fails within about a second with *"The specified Root Directory 'frontend' does not exist"* means Vercel still points at the old folder layout. Clear the Root Directory setting and redeploy.

## 🗄️ Moving to a New MongoDB Database
The database was moved from a personal Atlas account to a new cluster created under the project's own account, keeping all data.

1.  **Install the tools** (PowerShell): `winget install MongoDB.DatabaseTools` and `winget install MongoDB.Shell`. If `mongodump` is not recognised afterwards, add the tools folder (for example `C:\Program Files\MongoDB\Tools\100\bin`) to your PATH and restart VS Code.
2.  **Create the new cluster** in Atlas: add a database user (read and write to any database), allow your IP in Network Access, and copy the connection string.
3.  **Stop the app**, then back up the old database (the connection string comes from `backend/.env`):
    ```powershell
    mongodump --uri $OLD --db prodtrack --out .\mongo-backup
    ```
4.  **Restore into the new cluster**:
    ```powershell
    mongorestore --uri $NEW --nsInclude "prodtrack.*" .\mongo-backup
    ```
    Add `--drop` to replace collections that already exist in the new database.
5.  **Verify**: compare document counts per collection in the old and new databases. Copy the `counters` collection too, or bill numbers and auto-generated SKUs would restart from 1.
6.  **Switch**: set `MONGODB_URI` in `backend/.env` to the new connection string, keep `JWT_SECRET` unchanged so users stay logged in, then run `npm run dev`.

The old database is never modified, so switching back only means restoring the old `MONGODB_URI`. `mongo-backup/` is git-ignored because it contains password hashes and business data; delete it once everything works.

## 📝 Project Timeline: What Has Been Done
-   **Foundation**: frontend moved to the project root with the Go backend in `backend/`; `.env` configuration; compiled files removed from the repo.
-   **Database and auth**: MongoDB Atlas connection; JWT login with bcrypt-hashed passwords; simple signup and staff accounts.
-   **Core APIs**: products, stock, billing and the daily log book, all using MongoDB transactions for concurrency safety; automated tests including concurrent-update tests.
-   **Frontend redesign**: new UI and shared components, API client with JWT and toast messages, dashboard layout, sidebar and top bar, light/dark mode, redesigned login, signup and landing pages.
-   **Inventory features**: SKU and warehouse search and filters, an owner-only log book page, updated billing, stock and history pages.
-   **Developer experience**: `npm run dev` starts the Go backend automatically; README updated with tools used.
-   **Database migration**: moved all data to a new Atlas cluster (see the section above).
-   **Deployment fix**: corrected the Vercel Root Directory so frontend builds succeed after the project restructure.
-   **Backend hosting**: deployed the Go backend as a new Render web service and pointed the Vercel frontend at it with `VITE_API_URL`; opened Atlas Network Access (`0.0.0.0/0`) so the hosted backend and local development can connect.
-   **UI polish**: new ProdTrack logo and favicon (the name is shown beside the logo), and the feedback form and the Appearance card were removed from the Profile page (the theme toggle stays in the top bar).

---

## 👥 Contributors
Developed by MCA Students:
-   **DINU** ([@D1778](https://github.com/D1778))
-   **KUNNAL** ([@krkunal404](https://github.com/krkunal404))

---

## 📜 Assignment Context
This project was developed as part of the MCA syllabus, focusing on:
-   Go Concurrency (goroutines & channels in analytics, safe concurrent updates with MongoDB transactions)
-   JSON and BSON marshalling
-   Bcrypt password hashing and JWT authentication
-   RESTful API design
