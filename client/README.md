# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## Authentication

The frontend uses the existing FastAPI HTTP-only cookie sessions. `/sign-up`
creates an account and takes the user to `/sign-in`. Successful sign-in returns
to the requested workspace route. `/home`, `/settings`, and `/stocks/:symbol`
require a session. Settings displays the signed-in email; the header provides
sign-out. Passwords must contain 15–128 characters, matching backend validation.

### Run locally (WSL/Linux)

1. If `api/.env` does not exist, copy `api/.env.example` to `api/.env` and choose
   your local database password. Keep your existing database credentials if the
   database is already initialized. Local HTTP requires `AUTH_COOKIE_SECURE=false`.
2. From the repository root, start PostgreSQL:

   ```bash
   docker compose up -d db
   ```

3. Start the API in one terminal:

   ```bash
   cd api
   uv sync
   uv run alembic upgrade head
   uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

4. Start the frontend in another terminal:

   ```bash
   cd client
   npm ci
   npm run dev
   ```

Open http://localhost:5173/sign-up. Use `localhost` consistently in the browser;
`127.0.0.1` is a different origin and is not in the default browser allowlist.
The Vite proxy forwards `/api/*` to FastAPI on port 8000, removing `/api` and
preserving the browser's Origin header. The development port is fixed at 5173
to match `AUTH_ALLOWED_ORIGINS`.

### API integration and deployment

`src/lib/api.ts` exports `apiRequest<T>()` for future backend requests. It includes
cookies, disables response caching, times out after 15 seconds, and invalidates
the frontend session on HTTP 401. The auth provider checks `/auth/me` on startup
and when the browser tab regains focus. Sessions remain enforced by FastAPI;
new private API endpoints must use its `CurrentUser` dependency.

The forms call `POST /auth/register`, `POST /auth/login`, and `POST /auth/logout`.
Registration returns a user but does not create a session; login sets the cookie.
Session tokens are never stored in localStorage or exposed to JavaScript.

For production, serve the frontend and API under HTTPS and set
`AUTH_COOKIE_SECURE=true` and `AUTH_ALLOWED_ORIGINS` to the exact frontend origin.
Configure your web server to proxy `/api/*` to FastAPI with the `/api` prefix
removed, and to serve `index.html` for frontend routes. Vite's development proxy
is not part of the production build.

Alternatively, set `VITE_API_URL` in `client/.env.local` to a same-site API URL
before building, and configure its allowed origin. The backend currently uses
`SameSite=Lax`; an API on an unrelated site requires a different cookie/CSRF
configuration. Do not put credentials in any `VITE_*` variable.

### Verify

With Node 24 and `uv sync` completed in `api`, run:

```bash
cd client
npm run build
npm run lint
npx playwright install --with-deps chromium
npm test
```

Browser tests start their own frontend on port 5174 and FastAPI on port 8001.
They use an in-memory SQLite database, never the development PostgreSQL database.
The test runner currently uses WSL/Linux shell commands. Coverage includes
registration, duplicate accounts, invalid credentials, protected route redirects,
reload persistence, cookie flags, mobile forms, session revocation, and network
failure recovery. PostgreSQL-specific migration behavior is not covered by these tests.

Run the backend session/security checks separately:

```bash
cd api
uv run python -m unittest discover -s tests -p 'test_*.py'
```

The existing backend does not yet include email verification, password reset,
or login rate limiting.

## Editorial design

The interface uses a fixed 185px drafting grid, Instrument Serif, Reenie Beanie,
and one emerald accent (`#008563`). The Google Fonts are bundled locally through
Fontsource, so rendering does not depend on a request to Google at page load.
Design tokens and responsive rules live in `src/site.css`; change
`--site-accent` there to use navy (`#1B2A4A`) or oxblood (`#6B1E1E`).

The landing page includes layered transparent cutouts, decorative coordinate
notes, a north/south scroll indicator, and Three Lenses.
The Subscribe link opens the existing free account registration page; no mailing
list integration has been added. English is currently the only language.

The hero globe uses the original artwork; the three supporting illustrations
use the minimal set. Both have editable SVG sources. The original
editorial illustrations are preserved in `public/images/archive/editorial-v1/`;
set `illustrationStyle` to `"original"` in `src/lib/illustrations.ts` to restore them. See the
[image replacement checklist](public/images/README.md) for every filename,
suggested dimensions, transparency requirements, and art direction.

Motion uses transform/opacity animations and frame-throttled scroll updates.
`prefers-reduced-motion` disables entrances and parallax. Navigation
supports keyboard focus, a mobile menu with Escape-to-close, and links into
individual sections from any route. Authentication and workspace pages use the
same type, paper, grid, and monochrome controls.
