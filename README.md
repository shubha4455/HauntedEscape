# Haunted Escape

Haunted Escape is a first-person, 3D horror escape-room game that runs in the browser. Explore a haunted mansion, solve environmental clues, evade the devil, and escape before time or health runs out. The project includes an optional account API for saving escape records across devices.

## Features

- Three explorable rooms: the Portrait Gallery, Forbidden Library, and Abandoned Chapel.
- Puzzle exploration with clues, inventory items, hiding places, and a final locked exit.
- A devil that patrols, investigates, chases, attacks, and searches the room.
- First-person 3D graphics, atmospheric lighting, sound effects, and ambient audio.
- A four-minute countdown, three lives, and a local best-time record.
- Optional accounts for cloud escape records and account best times.
- Responsive touch controls for mobile devices.

## How to play

Find the clues and items hidden around the mansion, use hiding places to avoid the devil, and unlock the exit when you have what you need. Interactions and room changes can increase the devil's threat. Your local best time is stored in this browser; sign in to save escapes to your account.

| Action | Keyboard / mouse |
| --- | --- |
| Look around | Click the scene, then move the mouse |
| Move | `W`, `A`, `S`, `D` or arrow keys |
| Interact | `E` or click the on-screen prompt |
| Open / close inventory | `I` |
| Use matches | `F` |
| Enable or mute horror audio | Click the sound button |

On touch devices, use the on-screen movement pad and drag the scene to look around.

## Project structure

```text
.
├── .github/workflows/deploy.yml  # GitHub Pages frontend deployment
├── backend/
│   ├── server.js                 # Express account API
│   ├── tests/                    # API integration tests
│   └── package.json
├── frontend/
│   ├── src/game/                 # Mansion, rooms, player, and devil
│   ├── src/lib/accountApi.js     # Frontend API client
│   └── package.json
├── compose.yaml                  # Local Docker Compose setup
├── render.yaml                   # Render API deployment blueprint
└── README.md
```

## Requirements

- Node.js 20 or newer and npm.
- Docker Desktop with Docker Compose, if using the container setup.

## Run locally

### Start the game

In PowerShell:

```powershell
Set-Location 'D:\HauntedEscape\frontend'
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The game and local best time work without the account API.

### Enable accounts and cloud saves

In a second terminal, configure and start the backend:

```powershell
Set-Location 'D:\HauntedEscape\backend'
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `backend\.env` and set `JWT_SECRET` to a private, random value at least 32 characters long. Keep the sample local `ALLOWED_ORIGINS` values if using the default Vite URL. Then start the API:

```powershell
npm run dev
```

The API listens on `http://localhost:3001` by default, and the development frontend uses `http://localhost:3001/api`. The API creates its SQLite database at `backend/data/haunted-escape.sqlite` by default. Do not commit `.env` files or database data.

## Account API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/account` | Get the signed-in account |
| `POST` | `/api/account/escapes` | Save an escape record |

Registration requires a valid email, a display name of 2–24 characters, and a password of 10–128 characters. Escape records include remaining time; the API maintains each account's best time and escape count.

The API hashes passwords with bcrypt, issues seven-day JWTs, rate-limits authentication attempts, restricts browser origins with CORS, and uses Helmet security headers. `JWT_SECRET` is required. Optional backend environment variables are documented in `backend/.env.example`:

- `PORT` — API port (default `3001`).
- `JWT_SECRET` — private signing secret, at least 32 characters.
- `ALLOWED_ORIGINS` — comma-separated list of allowed website origins.
- `DB_PATH` — SQLite database path.

For production, keep the JWT secret private and use persistent storage for the SQLite database.

## Run with Docker Compose

From `D:\HauntedEscape`, create the root `.env` from the Docker example if it does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.docker.example .env }
```

Set a private `JWT_SECRET` of at least 32 characters in `.env`, then run:

```powershell
docker compose up --build -d
docker compose ps
```

Open **http://localhost:8080**. Compose starts the frontend and API, routes `/api` requests to the backend, and persists account data in a named volume.

Stop the containers while preserving account data:

```powershell
docker compose down
```

To also permanently delete the database volume and account data:

```powershell
docker compose down -v
```

## Deploy

The frontend and backend deploy separately:

1. Deploy the root `render.yaml` as a Render Blueprint. Set `ALLOWED_ORIGINS` to the exact origin of the GitHub Pages site (for example, `https://your-name.github.io`). Keep Render's generated `JWT_SECRET` private and retain the configured persistent disk.
2. In GitHub, open **Settings → Secrets and variables → Actions → Variables** and add `VITE_API_URL` with the deployed API URL ending in `/api` (for example, `https://haunted-escape-api.onrender.com/api`).
3. Set GitHub Pages to **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` builds `frontend/` and deploys it to Pages on pushes to `main`; it can also be started manually.

The frontend can be deployed without an API, but account sign-in and cloud saves require `VITE_API_URL` and a running backend. `.env` files, JWT secrets, and database files should never be committed.

## Checks

Run the frontend lint and production build:

```powershell
Set-Location 'D:\HauntedEscape\frontend'
npm run lint
npm run build
```

Run the backend API tests:

```powershell
Set-Location 'D:\HauntedEscape\backend'
npm test
```
