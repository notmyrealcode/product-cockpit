# Future: WebSocket/HTTP Server Integration

Reference notes for deeper Claude CLI integration if needed later.

## How Claude Code VS Code Extension Does It

The official Claude Code extension uses an HTTP/WebSocket server for real-time bidirectional communication:

```
┌─────────────────┐      HTTP/WebSocket       ┌──────────────────┐
│  Claude Process │  <──────────────────────> │  VS Code Ext     │
│  (Terminal)     │      localhost:PORT       │  (Server)        │
└─────────────────┘                           └──────────────────┘
```

### Setup Flow

1. Extension starts HTTP server on random port
2. Passes port to Claude via environment variables:
   ```javascript
   env: {
     CLAUDE_CODE_SSE_PORT: port,
     ENABLE_IDE_INTEGRATION: '1'
   }
   ```
3. Claude CLI connects back to that port on startup
4. Bidirectional communication enabled

### Capabilities This Enables

- **Real-time progress** - Stream "working on file X" updates
- **Diff previews** - Show file changes in editor before applying
- **Interactive prompts** - Claude asks questions via VS Code UI
- **Approval workflows** - User approves/rejects changes inline
- **Diagnostics sharing** - Extension sends lint errors to Claude

## Implementation Approach

If we want this later:

1. Add express or native http server to extension
2. Generate random port, start server on activation
3. When spawning Claude terminal, pass port via env:
   ```typescript
   vscode.window.createTerminal({
     name: 'Claude Build',
     env: { PMCOCKPIT_PORT: String(port) }
   });
   ```
4. Create MCP tool or hook for Claude to connect back
5. Define message protocol (JSON over WebSocket or SSE)

### Message Protocol Ideas

```typescript
// Extension → Claude
{ type: 'diagnostics', errors: [...] }
{ type: 'userApproval', approved: true }

// Claude → Extension
{ type: 'taskProgress', taskId: '...', status: 'in-progress' }
{ type: 'requestApproval', changes: [...] }
{ type: 'showDiff', file: '...', content: '...' }
```

## Current Approach (Simpler)

We currently use:
- **Shell integration API** (`onDidEndTerminalShellExecution`) - detects when Claude command finishes
- **MCP tools** - Claude updates task status via `update_task_status` tool
- **File watching** - Extension watches tasks.json for changes

This covers core needs without WebSocket complexity. Consider upgrading if we need:
- Real-time streaming progress
- Interactive approval before commits
- Inline diff previews in editor
