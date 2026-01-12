# Solar Sentinel — Learn

Solar Sentinel is a full-stack demo for ML-powered solar panel monitoring and anomaly detection. It includes:

- A TypeScript + React frontend (Vite, Tailwind CSS, shadcn-ui)
- A Python FastAPI backend with ML modules for training and inference
- WebSocket support for realtime inference/alerts
- Optional Supabase integration for auth, storage and migrations

This repository is intended as a learning and demo workspace for building an integrated ML web app.

## Tech stack

- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn-ui
- Backend: Python, FastAPI, Uvicorn
- ML: modules in `backend/app/ml/` (trainer, inference, mistake detector)
- Database / Auth / Storage (optional): Supabase

## Quick start (macOS / zsh)

1) Clone the repo

```zsh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_FOLDER>
```

2) Frontend (install & run)

```zsh
# from project root
npm install
npm run dev
```

The dev server will start (Vite). Open the printed URL (usually http://localhost:5173).

3) Backend (Python FastAPI)

Requirements are listed in `backend/requirements.txt`.

```zsh
# create and activate a virtual environment
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# start FastAPI (reload enabled for development)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at http://localhost:8000 and the OpenAPI docs at http://localhost:8000/docs.

## Environment variables

Create environment files for local development as needed.

Frontend (example `.env.local` at project root):

```text
VITE_SUPABASE_URL=https://your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

Backend (example `backend/.env`):

```text
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
SUPABASE_URL=https://your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

If you are not using Supabase, the app will still run — parts that rely on Supabase will be inactive.

## Supabase & migrations

If you use Supabase, apply migrations from the `supabase/` folder or run your Supabase CLI workflow. The repository also contains SQL migration files in `supabase/migrations/`.

## Development notes

- Frontend code is in `src/`.
- Backend FastAPI app is in `backend/app/`.
- ML scripts and logic are in `backend/app/ml/` (trainer, inference, mistake_detector).
- Realtime events: `backend/app/websocket_manager.py` is used to broadcast inference and alert updates to connected clients.

## Building & deployment

- For production build of the frontend: `npm run build` (see `package.json` scripts).
- Backend can be deployed with any ASGI host (Uvicorn/Gunicorn) or containerized.
- This project contains a `vercel.json` and is compatible with Vercel deployments for the frontend; adapt backend deployment separately (serverless functions or separate hosting).

## Contributing

- Create a branch for your feature or bugfix.
- Open a pull request with a clear description of changes.

## Further help

If you need help understanding specific parts of the stack, inspect the folders listed above and open issues or PRs with questions.

## License

Check the repository root for license information or add one if needed.
