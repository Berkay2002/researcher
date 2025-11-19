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
