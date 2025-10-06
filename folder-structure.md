# Project Folder Structure

This document outlines the complete folder structure of the researcher project, organized by function and purpose.

## Root Directory

```
researcher/
├── .gitignore                   # Git ignore file
├── .mcp.json                    # MCP configuration
├── AGENTS.md                    # Agent guidelines and rules
├── biome.json                   # Biome formatter and linter configuration
├── brief.md                     # Project brief
├── CLAUDE.md                    # Claude-specific documentation
├── components.json              # Shadcn/ui components configuration
├── handoff.md                   # Project handoff documentation
├── implementation-plan.md       # Implementation plan
├── local-server-langgraph.md    # Local LangGraph server setup
├── naming-conventions.md        # Naming conventions guide
├── next.config.ts               # Next.js configuration
├── package-lock.json            # NPM lock file
├── package.json                 # NPM package configuration
├── plan.md                      # Project plan
├── postcss.config.mjs           # PostCSS configuration
├── README.md                    # Project README
├── folder-structure.md          # This file
```

## Configuration Directories

```
├── .claude/                     # Claude-specific configuration
├── .github/                     # GitHub configuration
├── .kilocode/                   # KiloCode configuration
│   └── rules/                   # KiloCode rules
│       └── ultracite.md         # Ultracite coding standards
└── .vscode/                     # VSCode configuration
```

## Documentation

```
├── documentation/               # Project documentation
│   └── langgraph/              # LangGraph documentation
│       ├── 01-introduction-quickstart.md
│       ├── 02-agents.md
│       ├── 03-models.md
│       ├── 04-messages.md
│       ├── 05-tools.md
│       ├── 06-short-term-memory.md
│       ├── 07-human-in-the-loop.md
│       ├── 08-long-term-memory.md
│       ├── 09-streaming.md
│       ├── 10-context-engineering.md
│       ├── 11-multi-agent-systems.md
│       ├── 12-structured-output.md
│       ├── 13-runtime.md
│       └── 14-middleware.md
```

## Public Assets

```
├── public/                      # Static assets
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
```

## Development Scripts

```
├── scripts/                     # Development and utility scripts
│   ├── devServer.ts            # Development server setup
│   └── seedExamples.ts         # Example data seeding
```

## Source Code

```
├── src/                         # Main source code directory
│   ├── app/                    # Next.js App Router
│   │   ├── (components)/       # Shared app components
│   │   │   ├── app-shell.tsx
│   │   │   ├── ArtifactsPane.tsx
│   │   │   ├── CheckpointTimeline.tsx
│   │   │   ├── inline-citation-number.tsx
│   │   │   ├── InterruptPrompt.tsx
│   │   │   ├── ModeSwitch.tsx
│   │   │   ├── PlanOptions.tsx
│   │   │   ├── report-sources-button.tsx
│   │   │   ├── research-input.tsx
│   │   │   ├── research-message.tsx
│   │   │   ├── research-report-card.tsx
│   │   │   ├── research-status-bar.tsx
│   │   │   ├── run-log.tsx
│   │   │   ├── source-card.tsx
│   │   │   ├── sources-panel.tsx
│   │   │   ├── thread-card.tsx
│   │   │   └── thread-list.tsx
│   │   ├── (dashboard)/        # Dashboard routes
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── actions/            # Server actions
│   │   │   └── threads.ts
│   │   ├── api/                # API routes
│   │   │   ├── stream/
│   │   │   │   └── [threadId]/
│   │   │   │       └── route.ts
│   │   │   └── threads/
│   │   │       ├── [threadId]/
│   │   │       │   └── state/
│   │   │       │       ├── mode/
│   │   │       │       │   └── route.ts
│   │   │       │       ├── resume/
│   │   │       │       │   └── route.ts
│   │   │       │       └── state/
│   │   │       │           └── route.ts
│   │   │       └── start/
│   │   │           └── route.ts
│   │   ├── research/           # Research routes
│   │   │   ├── [threadId]/
│   │   │   │   └── page.tsx
│   │   │   └── new/
│   │   │       ├── page.tsx
│   │   │       └── page.tsx.bak
│   │   ├── favicon.ico
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/             # Reusable components
│   │   ├── ai-elements/        # AI-related UI elements
│   │   │   ├── actions.tsx
│   │   │   ├── artifact.tsx
│   │   │   ├── branch.tsx
│   │   │   ├── chain-of-thought.tsx
│   │   │   ├── code-block.tsx
│   │   │   ├── context.tsx
│   │   │   ├── conversation.tsx
│   │   │   ├── image.tsx
│   │   │   ├── inline-citation.tsx
│   │   │   ├── loader.tsx
│   │   │   ├── message.tsx
│   │   │   ├── open-in-chat.tsx
│   │   │   ├── prompt-input.tsx
│   │   │   ├── reasoning.tsx
│   │   │   ├── response.tsx
│   │   │   ├── sources.tsx
│   │   │   ├── suggestion.tsx
│   │   │   ├── task.tsx
│   │   │   ├── tool.tsx
│   │   │   └── web-preview.tsx
│   │   ├── motion-primitives/  # Animation components
│   │   │   ├── disclosure.tsx
│   │   │   ├── morphing-dialog.tsx
│   │   │   ├── morphing-popover.tsx
│   │   │   └── useClickOutside.tsx
│   │   └── ui/                 # Base UI components (shadcn/ui)
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button-group.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── empty.tsx
│   │       ├── field.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input-group.tsx
│   │       ├── input-otp.tsx
│   │       ├── input.tsx
│   │       ├── item.tsx
│   │       ├── kbd.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── spinner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toggle-group.tsx
│   │       ├── toggle.tsx
│   │       └── tooltip.tsx
│   ├── fonts/                   # Font assets
│   │   └── README.md
│   ├── lib/                     # Shared utilities and hooks
│   │   ├── fetcher.ts
│   │   ├── utils.ts
│   │   ├── hooks/
│   │   │   ├── use-mobile.ts
│   │   │   ├── use-sse-stream.ts
│   │   │   ├── use-thread-state.ts
│   │   │   ├── useResume.ts
│   │   │   └── useThread.ts
│   │   └── utils/
│   │       └── favicon.ts
│   ├── server/                  # Server-side code
│   │   ├── configs/            # Configuration files
│   │   │   ├── env.ts
│   │   │   ├── langgraph.json
│   │   │   ├── llm.ts
│   │   │   └── prompts/
│   │   │       ├── factcheck.system.md
│   │   │       ├── plan-constructor.system.md
│   │   │       ├── planner.system.md
│   │   │       ├── prompt-analyzer.system.md
│   │   │       ├── question-generator.system.md
│   │   │       └── writer.system.md
│   │   ├── grandchildren/       # Grandchild graphs/nodes
│   │   │   └── crawler/
│   │   │       ├── index.ts
│   │   │       └── nodes/
│   │   │           ├── fetch.ts
│   │   │           ├── normalize.ts
│   │   │           └── parse.ts
│   │   ├── graph/              # Main graph definitions
│   │   │   ├── index.ts
│   │   │   ├── state.ts
│   │   │   ├── nodes/
│   │   │   │   ├── approvals.ts
│   │   │   │   ├── plan-gate.ts
│   │   │   │   └── publish-gate.ts
│   │   │   └── subgraphs/
│   │   │       ├── planner/
│   │   │       │   ├── index.ts
│   │   │       │   └── state.ts
│   │   │       └── write/
│   │   │           └── index.ts
│   │   ├── services/           # External service integrations
│   │   │   ├── cost-estimator.ts
│   │   │   ├── harvest.ts
│   │   │   ├── logging.ts
│   │   │   ├── provenance.ts
│   │   │   ├── rerank.ts
│   │   │   ├── search-gateway.ts
│   │   │   └── cache/
│   │   │       ├── lru.ts
│   │   │       └── redis.ts
│   │   ├── store/              # Data persistence
│   │   │   ├── longTerm/
│   │   │   │   ├── index.ts
│   │   │   │   └── adapters/
│   │   │   │       ├── postgres.ts
│   │   │   │       └── redis.ts
│   │   │   └── schemas/
│   │   │       └── userPrefs.ts
│   │   ├── tools/              # Tool integrations
│   │   │   ├── exa.ts
│   │   │   └── tavily.ts
│   │   ├── types/              # Server-side type definitions
│   │   │   ├── domain.ts
│   │   │   ├── evidence.ts
│   │   │   └── prompts.ts
│   │   └── utils/              # Server utilities
│   │       └── hashing.ts
│   ├── types/                   # Client-side type definitions
│   │   └── ui.ts
│   └── [other types files]     # Additional type definitions
```

## Testing

```
├── tests/                      # Test files
    └── [test files]
```

## Key Directories Explained

### `/src/app`
Contains the Next.js App Router structure with routes, layouts, and API endpoints. Route-specific components are colocated with their routes.

### `/src/components`
Three main categories of components:
- `ui/`: Base UI components (shadcn/ui)
- `ai-elements/`: AI-specific UI components
- `motion-primitives/`: Animation and interaction components

### `/src/server`
Server-side functionality including:
- `graph/`: LangGraph orchestration and subgraphs
- `services/`: External API integrations
- `store/`: Data persistence layers
- `tools/`: Tool integrations (Exa, Tavily)

### `/src/lib`
Shared utilities and hooks for client-side functionality.

### `/documentation`
Comprehensive LangGraph documentation for understanding the AI/agent architecture.

This structure follows Next.js 13+ App Router conventions and maintains clear separation between client and server code.