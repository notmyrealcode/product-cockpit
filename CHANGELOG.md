# Changelog

All notable changes to Shepherd will be documented in this file.

## [0.0.4] - 2025-12-18

### Fixed

- Extension now activates properly when clicking sidebar icon or walkthrough commands
- Walkthrough "Get Started" button works in production builds
- Tasks are now properly linked to their parent features (no more orphaned tasks)
- Simple task creation auto-approves without opening review panel
- Whisper model auto-detection works across workspaces
- Proposal rejection continues the interview correctly

### Added

- Full-width proposal review panel in editor area (auto-opens when proposal ready)
- Interactive build script with publish options

## [0.0.1] - 2025-12-17

### Added

- Initial alpha release
- Task management with drag-and-drop prioritization
- Feature grouping for organizing tasks
- Voice capture with local whisper.cpp transcription
- AI-powered requirements interview via Claude Code
- MCP server integration for Claude Code task coordination
- SQLite storage via sql.js
- Project settings and design guide management
