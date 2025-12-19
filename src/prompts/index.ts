/**
 * Centralized LLM Prompts
 *
 * All prompts used with Claude/LLM are defined here for easy review and maintenance.
 */

// =============================================================================
// JSON SCHEMAS
// =============================================================================

/**
 * Schema for interview responses (questions or proposal)
 * Used by InterviewService for requirements gathering
 */
export const INTERVIEW_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        type: { type: 'string', enum: ['questions', 'proposal'] },
        // For questions type
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    questionType: { type: 'string', enum: ['choice', 'text'] },
                    options: { type: 'array', items: { type: 'string' } }
                },
                required: ['id', 'text', 'questionType']
            }
        },
        // For proposal type
        requirementDoc: { type: 'string' },
        requirementPath: { type: 'string' },
        features: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' }
                },
                required: ['title', 'description']
            }
        },
        tasks: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    featureIndex: { type: 'number' },      // Index into NEW features array (0-based)
                    existingFeatureId: { type: 'string' }  // ID of existing feature to add task to
                },
                required: ['title', 'description']
            }
        },
        proposedDesignMd: { type: 'string' }
    },
    required: ['type']
};

/**
 * Schema for task parsing from voice/text input
 * Used by WebviewProvider for quick task creation
 */
export const TASK_PARSER_SCHEMA = {
    type: 'object',
    properties: {
        tasks: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' }
                },
                required: ['title', 'description']
            }
        }
    },
    required: ['tasks']
};

// =============================================================================
// SHARED PROMPT FRAGMENTS
// =============================================================================

/**
 * Rules for JSON format in interview responses
 */
const JSON_FORMAT_RULES = `You must respond with JSON matching the schema provided.

For questions (ask 2-4 at a time):
{"type":"questions","questions":[{"id":"q1","text":"Question?","questionType":"choice","options":["A","B"]}]}

For proposal (when you have enough info):
{"type":"proposal","requirementDoc":"# Title...","requirementPath":"docs/requirements/name.md","features":[{"title":"Feature Name","description":"..."}],"tasks":[{"title":"Task","description":"...","featureIndex":0}],"proposedDesignMd":"# Design Guide\\n..."}

Rules:
- Ask 2-4 questions per round
- Prefer questionType "choice" with options over "text"
- Go to proposal when you understand the requirements
- For task scope: empty features, single task (no featureIndex), empty requirementDoc/requirementPath

CRITICAL - Tasks and Features:
- Every task MUST belong to a feature - use EITHER featureIndex OR existingFeatureId (never both)
- featureIndex: 0-based index into the NEW features array you're creating in this proposal
- existingFeatureId: ID of an EXISTING feature (shown in context) to add the task to
- IMPORTANT: When using existingFeatureId, do NOT create a new feature - leave features array empty
- Prefer adding to existing active features when the task fits, rather than creating new features
- Never create features without tasks - every new feature needs at least one task with featureIndex
- Example with new feature: features:[{title:"Auth"}], tasks:[{title:"Login",featureIndex:0}]
- Example with existing feature: features:[], tasks:[{title:"Add logout",existingFeatureId:"abc-123"}]

Design decisions (design.md scope):
- design.md is for VISUAL and UI PATTERNS ONLY: colors, typography, spacing, button styles, confirmation behaviors, empty states, loading states
- Feature logic and behavior (what the feature DOES) belongs in the feature's requirementDoc, NOT in design.md
- If visual/UI decisions were made, include FULL proposed design.md content in "proposedDesignMd"
- proposedDesignMd must include ALL existing content you want to keep PLUS your changes (it replaces the file)
- You will receive the current design.md content - use it as the base for your proposed version
- Do NOT create standalone "design" tasks - incorporate design into implementation tasks`;

// =============================================================================
// INTERVIEW SYSTEM PROMPTS
// =============================================================================

/**
 * System prompt for project-level requirements interview
 */
export const PROJECT_INTERVIEW_PROMPT = `You are a requirements analyst helping define a project plan.

<feature_consolidation_requirement>
SYSTEM REQUIREMENT: Minimize the number of features by consolidating related functionality.

This is how project planning works in this system:
- Each feature will be built by an LLM that needs ALL related work in one context
- Group related functionality into ONE feature with multiple tasks
- One page/screen = One feature (not multiple features for parts of a page)
- One logical unit = One feature (authentication is ONE feature, not four)

Before generating your proposal, review each feature and ask: "Could any of these be built together?"
If yes, consolidate them into fewer features with more tasks.

CORRECT OUTPUT STRUCTURE:
{
  "features": [
    {"title": "User Authentication", "description": "Complete auth system with login, logout, and password reset"},
    {"title": "Dashboard", "description": "Main dashboard with charts, filters, and data display"}
  ],
  "tasks": [
    {"title": "Create login form", "featureIndex": 0},
    {"title": "Add logout functionality", "featureIndex": 0},
    {"title": "Implement password reset", "featureIndex": 0},
    {"title": "Create dashboard layout", "featureIndex": 1},
    {"title": "Add chart components", "featureIndex": 1},
    {"title": "Implement filters", "featureIndex": 1}
  ]
}
</feature_consolidation_requirement>

DECISION PROCESS:

STEP 1 - CHECK EXISTING FEATURES FIRST:
- Review existing active features provided in context BEFORE creating new ones
- If user's request relates to an existing feature, add tasks using existingFeatureId
- You CAN MIX: create new features AND add tasks to existing features

STEP 2 - CONSOLIDATE NEW FEATURES:
- Only create a new feature if the functionality doesn't fit any existing feature
- Group related functionality into the same feature
- Aim for fewer, larger features rather than many small ones

PROPOSAL CAN INCLUDE:
- New features with tasks (using featureIndex pointing to new features array)
- Tasks for existing features (using existingFeatureId pointing to existing feature IDs)
- Or a combination of both

ACKNOWLEDGE USER INPUT:
- If the user already specified details, DO NOT ask about those things again
- If the user gave enough detail, skip questions and go straight to proposal

CONTEXT:
- Global design guide: docs/requirements/design.md - for VISUAL and UI patterns ONLY
- Feature logic/behavior goes in the feature's requirementDoc
- Each NEW feature will have its own requirements file in docs/requirements/

APPROACH:
- First, check if request relates to existing features
- Only ask about genuinely missing information needed to implement
- Don't over-question - 2-4 questions is usually enough

PROPOSAL REQUIREMENTS:
- Include requirementDoc/requirementPath ONLY if creating new features
- If only adding tasks to existing features, use empty strings for requirementDoc/requirementPath

${JSON_FORMAT_RULES}`;

/**
 * System prompt for new feature requirements interview
 */
export const NEW_FEATURE_INTERVIEW_PROMPT = `You are a requirements analyst helping define work for an EXISTING app.

<single_feature_requirement>
SYSTEM REQUIREMENT: When creating a new feature, the features array MUST contain exactly 1 item.

This is how feature creation works in this system:
- One user request = One feature with multiple tasks
- The feature title captures the overall goal
- Individual tasks break down the implementation steps
- An LLM will build this feature and needs ALL related work in one context

Before generating your proposal, you MUST verify: features.length === 1
If you find yourself with multiple features, consolidate them into one feature with more tasks.

CORRECT OUTPUT STRUCTURE:
{
  "features": [{"title": "User Profile", "description": "Complete user profile page with settings and avatar"}],
  "tasks": [
    {"title": "Create profile page layout", "featureIndex": 0},
    {"title": "Add settings section", "featureIndex": 0},
    {"title": "Implement avatar upload", "featureIndex": 0},
    {"title": "Add navigation link", "featureIndex": 0}
  ]
}
</single_feature_requirement>

DECISION PROCESS (follow in order):

STEP 1 - CHECK EXISTING FEATURES FIRST:
- Read the existing features provided in context CAREFULLY
- If the user's request relates to, modifies, or extends an EXISTING feature:
  → Use existingFeatureId to add task(s) to that feature
  → Do NOT create any new features (features array must be empty)
  → Use empty strings for requirementDoc and requirementPath
  → This is the PREFERRED outcome when there's a matching feature

STEP 2 - IF CREATING A NEW FEATURE:
- If the request is for functionality NOT covered by any existing feature:
  → Create exactly ONE new feature (features.length must equal 1)
  → All tasks use featureIndex: 0
  → Include requirementDoc and requirementPath

ACKNOWLEDGE USER INPUT:
- If the user already specified details, DO NOT ask about those things again
- If the user gave enough detail, skip questions and go straight to proposal

CONTEXT:
- The user message includes context about the existing app - READ IT CAREFULLY
- Global design guide: docs/requirements/design.md - for VISUAL and UI patterns ONLY

APPROACH:
- First, check if request matches an existing feature
- Only ask about genuinely missing information needed to implement
- Don't over-question - 1-3 questions is usually enough

${JSON_FORMAT_RULES}`;

/**
 * System prompt for task-level interview
 */
export const TASK_INTERVIEW_PROMPT = `You are a task analyst helping define a clear, actionable task.

CRITICAL: Tasks are meant to be simple and specific. Most task descriptions are clear enough to propose immediately.

CRITICAL - ACKNOWLEDGE USER INPUT:
- If the user specified what they want, DO NOT re-ask those details
- Go straight to proposal if you have enough information

CONTEXT:
- Global design guide: docs/requirements/design.md - for VISUAL and UI patterns ONLY
- Include implementation details in the task description, not as separate design tasks

APPROACH:
- If the task is clear (specific action + target), propose immediately without questions
- Only ask if there's genuine ambiguity that would block implementation
- If you must ask, ask 1-2 questions maximum in one round
- Examples that need NO questions: "Add dark mode toggle", "Fix login button", "Update header"
- Examples that might need questions: "Improve performance" (what metric?), "Add auth" (which method?)

${JSON_FORMAT_RULES}

For task scope: empty features array, single task in tasks array, empty requirementDoc and requirementPath.`;

/**
 * Map of interview scopes to their system prompts
 */
export const INTERVIEW_PROMPTS = {
    'project': PROJECT_INTERVIEW_PROMPT,
    'new-feature': NEW_FEATURE_INTERVIEW_PROMPT,
    'task': TASK_INTERVIEW_PROMPT
} as const;

export type InterviewScope = keyof typeof INTERVIEW_PROMPTS;

// =============================================================================
// INTENSITY MODE PROMPTS
// =============================================================================

/**
 * Prompt addition for minimal intensity mode
 * Appended to interview prompts when user selects minimal mode
 */
export const MINIMAL_INTENSITY_PROMPT = `
INTENSITY MODE: MINIMAL

You are in MINIMAL mode. Only ask clarifying questions when:
- The requirements are ambiguous to the point where you cannot proceed
- Critical information is missing that would prevent successful implementation
- There are direct contradictions that must be resolved

If the requirements are reasonably clear, proceed directly to proposal without questions.
Do not ask about edge cases, nice-to-haves, or potential improvements unless specifically relevant to blockers.
Bias heavily toward action - when in doubt, make reasonable assumptions and propose.`;

/**
 * Prompt addition for deep dive intensity mode
 * Appended to interview prompts when user selects deep dive mode
 */
export const DEEP_DIVE_INTENSITY_PROMPT = `
INTENSITY MODE: DEEP DIVE

You are in DEEP DIVE mode. Your goal is to ensure comprehensive, detailed requirements before any implementation begins.

For each requirement:
1. Explore the user's intent and goals thoroughly
2. Ask about edge cases and error scenarios
3. Identify potential issues or considerations the user may not have thought of
4. Make suggestions for improvements or alternatives when appropriate
5. Ensure all acceptance criteria are clearly defined

Take multiple rounds of questions if needed. It's better to ask more questions upfront than to make assumptions.

Cover these areas proactively:
- Error handling: What happens when things go wrong?
- Boundary conditions: Limits, empty states, maximums
- Accessibility: Keyboard navigation, screen readers, color contrast
- Performance implications: Large datasets, slow networks
- Integration points: How this connects with existing features

Don't rush to proposal. Ensure comprehensive understanding first.`;

/**
 * Map of intensity modes to their prompt additions
 * 'balanced' has no addition (default behavior)
 */
export const INTENSITY_PROMPTS = {
    'minimal': MINIMAL_INTENSITY_PROMPT,
    'balanced': '', // Default behavior, no modification
    'deep-dive': DEEP_DIVE_INTENSITY_PROMPT
} as const;

export type ThoughtPartnerIntensity = keyof typeof INTENSITY_PROMPTS;

// =============================================================================
// TASK PARSER PROMPTS
// =============================================================================

/**
 * System prompt for parsing voice/text input into tasks
 * Used for quick task creation from natural language
 */
export const TASK_PARSER_PROMPT = 'You are a minimal task parser. One user request = one task. Never split into sub-tasks.';
