# SkillForge — Freelance Marketplace (Server)

Express + MongoDB REST API powering the SkillForge client. Stateless, deployed
to Vercel as a serverless Node function.

- **Live API:** https://skillforge-api.vercel.app
- **Client:** ../freelancer-marketplace

## Highlights

- REST endpoints for jobs (`/jobs`), accepted tasks (`/accepted-tasks`), and
  category aggregations (`/categories/stats`).
- Filtering, sorting, and free-text search on `GET /jobs` via query string.
- Server-side guard: a user cannot accept their own posted job.
- CORS allow-list via `CLIENT_ORIGINS` env var — no wildcards in production.
- Lazy connection + indexes (`userEmail`, `postedAt`, `workerEmail`) for fast
  cold-start performance on serverless.

## Getting started

```bash
npm install
cp .env.example .env
# fill MONGODB_URI, DB_NAME, CLIENT_ORIGINS
npm start
```

API listens on `PORT` (default `5000`).

## Environment variables

```
PORT=5000
MONGODB_URI=mongodb+srv://...
DB_NAME=freelanceMarketplace
CLIENT_ORIGINS=http://localhost:5173,https://your-client.netlify.app
```

## Endpoints

```
GET    /                          health / endpoint list
GET    /jobs?sort&category&search list jobs
GET    /jobs/latest               6 most recent jobs
GET    /jobs/:id                  single job
POST   /jobs                      create
PATCH  /jobs/:id                  update (title, category, summary, coverImage)
DELETE /jobs/:id                  delete (+ cascades accepted-tasks)
GET    /jobs/mine/:email          jobs posted by a user

POST   /accepted-tasks            { jobId, workerEmail, workerName }
GET    /accepted-tasks/:email     tasks accepted by a user
DELETE /accepted-tasks/:id        remove an accepted task (Done / Cancel)

GET    /categories/stats          aggregate count per category
```

## Deploy to Vercel

```bash
vercel --prod
```

`vercel.json` already routes every request to `index.js`. Set the same env vars
in the Vercel project dashboard.
