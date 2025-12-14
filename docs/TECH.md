# Product Cockpit Technical Architecture

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
                        .pmcockpit/data.db (SQLite via sql.js)
```

### Database (`src/db/`)
SQLite database using sql.js (WASM). No native dependencies.

**Schema:**
- `project` - Singleton project metadata
- `features` - Feature containers for grouping tasks
- `tasks` - Tasks with optional feature_id foreign key
- `requirement_sessions` - Interview state tracking (future)

### Repositories (`src/db/repositories/`)
- `ProjectRepo` - Project CRUD
- `FeatureRepo` - Feature CRUD with reordering
- `TaskRepo` - Task CRUD with feature relationships

### TaskStore (`src/tasks/TaskStore.ts`)
Wraps repositories. Emits `onDidChange` event on mutations.

### WebviewProvider (`src/webview/WebviewProvider.ts`)
Implements `WebviewViewProvider` for VS Code sidebar. Handles message passing between webview and TaskStore.

### React Webview (`src/webview/`)
React 18 application bundled with esbuild. Uses Tailwind CSS v4 for styling.

Key components:
- `App.tsx` - Main app, manages task state and message handlers
- `TaskList.tsx` - Drag-and-drop task list using @dnd-kit
- `TaskCard.tsx` - Individual task card with inline editing
- `AddTaskForm.tsx` - Form to create new tasks with title + description
- `VoiceCapture.tsx` - Voice recording with MediaRecorder API
- `RequirementsList.tsx` - Requirements browser with interview trigger

### HttpBridge (`src/http/bridge.ts`)
Localhost HTTP server on random port. Writes port to `.pmcockpit/.port`. Routes MCP tool calls to TaskStore.

### MCP Server (`.pmcockpit/mcp-server.js`)
Standalone stdio server spawned by Claude Code. Reads port file, proxies JSON-RPC to HTTP bridge.

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

interface Feature {
  id: string;               // UUID
  title: string;
  description: string | null;
  requirement_path: string | null;  // Links to docs/requirements/*.md
  priority: number;         // Order (0 = highest)
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;               // UUID
  feature_id: string | null;  // Optional feature link
  type: 'task' | 'bug';
  title: string;
  description: string | null;
  status: TaskStatus;       // todo | in-progress | ready-for-signoff | done | rework
  priority: number;         // Order (0 = highest)
  created_at: string;
  updated_at: string;
}
```

**Hierarchy:** Project → Features → Tasks (one level deep)

## File Locations

| File | Purpose |
|------|---------|
| `.pmcockpit/data.db` | SQLite database (sql.js) |
| `.pmcockpit/.initialized` | Initialization marker |
| `.pmcockpit/mcp-server.js` | MCP server |
| `.pmcockpit/.port` | HTTP bridge port |
| `.pmcockpit/whisper/config.json` | Selected model config |
| `.pmcockpit/whisper/models/*.bin` | Downloaded Whisper models |
| `.pmcockpit/whisper/bin/` | whisper.cpp binary (Windows) |
| `docs/requirements/*.md` | Requirement docs |
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

Models downloaded from Hugging Face on first use. Stored in `.pmcockpit/whisper/models/`.

### Message Flow
1. Webview sends `startRecording` message
2. Extension starts sox/arecord via AudioRecorder
3. Extension sends `recordingStarted` to webview (UI shows timer)
4. User clicks stop → webview sends `stopRecording`
5. Extension stops recording, sends `recordingStopped`
6. WhisperService transcribes locally
7. Transcript parsed to tasks via `claude --print -p`
8. Extension sends `voiceTranscribed` with parsed tasks
9. Webview shows review UI → user confirms → tasks added
