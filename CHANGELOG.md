# Changelog

All notable changes to Shepherd will be documented in this file.

## [Unreleased]

### Added

- Mark feature as done - marks the feature and all its tasks as done in one click
- Thought partner intensity selector (Minimal/Balanced/Deep Dive) for interview customization
- Database migration system for seamless extension updates
- Added ability to provide details about rework needed for a task

### Changed

- Rework feedback now appears at top of task descriptions so LLMs see it first

## [0.0.5] - 2025-12-18

### Fixed

- Extension now activates properly when clicking sidebar icon or walkthrough commands
- Walkthrough "Get Started" button works in production builds
- Tasks are now properly linked to their parent features (no more orphaned tasks)
- Simple task creation auto-approves without opening review panel
- Whisper model auto-detection works across workspaces
- Proposal rejection continues the interview correctly
- Show helpful message when no workspace is open instead of non-functional UI

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
