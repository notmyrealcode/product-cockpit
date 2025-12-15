export type TaskStatus = 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';
export type TaskType = 'task' | 'bug';

export interface Task {
  id: string;
  feature_id: string | null;
  type: TaskType;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Feature {
  id: string;
  title: string;
  description: string | null;
  requirement_path: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string | null;
  description: string | null;
  requirement_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Requirement {
  path: string;
  title: string;
}

// Interview types
export interface InterviewQuestion {
  id: string;
  text: string;
  type: 'text' | 'choice';
  options?: string[];
}

export interface InterviewProposal {
  requirementDoc: string;
  requirementPath: string;
  features: { title: string; description: string }[];
  tasks: { title: string; description: string; featureIndex?: number }[];
}

export interface InterviewMessage {
  role: 'assistant' | 'user';
  content: string;
}

// Messages from extension to webview
export type ExtensionMessage =
  | { type: 'initialized'; project: Project | null; features: Feature[]; tasks: Task[]; requirements: Requirement[] }
  | { type: 'projectUpdated'; project: Project }
  | { type: 'featuresUpdated'; features: Feature[] }
  | { type: 'tasksUpdated'; tasks: Task[] }
  | { type: 'requirementsUpdated'; requirements: Requirement[] }
  | { type: 'recordingStarted' }
  | { type: 'recordingStopped' }
  | { type: 'voiceTranscribed'; tasks: { title: string; description: string }[] }
  | { type: 'voiceError'; error: string }
  | { type: 'buildStarted' }
  | { type: 'buildEnded' }
  | { type: 'settingsLoaded'; parserModel: string }
  // Interview messages
  | { type: 'interviewStarted'; sessionId: string; scope: string }
  | { type: 'interviewMessage'; message: InterviewMessage }
  | { type: 'interviewQuestion'; question: InterviewQuestion }
  | { type: 'interviewThinking' }
  | { type: 'interviewProposal'; proposal: InterviewProposal }
  | { type: 'interviewComplete'; requirementPath: string }
  | { type: 'interviewError'; error: string }
  | { type: 'interviewCancelled' };

// Messages from webview to extension
export type WebviewMessage =
  | { type: 'ready' }
  // Project
  | { type: 'updateProject'; updates: Partial<Project> }
  // Features
  | { type: 'addFeature'; title: string; description?: string }
  | { type: 'updateFeature'; id: string; updates: Partial<Feature> }
  | { type: 'deleteFeature'; id: string }
  | { type: 'reorderFeatures'; featureIds: string[] }
  // Tasks
  | { type: 'addTask'; title: string; description?: string; featureId?: string; taskType?: TaskType }
  | { type: 'updateTask'; id: string; updates: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'reorderTasks'; taskIds: string[] }
  | { type: 'moveTask'; taskId: string; featureId: string | null }
  | { type: 'archiveDone' }
  // Requirements / Interview
  | { type: 'startInterview'; scope: 'project' | 'new-feature' | 'task'; initialInput?: string }
  | { type: 'answerQuestion'; questionId: string; answer: string }
  | { type: 'approveProposal'; editedRequirementDoc?: string }
  | { type: 'rejectProposal'; feedback: string }
  | { type: 'cancelInterview' }
  | { type: 'openRequirement'; path: string }
  | { type: 'deleteRequirement'; path: string }
  // Voice & Build
  | { type: 'startRecording' }
  | { type: 'stopRecording' }
  | { type: 'buildTasks'; taskIds: string[] }
  | { type: 'resetBuild' }
  // Settings
  | { type: 'setParserModel'; model: string };
