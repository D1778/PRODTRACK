# PRODTRACK

**ProdTrack** is an inventory, stock and billing system for small businesses. It has a Go backend backed by MongoDB Atlas and a React frontend.

## 🚀 Live Demo
-   **Frontend (Vercel):** (https://prodtrack-coral.vercel.app/)
-   **Backend (Render):** (https://prodtrack-ni1v.onrender.com)

> The live demo runs the previous version until it is redeployed (see *Deployment* below).

## ✨ Key Features
-   **Simple accounts**: owners sign up with name, business name, email and password; owners create staff logins.
-   **Secure auth**: JWT sessions and bcrypt-hashed passwords; staff lose access the moment they are removed.
-   **Products with SKU & warehouse**: instant search and filters (SKU, name, vendor, warehouse, category, stock status); SKUs are generated automatically when left blank.
-   **Billing**: point-of-sale screen (type or scan a SKU + Enter), PDF bills, stock deducted automatically.
-   **Log book (owners)**: everything added, sold, removed and changed on any day, with opening/closing stock per product, a timeline of who did what, CSV export and print.
-   **Safe with many users at once**: see *Concurrency* below.
-   **Dashboard, alerts and history**: revenue chart, best sellers, low-stock alerts, full history.
-   **Light / dark mode** switch and a mobile-friendly layout.

## 🛠️ Technology Stack
-   **Backend**: Go, MongoDB (Atlas) with the official driver, JWT (`golang-jwt`), bcrypt.
-   **Frontend**: React 19 + Vite, React Router, plain CSS design system.
-   **Deployment**: Render (backend) & Vercel (frontend), or a single Go server serving both.

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
├── src/                React app (pages, components, hooks, lib)
├── public/             Static files
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
-   **Render (backend)**: set `MONGODB_URI`, `JWT_SECRET` and `CORS_ORIGIN=https://<your-vercel-app>`; allow Render's IPs (or `0.0.0.0/0`) in Atlas Network Access.
-   **Vercel (frontend)**: set `VITE_API_URL=https://<your-render-app>/api`.

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
