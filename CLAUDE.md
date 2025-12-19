# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shepherd is a VS Code extension that provides product managers with a visual interface for managing tasks and requirements when working with AI coding agents. Key features include:

- Voice-first task capture with local transcription (Parakeet/Whisper)
- Visual drag-to-prioritize task queue
- Requirements authoring via Claude Code interview
- MCP server integration for AI agent task coordination

# Before Writing Code

**REQUIRED:** Read `docs/TECH.md` before implementing any feature or fix. It documents:
- Component architecture and data flow
- Database schema and repositories
- Webview/extension message protocols
- Interview service and prompts system

This ensures you understand existing patterns and don't duplicate or conflict with current architecture.

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

## Technical Stack

- **Extension:** TypeScript, VS Code Extension API
- **UI:** React 18, Tailwind CSS v4, @dnd-kit
- **Storage:** SQLite via sql.js (`.shepherd/data.db`)
- **MCP Server:** TypeScript (stdio server proxying to HTTP bridge)
- **Voice:** whisper.cpp (local transcription)
- **Testing:** Vitest

See `docs/TECH.md` for full architecture details.
