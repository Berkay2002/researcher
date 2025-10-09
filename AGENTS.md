# Repository Guidelines

## Build, Test, and Development Commands

Use `npm run dev` to start the Next.js dashboard with hot reload. Run `npm run build` to produce the optimized bundle and catch type or accessibility issues. Execute `npm run start` for production smoke tests. Keep linting clean with `npm run lint`, and format consistently via `npm run format` followed by `npx ultracite check` when you need stricter diagnostics.

## Coding Style & Naming Conventions

Biome enforces two-space indentation, arrow functions, and `for...of` loops. Follow kebab-case filenames and PascalCase React components as noted in `naming-conventions.md`. Prefer inferred types or `as const` rather than redundant annotations, and keep UI wrappers local instead of editing `src/components/ui` directly.

## Commit & Pull Request Guidelines

Write imperative commit subjects, optionally prefixed with Conventional Commit tags such as `feat:` or `fix:`. Ensure pull requests link tracking issues, document manual test commands, and include UI captures for visual tweaks. Keep the diff focused and lint-clean before review, and rebase or squash before merging.

## Security & Configuration Tips

Copy `.env.example` to `.env.local` and fill provider keys without committing them. Rotate secrets through your vault and load them via typed helpers in `src/server/configs`. Avoid touching credentials in code, and prefer environment-based configuration for all external services.

## Langgraph and Langchain documentation

Read `documentation/langgraph` and `documentation/langchain` for official documentation. You must read internally instead of searching when it comes to langchain and langgraph related tasks and assignments. If you cannot find the answer in the documentations folder, read into `node_modules/langchain/dist` or `node_modules/@langchain/...` folder to find your answers. As a final resort, use web search!
