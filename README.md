# Shepherd

A VS Code extension that helps product managers work with AI coding agents like Claude Code. Manage tasks, capture requirements through AI interviews, and use voice-to-task conversion—all from your IDE.

## Features

- **Task Management** — Create, prioritize, and track tasks with drag-and-drop reordering
- **AI Requirements Interview** — Claude interviews you to create structured requirement docs
- **Voice Capture** — Dictate tasks using local speech-to-text (no cloud APIs)
- **MCP Integration** — Claude Code can query tasks and update status automatically

## Prerequisites

**Claude Code CLI** — Required. Install from [claude.ai/code](https://claude.ai/code)

**Voice capture dependencies** — Shepherd will guide you through installation:
- **sox** — Shepherd offers to install via Homebrew on macOS; manual install needed on Linux/Windows
- **whisper.cpp** — Automatically installed on first voice capture
- **Whisper models** — Downloaded automatically (~150MB for base model)

## Installation

### From VSIX (Testing)

1. Download the `.vsix` file
2. In VS Code, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded file
5. Reload VS Code

### First Run

1. Open a project folder in VS Code
2. Click the Shepherd icon in the activity bar (left sidebar)
3. Click "Initialize Shepherd" when prompted
4. Shepherd creates:
   - `.pmcockpit/` — Data storage and MCP server
   - `docs/requirements/` — Requirements documents
   - `.mcp.json` — Claude Code MCP configuration

## Usage

### Creating Tasks

- Click the **+** button to add a task
- Use **"New Feature (with Requirements)"** to start an AI interview
- Use the **microphone** button to dictate tasks via voice

### Task Workflow

1. Create tasks in the sidebar
2. Drag to reorder priority (top = highest priority)
3. Claude Code uses `get_next_task` to pick up work
4. Tasks move through: `todo` → `in-progress` → `ready-for-signoff` → `done`

### Voice Capture

1. Click the microphone icon
2. Speak your tasks naturally (e.g., "Add a login page and fix the header bug")
3. Review the parsed tasks
4. Confirm to add them to your backlog

### Requirements Interview

1. Click **+ → New Feature (with Requirements)**
2. Answer Claude's questions about the feature
3. Review the generated requirements doc and tasks
4. Approve to create everything automatically

## Known Limitations

- Voice capture requires sox to be installed and accessible in PATH
- Whisper model download (~150MB) happens on first voice capture
- MCP integration requires Claude Code CLI to be installed
- Currently single-user (no team collaboration features)

## Troubleshooting

**Voice capture not working?**
- Ensure sox is installed: `sox --version`
- Check microphone permissions in System Settings

**Claude Code not seeing tasks?**
- Verify `.mcp.json` exists in your project root
- Restart Claude Code after initialization

**Extension not activating?**
- Check the Output panel → "Shepherd" for errors
- Ensure you have a folder open (not just a file)

## License

Proprietary. See LICENSE file.
