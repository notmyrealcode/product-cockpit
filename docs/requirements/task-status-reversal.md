# Task Status Reversal

## Overview
Allow users to change a task's status back to any previous state, including returning completed tasks to "todo".

## Behavior

### Status Change Actions
- Tasks in any status can be moved to any other valid status
- Available statuses: `todo`, `in-progress`, `ready-for-signoff`, `done`, `rework`
- The UI should provide a way to revert tasks back to earlier states

### UI Interaction
- Add status change controls accessible from task items
- Could be implemented as:
  - A dropdown/select showing all available statuses
  - Context menu with status options
  - Or status-specific action buttons

### Use Cases
- Mark a "done" task back to "todo" if work needs to be redone
- Move an "in-progress" task back to "todo" if deprioritized
- Change "ready-for-signoff" back to "in-progress" if issues found

## Technical Notes
- Leverages existing `update_task_status` MCP tool
- No new data model changes required - just UI to expose bidirectional status changes
