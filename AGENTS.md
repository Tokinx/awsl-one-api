# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Cloudflare Workers backend (Hono + chanfana). Key areas:
  - `src/providers/`: provider proxies (OpenAI, Azure OpenAI, Claude, Responses).
  - `src/admin/`: admin APIs (channels, tokens, pricing, DB init).
  - `src/db/`: D1 schema/init helpers.
- `public/`: built admin UI assets served by Workers.
- `frontend/`: React/Vite admin UI source (build outputs to `public/`).
- `wrangler.jsonc`: production/deploy Wrangler config.
- `wrangler.local.jsonc`: local Worker-first development config.
- `type.d.ts`: shared types for bindings and data models.

## Build, Test, and Development Commands
- `bun run build`: Type-checks and builds the admin UI into `public/`.
- `bun run --filter frontend build`: Builds only the admin UI from the frontend workspace.
- `bun run dev`: Starts the Vite frontend and Worker locally for integrated development.
- `bun run dev:worker`: Runs only the Worker locally via `wrangler dev --config wrangler.local.jsonc`.
- `bun run deploy`: Deploys the Worker to Cloudflare.
- `bun run cf-typegen`: Generates Cloudflare bindings/types.

## Coding Style & Naming Conventions
- TypeScript throughout; follow existing patterns and file layout.
- Indentation: 4 spaces in backend files, 2 spaces in frontend TSX (match existing).
- API routes: `src/admin/*_api.ts`, provider files in `src/providers/`.
- Channel types: use string literals (e.g., `openai-responses`, `azure-openai-responses`).

## Testing & Lint
- No dedicated test framework is currently configured.
- Use `bun run build` (runs frontend TypeScript check + Vite build) as basic safety check for UI changes.
- For backend changes, run `bun run dev` or `bun run dev:worker` and validate with the API Test page.
- Frontend lint: `cd frontend && bun run lint` (ESLint with react-hooks and react-refresh rules).

## Commit & Pull Request Guidelines
- No formal commit conventions are documented in-repo; use clear, imperative messages (e.g., "Add responses proxy").
- PRs should include:
  - Summary of changes.
  - Notes on config changes (`wrangler.jsonc`, `wrangler.local.jsonc`, env vars).
  - Screenshots for UI changes (from `frontend/`).

## Security & Configuration Tips
- Admin endpoints require `x-admin-token` (`ADMIN_TOKEN` binding).
- Tokens and channel configs are stored in D1; validate permissions and quotas.
- For Azure Responses v1, leave `api_version` empty and set `endpoint` to the resource host.
