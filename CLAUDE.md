# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Product Cockpit is a VS Code extension that provides product managers with a visual interface for managing tasks and requirements when working with AI coding agents. Key features include:

- Voice-first task capture with local transcription (Parakeet/Whisper)
- Visual drag-to-prioritize task queue
- Requirements authoring via Claude Code interview
- MCP server integration for AI agent task coordination

# Design
Please refer to @docs/design_style_guide.md 

# Making Updates
1. Commit to git (no author names in commit messages)
2. Update `docs/TECH.md` for architectural changes only
3. Update `docs/TODO.md` if needed

## Testing

Run tests with `npm test` (single run) or `npm run test:watch` (watch mode).

**Writing tests:** Create `*.test.ts` files alongside source files. Tests use Vitest.

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
    it('works correctly', () => {
        expect(result).toBe(expected);
    });
});
```

**Note:** Tests run in Node.js, not VS Code. For CLI integration tests, use 60s timeout.

## TECH.md Guidelines
Update for: new components, data flow changes, external APIs. Skip: bug fixes, troubleshooting, changelogs. Be concise - one example beats three verbose ones.



## Project Status

This project is in the requirements/planning phase. The `docs/pm-cockpit-requirements.md` file contains the full specification including user stories, data models, and implementation milestones.

## Technical Stack

- **Extension:** TypeScript, VS Code Extension API
- **Storage:** SQLite via sql.js (`.pmcockpit/data.db`)
- **MCP Server:** TypeScript
- **Voice Transcription:** whisper.cpp (local)
- **Requirements Storage:** Markdown files in `docs/requirements/`
- **Testing:** Vitest

## Architecture

### Data Storage
- `.pmcockpit/data.db` - SQLite database (sql.js)
- `.pmcockpit/mcp-server.js` - MCP server
- `docs/requirements/` - Requirement markdown files
- `.mcp.json` - MCP server configuration

### MCP Tools to Implement
- `get_next_task` - Returns highest-priority todo task
- `get_task` - Returns task by ID
- `update_task_status` - Updates task status
- `create_task` - Creates new task
- `create_requirement` - Saves requirement file
- `complete_interview` - Signals interview completion
- `list_requirements` - Lists all requirement files
- `get_requirements_path` - Returns requirements folder path
- `get_task_requirement` - Returns requirement path for task

### Task Statuses
`todo` | `in-progress` | `ready-for-signoff` | `done` | `rework`

## Implementation Milestones

1. **M1: Core Task Management** - UI for task CRUD, drag-to-prioritize, JSON persistence
2. **M2: MCP Integration** - MCP server, Claude Code task tools, signal file notifications
3. **M3: Requirements Workflow** - Interview flow, requirements list, task linking
4. **M4: Voice Capture** - Audio recording, local transcription, headless parsing
