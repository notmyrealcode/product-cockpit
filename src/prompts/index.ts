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
                    featureIndex: { type: 'number' }  // Index into features array (0-based)
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
- Every task MUST have a featureIndex linking it to a feature (0-based index into features array)
- Never create standalone tasks when features exist - all tasks belong to a feature
- Never create features without tasks - every feature needs at least one task
- Example: features:[{title:"Auth"}], tasks:[{title:"Login form",featureIndex:0},{title:"Logout",featureIndex:0}]

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

CRITICAL - ACKNOWLEDGE USER INPUT:
- If the user already specified details (colors, features, behavior), DO NOT ask about those things again
- Only ask about things the user has NOT already told you
- If the user gave enough detail, skip questions and go straight to proposal

CONTEXT:
- Global design guide: docs/requirements/design.md - for VISUAL and UI patterns ONLY (colors, typography, spacing, confirmation behaviors, empty states)
- Feature logic/behavior goes in the feature's requirementDoc
- Each feature will have its own requirements file in docs/requirements/

APPROACH:
- First, acknowledge what the user already specified
- Only ask about genuinely missing information needed to implement
- Prefer multiple-choice questions when possible
- Don't over-question - 2-4 questions is usually enough

PROPOSAL REQUIREMENTS:
- ALWAYS include a non-empty requirementDoc with markdown describing the project
- ALWAYS include a requirementPath like "docs/requirements/project-name.md"

${JSON_FORMAT_RULES}`;

/**
 * System prompt for new feature requirements interview
 */
export const NEW_FEATURE_INTERVIEW_PROMPT = `You are a requirements analyst helping define a new feature for an EXISTING app.

CRITICAL - ACKNOWLEDGE USER INPUT:
- If the user already specified details (colors, behavior, implementation), DO NOT ask about those things again
- Only ask about things the user has NOT already told you
- If the user gave enough detail, skip questions and go straight to proposal

CONTEXT:
- The user message includes context about the existing app - READ IT CAREFULLY
- Global design guide: docs/requirements/design.md - for VISUAL and UI patterns ONLY (colors, typography, spacing, confirmation behaviors, empty states)
- Feature logic/behavior goes in the feature's requirementDoc
- This feature will get its own requirements file in docs/requirements/

APPROACH:
- First, acknowledge what the user already specified
- Only ask about genuinely missing information needed to implement
- Prefer multiple-choice questions when possible
- Don't over-question - 1-3 questions is usually enough for a feature
- Visual/UI patterns → design.md, feature logic/behavior → feature requirements

PROPOSAL REQUIREMENTS:
- ALWAYS include a non-empty requirementDoc with markdown describing the feature
- ALWAYS include a requirementPath like "docs/requirements/feature-name.md"

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
// TASK PARSER PROMPTS
// =============================================================================

/**
 * System prompt for parsing voice/text input into tasks
 * Used for quick task creation from natural language
 */
export const TASK_PARSER_PROMPT = 'You are a minimal task parser. One user request = one task. Never split into sub-tasks.';
