# Rework Feedback

## Summary
When a PM marks a task for rework, they must provide feedback explaining what needs to be fixed. This feedback is appended directly to the task description, making it immediately visible to AI agents without any schema changes.

## User Stories

### US-1: Provide Rework Feedback
**As a** PM reviewing a completed task  
**I want to** provide feedback when marking it for rework  
**So that** the AI agent knows exactly what needs to be fixed

**Acceptance Criteria:**
- When changing status to "rework", a text input modal appears
- The modal requires non-empty feedback before confirming
- Feedback is appended to the task description with a timestamp
- The status change is blocked until feedback is provided

### US-2: View Rework History
**As a** PM  
**I want to** see what rework has been requested  
**So that** I can track feedback over multiple cycles

**Acceptance Criteria:**
- Rework feedback appears in the task description
- Multiple rework requests accumulate in the description
- Each entry includes a timestamp for context

## Description Format

When rework is requested, append to the existing description:

```
---
**Rework requested** (Jan 15, 2025 2:30 PM):
Form validation not working for email field
```

If rework is requested again:

```
---
**Rework requested** (Jan 15, 2025 2:30 PM):
Form validation not working for email field

---
**Rework requested** (Jan 16, 2025 10:00 AM):
Still missing password strength indicator
```

## UI Behavior

### Rework Feedback Modal
- Triggered when user selects "rework" status
- Simple modal with:
  - Title: "What needs to be reworked?"
  - Textarea for feedback (required, min 10 characters)
  - Cancel button (returns to previous status)
  - Submit button (disabled until valid input)
- On submit: append feedback to description, then change status

## MCP Behavior

No changes needed - `get_task` and `get_next_task` already return the task description, which now includes rework context.
