# Product Cockpit — VS Code Extension Requirements

## Overview

Product Cockpit is a VS Code extension that provides product managers with a visual interface for managing tasks and requirements when working with AI coding agents like Claude Code or OpenAI Codex. It eliminates the need for external tools like Jira or Linear by keeping all product management artifacts local to the repository.

### Core Value Proposition

- **Voice-first task capture** — Quickly dictate multiple tasks that get parsed into individual stories
- **Visual task management** — Drag-to-prioritize task queue that AI agents pull from
- **Requirements authoring via AI interview** — Claude Code interviews you to create structured requirements docs
- **Agent integration** — MCP server lets Claude Code query tasks and requirements directly

---

## User Stories

### Task Management

**US-1: Create task via UI**
As a PM, I want to create a task with a description so that it appears in my prioritized backlog.

Acceptance Criteria:
- Task has a description field (required)
- Task is assigned default status `todo`
- Task appears at bottom of priority list
- Task can optionally link to a requirement file

**US-2: Create tasks via voice**
As a PM, I want to record a voice memo describing multiple features so that they are automatically parsed into individual tasks.

Acceptance Criteria:
- Single recording can produce multiple tasks
- Local transcription (no cloud API) using open-source model (e.g., Parakeet)
- Each parsed task is presented for review before adding to queue
- User can edit/delete parsed tasks before confirming

**US-3: Prioritize tasks**
As a PM, I want to drag tasks up and down to set priority so that Claude Code works on the most important items first.

Acceptance Criteria:
- Drag-and-drop reordering in UI
- Priority is implicit (list order = priority)
- Changes persist immediately to storage

**US-4: Track task status**
As a PM, I want to see task status so I know what's being worked on and what needs my review.

Acceptance Criteria:
- Statuses: `todo`, `in-progress`, `ready-for-signoff`, `done`, `rework`
- Visual distinction for each status (color/icon)
- Filter/group by status

**US-5: Sign off on completed work**
As a PM, I want to review tasks marked ready-for-signoff and either approve them or send them back for rework.

Acceptance Criteria:
- "Approve" action moves task to `done`
- "Rework" action moves task back to `todo` (or dedicated `rework` status)
- Optional: Add notes when sending back for rework

---

### Requirements Management

**US-6: Create requirement via interview**
As a PM, I want Claude Code to interview me about a feature so that it produces a structured requirements document and suggested tasks.

Acceptance Criteria:
- "Create Requirement" button spawns Claude Code in VS Code terminal
- Claude asks clarifying questions until feature is understood
- Claude generates requirements doc using standard template
- Claude proposes tasks linked to the requirement
- User approves/edits proposed tasks
- Claude calls MCP tool to signal completion

**US-7: Browse requirements**
As a PM, I want to see all requirements documents so I can reference them or link tasks to them.

Acceptance Criteria:
- List view of all requirement files
- Click to open in editor
- Show which tasks are linked to each requirement

**US-8: Link task to existing requirement**
As a PM, I want to link a standalone task to an existing requirement so Claude has context when working on it.

Acceptance Criteria:
- Task edit UI shows dropdown of available requirements
- Task can have zero or one linked requirement

---

### Claude Code Integration

**US-9: Claude Code gets next task**
As Claude Code, I want to query for the next task to work on so I can begin implementation.

Acceptance Criteria:
- MCP tool `get_next_task` returns highest-priority `todo` task
- Returns task description, ID, and linked requirement path (if any)
- Returns null if no tasks available

**US-10: Claude Code updates task status**
As Claude Code, I want to update a task's status so the PM knows the current state.

Acceptance Criteria:
- MCP tool `update_task_status(task_id, status)` updates status
- Valid statuses: todo, in-progress, ready-for-signoff, done, rework
- Extension UI reflects change in real-time
- MCP tool `get_task(task_id)` returns current task state

**US-11: Claude Code accesses requirements**
As Claude Code, I want to know where requirements are stored so I can read them for context.

Acceptance Criteria:
- MCP tool `get_requirements_path()` returns base path
- MCP tool `list_requirements()` returns list of requirement files with metadata
- MCP tool `get_task_requirement(task_id)` returns linked requirement path for a task

**US-12: Interview completion signal**
As Claude Code (during interview), I want to signal the extension that I'm done so it can refresh the UI and close the terminal.

Acceptance Criteria:
- MCP tool `complete_interview()` notifies extension
- Extension refreshes task list and requirements list
- Extension optionally closes the terminal (or leaves for user review)

---

## Data Model

### Task

```typescript
interface Task {
  id: string;                     // UUID
  description: string;            // What to build/fix
  status: 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';
  priority: number;               // Lower = higher priority (derived from list order)
  requirementPath?: string;       // Relative path to linked requirement file
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp
}
```

### Requirement

Requirements are stored as markdown files with a consistent template. Metadata is derived from the file system, not duplicated in JSON.

```typescript
interface RequirementMetadata {
  path: string;                   // Relative path from repo root
  title: string;                  // Derived from filename or H1
  createdAt: string;              // File creation time
  updatedAt: string;              // File modification time
}
```

### Requirement Template

```markdown
# [Feature Name]

## Overview
Brief description of what this feature does and why it matters.

## User Stories
- As a [user type], I want [capability] so that [benefit]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
Implementation considerations, constraints, dependencies.

## Open Questions
- Unresolved decisions or items needing clarification
```

---

## Project Initialization

On first activation in a workspace, the extension prompts the user before creating any files.

### Initialization Dialog

```
Product Cockpit needs to set up a few files in your project:

• .pmcockpit/tasks.json — Task queue storage
• .pmcockpit/mcp-server.js — MCP server for Claude Code integration
• docs/requirements/ — Requirements documents folder
• .claude/settings.json — Claude Code tool permissions (will merge if exists)
• .claude/mcp.json — MCP server configuration (will merge if exists)

These files enable Claude Code to read tasks and requirements from your project.

[Initialize] [Cancel]
```

### Initialization Behavior

- If user clicks **Initialize**, create all files/folders
- If user clicks **Cancel**, extension remains dormant (no sidebar, no features)
- If `.pmcockpit/tasks.json` already exists, skip initialization (assume already set up)
- When modifying `.claude/settings.json` or `.claude/mcp.json`, merge with existing content (don't overwrite user's other settings)

---

## Storage

### Location

Task data stored in `.pmcockpit/` at repository root. Requirements stored in `docs/` for visibility:

```
.pmcockpit/
├── tasks.json              # Task queue
└── config.json             # Extension settings (future)

docs/
├── requirements/           # Requirement documents (user-visible)
│   ├── authentication.md
│   ├── payment-processing.md
│   └── ...
└── ...                     # Other docs can coexist
```

### tasks.json Schema

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "uuid-1",
      "description": "Add OAuth login with Google",
      "status": "todo",
      "priority": 0,
      "requirementPath": "docs/requirements/authentication.md",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Git Considerations

- `.pmcockpit/` can be committed (shared backlog) or gitignored (personal use)
- Recommend committing for team visibility

### Claude Code Configuration Files

**.claude/settings.json** — Tool permissions:
```json
{
  "allowedTools": [
    "Read",
    "Write",
    "Edit",
    "Bash",
    "mcp__pmcockpit__get_next_task",
    "mcp__pmcockpit__get_task",
    "mcp__pmcockpit__update_task_status",
    "mcp__pmcockpit__create_task",
    "mcp__pmcockpit__create_requirement",
    "mcp__pmcockpit__complete_interview",
    "mcp__pmcockpit__list_requirements",
    "mcp__pmcockpit__get_requirements_path",
    "mcp__pmcockpit__get_task_requirement"
  ]
}
```

**.claude/mcp.json** — MCP server configuration:
```json
{
  "mcpServers": {
    "pmcockpit": {
      "command": "node",
      "args": [".pmcockpit/mcp-server.js"]
    }
  }
}
```

---

## MCP Server Specification

The extension runs an MCP server that Claude Code connects to.

### Tools

| Tool | Parameters | Returns | Description |
|------|------------|---------|-------------|
| `get_next_task` | none | `Task \| null` | Returns highest-priority todo task |
| `get_task` | `task_id: string` | `Task \| null` | Returns task by ID including current status |
| `update_task_status` | `task_id: string, status: Status` | `Task` | Updates task status (todo, in-progress, ready-for-signoff, done, rework) |
| `get_requirements_path` | none | `string` | Returns absolute path to requirements folder |
| `list_requirements` | none | `RequirementMetadata[]` | Lists all requirement files |
| `get_task_requirement` | `task_id: string` | `string \| null` | Returns requirement path for task |
| `complete_interview` | `requirement_path?: string, task_ids?: string[]` | `void` | Signals interview complete, triggers UI refresh |
| `create_requirement` | `path: string, content: string` | `RequirementMetadata` | Saves requirement file |
| `create_task` | `description: string, requirementPath?: string` | `Task` | Creates new task |

### Extension ↔ MCP Communication

Since VS Code terminal API doesn't support reading stdout, the MCP server notifies the extension via:

- **Option A:** Write to a signal file (e.g., `.pmcockpit/.signal`) that extension watches
- **Option B:** Localhost HTTP endpoint exposed by extension
- **Option C:** VS Code extension IPC if available

Recommend Option A for simplicity.

---

## Voice Transcription

### Approach

- Use local transcription via NVIDIA Parakeet or OpenAI Whisper (open-source)
- Run model in a subprocess spawned by extension
- No cloud API calls for privacy

### Flow

1. User clicks "Voice Capture" button
2. Extension starts audio recording (via VS Code webview or system audio API)
3. User speaks, clicks stop
4. Audio file sent to local transcription model
5. Transcript parsed into tasks via Claude Code headless mode (see below)
6. User reviews/edits parsed tasks
7. User confirms, tasks added to queue

### Parsing Transcript → Tasks (Headless Mode)

Use Claude Code's `-p` flag for non-interactive parsing:

```bash
claude -p "Parse this transcript into individual task descriptions. Return only a JSON array of strings, no other text: \"${transcript}\""
```

Extension captures stdout, parses JSON, presents tasks for review.

---

## Claude Code Integration Modes

The extension uses Claude Code in two different modes:

| Use Case | Mode | How |
|----------|------|-----|
| Parse transcript → tasks | Headless (`-p`) | Extension runs command, captures stdout |
| Requirement interview | Interactive terminal | Extension spawns terminal, user chats with Claude |

### Headless Mode (Transcript Parsing)

- Extension spawns Claude Code as child process
- Captures stdout directly
- No terminal UI needed
- Use minimal `--allowedTools` (just text processing, no file access)

### Interactive Mode (Requirement Interview)

- Extension creates VS Code terminal
- Sends initial prompt via `terminal.sendText()`
- User interacts with Claude Code directly
- Claude calls MCP tools to save requirement and tasks
- `complete_interview` MCP tool signals extension when done

---

## UI Components

### Sidebar Panel: Task Queue

- Header with "Add Task" and "Voice Capture" buttons
- Scrollable list of tasks grouped by status
- Each task shows:
  - Drag handle
  - Description (truncated)
  - Status badge
  - Linked requirement indicator
- Click to expand/edit
- Right-click context menu: Edit, Delete, Link Requirement

### Sidebar Panel: Requirements

- List of requirement files
- Click to open in editor
- "Create Requirement" button (spawns interview)
- Badge showing linked task count

### Task Detail View

- Full description (editable)
- Status dropdown
- Linked requirement (dropdown to change)
- Timestamps
- Action buttons: Delete, Start Interview (if no requirement linked)

---

## Terminal Integration

### Spawning Claude Code

```typescript
const terminal = vscode.window.createTerminal({
  name: 'Product Cockpit Interview',
  env: {
    // MCP server config injected here
  }
});

terminal.sendText(`claude --mcp-config=.pmcockpit/mcp.json "You are helping a PM create a requirement document. Interview them about the feature they want to build. Ask clarifying questions until you understand it well. Then use the create_requirement tool to save a structured requirements doc, and create_task tool to propose implementation tasks. Finally, call complete_interview when done."`);

terminal.show();
```

### Cleanup

When `complete_interview` signal received:
1. Refresh task and requirements lists
2. Optionally call `terminal.dispose()` or leave open

---

## Future Considerations (Out of Scope for MVP)

- Team collaboration / shared state
- Sync with external tools (Jira, Linear export/import)
- Time tracking
- Sprint planning
- Notifications when tasks change status
- Semantic search over requirements
- Multiple agent support (configure for Codex, etc.)
- Requirement versioning / history

---

## Technical Stack

- **Extension:** TypeScript, VS Code Extension API
- **Storage:** JSON files
- **MCP Server:** TypeScript, runs in extension process or as subprocess
- **Voice Transcription:** Python subprocess running Parakeet/Whisper
- **Terminal Integration:** VS Code Terminal API

---

## Open Questions

1. **Audio recording in VS Code** — Need to verify best approach (webview with MediaRecorder API vs. native extension capability)
2. **MCP server lifecycle** — Does it run continuously while extension is active, or spawn on demand?
3. **Multi-root workspaces** — How to handle when multiple folders are open?
4. **Conflict handling** — What if user edits tasks.json manually while extension is running?

---

## Milestones

### M1: Core Task Management
- Project initialization flow with permission prompt
- Create/edit/delete tasks via UI
- Drag-to-prioritize
- Status tracking
- JSON persistence

### M2: MCP Integration
- MCP server with task tools
- Claude Code can get/update tasks
- Signal file for completion notification
- Auto-configure `.claude/settings.json` and `.claude/mcp.json`

### M3: Requirements Workflow
- Create requirement via Claude Code interview
- Requirements list UI
- Link tasks to requirements

### M4: Voice Capture
- Audio recording in extension
- Local transcription integration
- Transcript → tasks parsing (headless Claude Code)
