# Repository Guidelines
## Project Structure & Module Organization
- `src/app` hosts the Next.js App Router; colocate route-specific loaders and actions inside each route folder, e.g. `src/app/research/[threadId]/page.tsx`.
- UI primitives are generated in `src/components/ui`; compose wrappers next to their feature entry points instead of editing the source files directly.
- LangGraph orchestration sits in `src/server`; `graph` defines parent and subgraphs, `services` wraps external APIs, and `store` coordinates persistence for runs with memory.
- Shared hooks and utilities live in `src/lib`, static assets in `public`, developer scripts in `scripts`, and contract tests in `tests`.

## Build, Test, and Development Commands
- `npm run dev` – start the Next.js dev server with hot reload for the dashboard and research views.
- `npm run build` – create an optimized production bundle; catches type and accessibility regressions.
- `npm run start` – serve the production bundle for smoke tests before deployment or demos.
- `npm run lint` – run Biome plus Ultracite checks; required before opening a pull request.
- `npm run format` – apply Biome formatting; pair with `npx ultracite check` when you need stricter diagnostics.

## Coding Style & Naming Conventions
- Biome enforces two-space indentation, arrow functions, and `for...of`; review `biome.json` before adjusting tooling defaults.
- Follow kebab-case filenames and PascalCase component names as described in `naming-conventions.md`; prefer inferred types or `as const` over redundant annotations.
- Uphold Ultracite accessibility rules: provide keyboard fallbacks for pointer handlers, include `type="button"` on buttons, and avoid manual roles on semantic elements.

## Testing Guidelines
- Author Vitest suites in `tests` with the `*.spec.ts` suffix mirroring the feature path (`research.spec.ts`, etc.).
- Run `npx vitest run --coverage` locally; aim for coverage on planner, research, factcheck, and writer nodes.
- Mock external providers and graph I/O to keep suites deterministic; never depend on live APIs or network state.

## Commit & Pull Request Guidelines
- Mirror the existing history: imperative subject lines with optional Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`).
- Keep requests focused, lint-clean, and linked to tracking issues; document manual test commands and include UI captures for visual updates.
- Rebase or squash noisy commits before review so the main branch stays concise.

## Environment & Security
- Copy `.env.example` to `.env.local` and supply provider keys (OpenAI, LangChain, etc.); never commit `.env` files or credentials.
- Rotate secrets through your vault and access them via typed helpers in `src/server/configs`.
