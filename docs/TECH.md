# Product Cockpit Technical Architecture

## Overview

VS Code extension with TreeView UI and MCP server for Claude Code task management.

## Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TreeView UI   │────▶│   TaskStore     │◀────│   MCP Server    │
│  (TaskProvider) │     │  (single source │     │  (via HTTP)     │
└─────────────────┘     │   of truth)     │     └─────────────────┘
                        └────────┬────────┘
                                 │
                                 ▼
                        .pmcockpit/tasks.json
```

### TaskStore (`src/tasks/TaskStore.ts`)
Single source of truth for tasks. Emits `onDidChange` event on mutations. Watches file for external changes.

### TaskProvider (`src/tasks/TaskProvider.ts`)
TreeDataProvider + TreeDragAndDropController for VS Code sidebar. Subscribes to TaskStore changes.

### HttpBridge (`src/http/bridge.ts`)
Localhost HTTP server on random port. Writes port to `.pmcockpit/.port`. Routes MCP tool calls to TaskStore.

### MCP Server (`.pmcockpit/mcp-server.js`)
Standalone stdio server spawned by Claude Code. Reads port file, proxies JSON-RPC to HTTP bridge.

## Data Flow

1. User/Claude Code initiates action
2. TreeView command or MCP tool call
3. TaskStore mutates state and saves
4. `onDidChange` fires
5. TreeView refreshes

## File Locations

| File | Purpose |
|------|---------|
| `.pmcockpit/tasks.json` | Task data |
| `.pmcockpit/mcp-server.js` | MCP server |
| `.pmcockpit/.port` | HTTP bridge port |
| `docs/requirements/*.md` | Requirement docs |
| `.claude/mcp.json` | MCP config |
| `.claude/settings.json` | Tool permissions |

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_next_task` | Returns highest-priority todo task |
| `get_task` | Returns task by ID |
| `update_task_status` | Updates task status |
| `create_task` | Creates new task |
| `list_requirements` | Lists requirement files |
| `get_requirements_path` | Returns requirements folder path |
| `get_task_requirement` | Returns requirement path for task |
| `create_requirement` | Creates requirement file |
| `complete_interview` | Signals interview completion |
