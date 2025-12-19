# Shepherd Technical Architecture

## Overview

VS Code extension with React Webview UI and MCP server for Claude Code task management.

## Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Webview  │────▶│   TaskStore     │◀────│   MCP Server    │
│   (sidebar)     │     │  (single source │     │  (via HTTP)     │
└─────────────────┘     │   of truth)     │     └─────────────────┘
        ▲               └────────┬────────┘
        │                        │
   postMessage                   ▼
        │               ┌────────────────┐
        ▼               │  Repositories  │
┌─────────────────┐     └────────┬───────┘
│ WebviewProvider │              │
└─────────────────┘              ▼
                       .shepherd/data.db (SQLite via sql.js)
```

### Database (`src/db/`)
SQLite database using sql.js (WASM). No native dependencies.

**Schema:**
- `project` - Singleton project metadata
- `features` - Feature containers with status tracking
- `tasks` - Tasks with optional feature_id foreign key
- `requirement_sessions` - Interview state tracking
- `schema_migrations` - Database version tracking

### Migrations (`src/db/migrations.ts`)
Sequential migration system for schema evolution. Migrations are idempotent and tracked in `schema_migrations` table.

### Repositories (`src/db/repositories/`)
- `ProjectRepo` - Project CRUD
- `FeatureRepo` - Feature CRUD with reordering and `markDone()`
- `TaskRepo` - Task CRUD with feature relationships
- `SessionRepo` - Interview session persistence

### TaskStore (`src/tasks/TaskStore.ts`)
Wraps repositories. Emits `onDidChange` event on mutations.

Key methods:
- `markFeatureDone(id)` - Marks feature and all its tasks as done
- `getTaskWithFeature(id)` - Returns task with linked feature info
- `archiveDoneTasks()` - Deletes all done tasks

### WebviewProvider (`src/webview/WebviewProvider.ts`)
Implements `WebviewViewProvider` for VS Code sidebar. Handles message passing between webview and TaskStore.

### React Webview (`src/webview/`)
React 18 application bundled with esbuild. Uses Tailwind CSS v4 for styling.

Key components:
- `App.tsx` - Main app, manages task state and message handlers
- `FeatureSection.tsx` - Collapsible feature with nested tasks and status
- `TaskList.tsx` - Drag-and-drop task list using @dnd-kit
- `TaskCard.tsx` - Individual task card with inline editing
- `AddMenu.tsx` - Dropdown menu for creating tasks/bugs/features
- `AddTaskForm.tsx` - Form to create new tasks with title + description
- `IntensitySelector.tsx` - Thought partner intensity selection (minimal/balanced/deep-dive)
- `ReworkFeedbackModal.tsx` - Modal for providing rework feedback on tasks
- `VoiceCapture.tsx` - Voice recording with MediaRecorder API
- `RequirementsList.tsx` - Requirements browser with interview trigger
- `RequirementsInterview.tsx` - Modal for Claude interview workflow
- `ProposalReview.tsx` - Review and approve/reject interview proposals

### HttpBridge (`src/http/bridge.ts`)
Localhost HTTP server on random port. Writes port to `.shepherd/.port`. Routes MCP tool calls to TaskStore.

### MCP Server (`.shepherd/mcp-server.js`)
Standalone stdio server spawned by Claude Code. Reads port file, proxies JSON-RPC to HTTP bridge.

### Prompts (`src/prompts/index.ts`)
Centralized LLM prompts and JSON schemas for interview and task parsing.

**Interview Scopes:**
- `project` - Full project requirements (multiple features allowed, consolidation encouraged)
- `new-feature` - Single feature for existing app (exactly ONE feature enforced)
- `task` - Quick task definition

**Intensity Modes:**
- `minimal` - Skip to proposal unless blocked
- `balanced` - Default questioning behavior
- `deep-dive` - Thorough exploration of edge cases

### Prompt Engineering Techniques

Techniques applied to enforce LLM compliance with constraints (based on Claude docs and research):

| Technique | Purpose | Example |
|-----------|---------|---------|
| XML tags | Structure constraints clearly | `<single_feature_requirement>...</single_feature_requirement>` |
| Authority framing | Make rules feel non-negotiable | "SYSTEM REQUIREMENT:" |
| Social proof | Normalize desired behavior | "This is how it works in this system:" |
| Positive examples only | Avoid teaching wrong patterns | Show only correct JSON structure, no "WRONG" examples |
| Output priming | Guide exact format | Full JSON example with correct structure |
| Verification step | Force self-check before output | "Before generating, verify: features.length === 1" |

**Key insight:** LLMs pay close attention to examples. Showing "WRONG" examples (even labeled as wrong) can teach the undesired pattern. Only show correct examples.

**Feature Consolidation Rules:**
- `new-feature` scope: `features.length === 1` (strict)
- `project` scope: Minimize features, consolidate related functionality
- Rationale: Each feature is built by an LLM that needs ALL related work in one context

**Sources:**
- [Claude 4.x Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices)
- [Superpowers blog](https://blog.fsck.com/2025/10/09/superpowers/) - Cialdini's persuasion principles work on LLMs

## UI Architecture

### Tech Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Utility-first styling with `@theme` directive
- **@dnd-kit** - Drag-and-drop reordering
- **Lucide React** - Icons
- **esbuild** - Bundling

### Design System (Shepherd)
Minimal, Linear-inspired aesthetic:
- Primary: `#3A6F74` (teal)
- Neutrals: 11-step grayscale from white to near-black
- Semantic colors: success, warning, danger

### Build Pipeline
```bash
npm run compile          # TypeScript + webview bundle
npm run build:webview    # Webview only
npm run watch            # Watch mode for both
```

## Testing

Uses **Vitest** for testing. Tests run in Node.js environment (no VS Code runtime needed).

```bash
npm test                 # Run all tests once
npm run test:watch       # Watch mode with auto-rerun
npm run test:ui          # Browser-based test UI
```

### Test Files
- `src/**/*.test.ts` - Test files (excluded from TypeScript compilation)
- `vitest.config.ts` - Vitest configuration

### Claude CLI Integration Tests
Tests in `src/interview/InterviewService.test.ts` call Claude CLI directly with `execSync` to verify JSON schema validation. Uses 60s timeout for API calls.

CSS is built separately using `@tailwindcss/cli` to handle v4 syntax.

## Data Flow

### User Actions
1. User interacts with webview (click, drag, type)
2. Webview sends message via `vscode.postMessage()`
3. WebviewProvider receives message and calls TaskStore
4. TaskStore mutates state and saves to disk
5. `onDidChange` fires
6. WebviewProvider sends `tasksUpdated` message
7. Webview updates React state

### MCP/Claude Actions
1. Claude Code calls MCP tool
2. MCP server proxies to HTTP bridge
3. HTTP bridge calls TaskStore method
4. TaskStore saves and emits change
5. WebviewProvider notifies webview

## Data Model

```typescript
interface Project {
  id: string;               // 'main' singleton
  title: string | null;
  description: string | null;
  requirement_path: string | null;
  created_at: string;
  updated_at: string;
}

type FeatureStatus = 'active' | 'done';

interface Feature {
  id: string;               // UUID
  title: string;
  description: string | null;
  requirement_path: string | null;  // Links to docs/requirements/*.md
  status: FeatureStatus;    // active or done
  priority: number;         // Order (0 = highest)
  created_at: string;
  updated_at: string;
}

type TaskStatus = 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';

interface Task {
  id: string;               // UUID
  feature_id: string | null;  // Optional feature link
  type: 'task' | 'bug';
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;         // Order (0 = highest)
  created_at: string;
  updated_at: string;
}

interface TaskWithFeature extends Task {
  feature?: { id: string; title: string } | null;
}
```

**Hierarchy:** Project → Features → Tasks (one level deep)

## File Locations

| File | Purpose |
|------|---------|
| `.shepherd/data.db` | SQLite database (sql.js) |
| `.shepherd/.initialized` | Initialization marker |
| `.shepherd/mcp-server.js` | MCP server |
| `.shepherd/.port` | HTTP bridge port |
| `.shepherd/COPILOT.md` | Auto-generated AI context index |
| `.shepherd/whisper/config.json` | Selected model config |
| `~/Library/Application Support/shepherd/whisper/models/*.bin` | Shared Whisper models (macOS) |
| `.shepherd/whisper/bin/` | whisper.cpp binary (local build) |
| `docs/requirements/*.md` | Requirement docs |
| `docs/requirements/design.md` | Global design guide |
| `CLAUDE.md` | Project instructions for Claude |
| `.mcp.json` | Claude Code MCP server config |
| `.claude/settings.json` | Claude Code tool permissions |
| `out/webview/webview.js` | Bundled React app |
| `out/webview/webview.css` | Compiled Tailwind CSS |

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_tasks` | Lists tasks with optional `limit`, `status`, `feature_id` filters |
| `get_task` | Returns task by ID |
| `update_task_status` | Updates task status |
| `create_task` | Creates new task with optional `feature_id` and `type` |
| `list_features` | Lists all features |
| `get_feature` | Returns feature by ID |
| `create_feature` | Creates new feature |
| `list_requirements` | Lists requirement files |
| `get_requirements_path` | Returns requirements folder path |
| `get_task_requirement` | Returns requirement path for task (via feature) |
| `create_requirement` | Creates requirement file |
| `complete_interview` | Signals interview completion |

## Voice Capture

Flow: Recording → Transcription → Task Parsing → Review → Add

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ AudioRecorder│────▶│ whisper.cpp │────▶│ claude --print│────▶│ Review UI   │
│ (sox/arecord)│     │ (local)     │     │ (parse JSON) │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

VS Code webviews can't access `navigator.mediaDevices.getUserMedia()`, so recording happens on the extension side using system tools.

### AudioRecorder (`src/voice/AudioRecorder.ts`)
Records audio using system command-line tools:
- **macOS/Windows**: sox (`brew install sox`)
- **Linux**: arecord (alsa-utils) or sox

Records mono 16kHz WAV files optimized for speech recognition.

### WhisperService (`src/voice/WhisperService.ts`)
Manages whisper.cpp binary with smart detection:
- Checks if already installed (`which whisper`, common paths)
- **macOS**: Offers Homebrew, MacPorts, or build from source
- **Windows**: Downloads pre-built binary from GitHub releases
- **Linux**: Offers build from source

### Model Options
| Model | Size | Use Case |
|-------|------|----------|
| tiny | 75 MB | Quick notes, fastest |
| base | 142 MB | Balanced (recommended) |
| small | 466 MB | Better accuracy |
| medium | 1.5 GB | Best accuracy, slowest |

Models downloaded from Hugging Face on first use. Stored in shared user-level directory (e.g., `~/Library/Application Support/shepherd/whisper/models/` on macOS).

### Message Flow (Normal Mode)
1. Webview sends `startRecording` message
2. Extension starts sox/arecord via AudioRecorder
3. Extension sends `recordingStarted` to webview (UI shows timer)
4. User clicks stop → webview sends `stopRecording`
5. Extension stops recording, sends `recordingStopped`
6. WhisperService transcribes locally
7. Transcript parsed to tasks via `claude --print -p`
8. Extension sends `voiceTranscribed` with parsed tasks
9. Webview shows review UI → user confirms → tasks added

### Message Flow (Raw Mode)
Used in interview inputs where spoken text should be inserted directly without parsing.

1. Webview sends `startRecording` with `rawMode: true`
2. Steps 2-6 same as normal mode
3. Extension sends `voiceRawTranscript` with transcript string
4. Webview inserts text into active input field

## Requirements Interview

Interactive Claude-powered workflow for defining features with requirements.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ AddMenu clicks  │────▶│ InterviewService│────▶│ RequirementsDoc │
│ "New Feature    │     │ (Claude stream) │     │ + Features      │
│  with Reqs"     │     └─────────────────┘     │ + Tasks         │
└─────────────────┘              │              └─────────────────┘
                                 ▼
                    ┌─────────────────────┐
                    │ RequirementsInterview│
                    │ Modal (questions,   │
                    │ thinking, proposal) │
                    └─────────────────────┘
```

### InterviewService (`src/interview/InterviewService.ts`)
Spawns Claude CLI with `--output-format json --json-schema` for structured output.

**Interview Scopes:**
- `project` - Full project with multiple features
- `new-feature` - Single feature for existing app
- `task` - Quick task definition (minimal questions)

**Intensity Modes:**
- `minimal` - Skip questions, propose immediately unless blocked
- `balanced` - Default behavior, 2-4 questions per round
- `deep-dive` - Thorough exploration of edge cases, accessibility, performance

**Response Schema:** Enforces response types:
- `questions` - Array of questions with id, text, questionType (text/choice), optional options
- `proposal` - Requirement doc + features + tasks + optional design.md updates

CLI outputs wrapped as `{"type":"result","structured_output":{...}}`

### Message Flow
1. User clicks "New Feature (with Requirements)" in AddMenu
2. User selects intensity mode (minimal/balanced/deep-dive)
3. WebviewProvider calls `InterviewService.start()`
4. InterviewService spawns Claude with scope-specific system prompt
5. Claude asks questions via JSON stream (batch of 2-4)
6. User answers in RequirementsInterview modal
7. On proposal, user reviews and approves/rejects
8. Approval triggers: save requirement doc, create features, create tasks

### Context Injection
Interview receives context about the existing app:
- Project title and description
- Existing features and their descriptions
- Existing requirements with summaries
- Current design.md content (for visual/UI decisions)

## Project Context

Manages context files that help AI assistants understand the project.

### Files
| File | Purpose |
|------|---------|
| `.shepherd/COPILOT.md` | Auto-generated index of requirements and features |
| `docs/requirements/design.md` | Global design guide for UI patterns |
| `CLAUDE.md` | Project instructions with reference to COPILOT.md |

### ProjectContext (`src/context/ProjectContext.ts`)
Initializes on extension activation:
1. Creates `.shepherd/` and `docs/requirements/` directories
2. Generates `COPILOT.md` with requirements index and feature list
3. Creates `design.md` template if missing
4. Creates or updates `CLAUDE.md` with reference to COPILOT.md

Updates `COPILOT.md` whenever features change via `updateCopilotMd()`.
