# jdm-electron-flask-frontend

React + Vite frontend template for [jdm-electron-flask-template](https://github.com/JDM-Github/jdm-electron-flask-frontend) desktop apps.

## Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Flask-SocketIO client

## Structure

```
frontend/
├── src/
│   ├── layout/        # Header, sidebar, footer
│   ├── lib/
│   │   ├── context/   # SocketIO context
│   │   └── utilities/ # Request + socket handlers
│   ├── routes/        # Page components
│   └── App.tsx
└── vite.config.ts
```

## Setup

```bash
npm install
npm run dev
```

Proxies `/api` requests to `http://localhost:XXXXX` in dev mode.

## Building

```bash
run compile --frontend
```

Builds to `frontend/dist/`, copies to `backend/static` and `electron/test`, then cleans up.

## Utilities

**Request handler** — thin wrapper around fetch for API calls:
```typescript
import { get, post } from "../lib/utilities/request_handler";

const data = await get("/api/health");
```

**Socket handler** — SocketIO event helpers:
```typescript
import { on, emit } from "../lib/utilities/socket_handler";

emit("run_command", { namespace, command });
on("run_line", (data) => console.log(data.text));
```
