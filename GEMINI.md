# Project Context: Deep Research Agent

## Project Overview
This project is a **Next.js application** that implements an autonomous **"Deep Research" agent** using **LangGraph**. The agent is designed to perform iterative, multi-step research tasks, similar to OpenAI's Deep Research. It moves away from simple parallel search to a sequential, reasoning-heavy approach (Reasoning → Search → Analysis → Repeat).

## Tech Stack

*   **Framework:** Next.js 15 (App Router)
*   **Language:** TypeScript
*   **Agent Framework:** LangGraph, LangChain
*   **AI Models:** Google GenAI (Gemini), likely others supported via LangChain.
*   **Search Tool:** Tavily (for web search).
*   **Styling:** Tailwind CSS v4, Radix UI, Framer Motion.
*   **Linting/Formatting:** Biome, Ultracite.
*   **Database/Persistence:** LangGraph Checkpoint (Postgres supported but likely in-memory or local for dev).

## Key Directories

*   **`src/server/workflows/deep-research/`**: Contains the core logic for the research agent.
    *   `graph/`: Defines the LangGraph state machine (nodes, edges, state).
    *   `graph/subgraphs/`: Modular sub-workflows (e.g., iterative research steps).
*   **`src/app/`**: Next.js App Router pages.
    *   `page.tsx`: Main entry point rendering the chat interface (`Thread` component).
*   **`src/components/thread/`**: UI components for the chat interface, message rendering, and artifact display.
*   **`docs/`**: Extensive documentation on the agent's architecture, specifically the "iterative research" pattern.
*   **`langgraph.json`**: Configuration file for the LangGraph CLI.

## Building and Running

### Development
*   **Start Next.js App:** `npm run dev` (Runs on http://localhost:3000)
*   **Start LangGraph Studio:** `npm run dev:langgraph` (For visualizing and debugging the graph)
*   **Start Both:** `npm run dev:all` (Recommended for full stack dev)

### Production
*   **Build:** `npm run build`
*   **Start:** `npm run start`

### Code Quality
*   **Lint:** `npm run lint` (Runs Biome)
*   **Format:** `npm run format` (Runs Biome format)

## Architecture: Iterative Research
The agent follows a specific "Iterative Research" pattern detailed in `docs/workflow-iterative-research-summary.md`.
1.  **Goal:** Receive user query.
2.  **Iterative Loop (3 Rounds):**
    *   **Reasoning:** Analyze current knowledge, identify gaps, generate queries.
    *   **Search:** Execute queries (Tavily/Exa), read sources.
    *   **Analysis:** Synthesize findings from the round.
3.  **Synthesis:** Compile all findings into a final comprehensive report.

## Development Conventions
*   **Strict TypeScript:** All code should be strongly typed.
*   **Biome:** Used for linting and formatting. Follows strict rules.
*   **LangGraph Patterns:** Logic is encapsulated in "Nodes" (functions receiving state) and connected via "Edges". State is defined in `state.ts` files using Zod schemas.
*   **Environment Variables:** Managed via `.env.local`. Keys for AI providers (Google, Tavily, etc.) must be set.

## Research Output
The project seems capable of generating structured reports, potentially in LaTeX format (`article.tex` exists in root), or at least structured Markdown that can be converted.


# Ultracite Code Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `npx ultracite fix`
- **Check for issues**: `npx ultracite check`
- **Diagnose setup**: `npx ultracite doctor`

Biome (the underlying engine) provides extremely fast Rust-based linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `npx ultracite fix` before committing to ensure compliance.
