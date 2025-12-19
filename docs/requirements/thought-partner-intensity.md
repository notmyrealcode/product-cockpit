# Thought Partner Intensity Selection

## Overview
Add a selection option to the interactive task/project modal that allows users to choose how engaged they want Shepherd to be as a thought partner during the requirements interview process.

## User Story
As a user starting an interactive task, I want to choose how thoroughly Shepherd explores my requirements so that I can get quick execution for clear tasks or comprehensive guidance for complex ones.

## Feature Description

### Intensity Levels

#### 1. Minimal
- **Behavior**: Only ask questions when there's a distinct lack of clarity
- **Question frequency**: Zero to several questions depending on clarity
- **Use case**: Quick tasks where the user knows exactly what they want
- **Prompt guidance**: Focus on execution, only interrupt if requirements are ambiguous or incomplete to the point where work cannot proceed

#### 2. Balanced (Default)
- **Behavior**: Current behavior - asks clarifying questions to ensure understanding
- **Question frequency**: Moderate number of questions
- **Use case**: Standard tasks where some clarification helps
- **Prompt guidance**: Current prompting behavior (no changes needed)

#### 3. Deep Dive
- **Behavior**: Thoroughly explores requirements, asks detailed questions, makes suggestions, covers edge cases
- **Question frequency**: Multiple rounds of questions expected
- **Use case**: Complex features, architectural decisions, or when user wants comprehensive requirements
- **Prompt guidance**: Explore requirements in detail, proactively suggest considerations, identify edge cases, ensure comprehensive coverage before proceeding

### UI Design

The modal displays three card-style options arranged horizontally:

```
┌─────────────────────────────────────────────────────────────────────┐
│  How involved should Shepherd be?                                   │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │    Minimal      │  │    Balanced     │  │   Deep Dive     │     │
│  │                 │  │   ✓ (selected)  │  │                 │     │
│  │  Quick start,   │  │  Clarifying     │  │  Thorough       │     │
│  │  questions only │  │  questions to   │  │  exploration,   │     │
│  │  when unclear   │  │  ensure we're   │  │  suggestions,   │     │
│  │                 │  │  aligned        │  │  edge cases     │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│                                        [Cancel]  [Start Interview] │
└─────────────────────────────────────────────────────────────────────┘
```

### Card Specifications (per Design Style Guide)

- **Card style**: Border neutral-200, radius 6px, padding p-4
- **Selected state**: Primary border (#3A6F74) or ring
- **Hover state**: Neutral-50 background
- **Typography**: 
  - Title: text-base / font-medium
  - Description: text-sm / text-neutral-500
- **Spacing**: gap-3 between cards

## Data Model

### ThoughtPartnerIntensity Enum
```typescript
type ThoughtPartnerIntensity = 'minimal' | 'balanced' | 'deep-dive';
```

### Storage
- Store the selected intensity with the task/interview session
- Optionally persist last-used preference per user (default: 'balanced')

## Prompts

### Minimal Mode Prompt Addition
```
You are in MINIMAL mode. Only ask clarifying questions when:
- The requirements are ambiguous to the point where you cannot proceed
- Critical information is missing that would prevent successful implementation
- There are direct contradictions that must be resolved

If the requirements are reasonably clear, proceed directly without questions.
Do not ask about edge cases, nice-to-haves, or potential improvements unless specifically relevant to blockers.
```

### Deep Dive Mode Prompt Addition
```
You are in DEEP DIVE mode. Your goal is to ensure comprehensive, detailed requirements before any implementation begins.

For each requirement:
1. Explore the user's intent and goals thoroughly
2. Ask about edge cases and error scenarios
3. Identify potential issues or considerations the user may not have thought of
4. Make suggestions for improvements or alternatives when appropriate
5. Ensure all acceptance criteria are clearly defined

Take multiple rounds of questions if needed. It's better to ask more questions upfront than to make assumptions.
Cover: error handling, boundary conditions, accessibility, performance implications, and integration points.
```

## Implementation Notes

1. The modal component needs to be updated to include the intensity selector
2. The selected intensity should be passed to the interview/prompt generation logic
3. Prompts should be modified based on the selected intensity
4. Consider storing user's preferred default in extension settings