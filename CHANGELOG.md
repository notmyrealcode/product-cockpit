# Changelog

All notable changes to Shepherd will be documented in this file.

## [0.0.7] - 2025-12-19

### Added

- Version number display in About modal
- Support for adding tasks to existing features via `existingFeatureId`
- Proposal review now shows "Adding to Existing" section for tasks going to existing features
- Interview context now includes feature IDs, status, and planned (todo) task titles

### Changed

- Prompts now prioritize adding tasks to existing features before creating new ones
- Only active features (not done) are sent to Claude during interviews
- Intensity selector moved above input and made more compact for better fit in short windows
- Proposal header shows clearer summary (e.g., "1 new feature, 2 tasks to existing")

### Fixed

- Fixed bug where Claude would create empty new features when adding tasks to existing features

## [0.0.6] - 2025-12-19

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
