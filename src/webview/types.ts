export type TaskStatus = 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';
export type TaskType = 'task' | 'bug';
export type FeatureStatus = 'active' | 'done';
export type ThoughtPartnerIntensity = 'minimal' | 'balanced' | 'deep-dive';

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
  status: FeatureStatus;
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
  tasks: {
    title: string;
    description: string;
    featureIndex?: number;        // Index into NEW features array (from this proposal)
    existingFeatureId?: string;   // ID of existing feature to add task to
  }[];
  proposedDesignMd?: string;  // Complete proposed design.md content (replaces existing)
}

export interface InterviewMessage {
  role: 'assistant' | 'user';
  content: string;
}

// Extension info
export interface ExtensionInfo {
  version: string;
  name: string;
}

// Messages from extension to webview
export type ExtensionMessage =
  | { type: 'initialized'; project: Project | null; features: Feature[]; tasks: Task[]; requirements: Requirement[]; extensionInfo: ExtensionInfo }
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
  | { type: 'settingsLoaded'; parserModel: string; taskDeliveryMode: string }
  // Interview messages
  | { type: 'interviewStarted'; sessionId: string; scope: string }
  | { type: 'interviewMessage'; message: InterviewMessage }
  | { type: 'interviewQuestion'; question: InterviewQuestion }
  | { type: 'interviewThinking' }
  | { type: 'interviewProposal'; proposal: InterviewProposal; currentDesignMd?: string }
  | { type: 'interviewComplete'; requirementPath: string }
  | { type: 'interviewError'; error: string }
  | { type: 'interviewCancelled' }
  | { type: 'showToast'; message: string; toastType?: 'success' | 'error' | 'info' };

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
  | { type: 'markFeatureDone'; id: string }
  // Tasks
  | { type: 'addTask'; title: string; description?: string; featureId?: string; taskType?: TaskType }
  | { type: 'updateTask'; id: string; updates: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'reorderTasks'; taskIds: string[] }
  | { type: 'moveTask'; taskId: string; featureId: string | null }
  | { type: 'archiveDone' }
  // Requirements / Interview
  | { type: 'startInterview'; scope: 'project' | 'new-feature' | 'task'; initialInput?: string; intensity?: ThoughtPartnerIntensity }
  | { type: 'answerQuestion'; questionId: string; answer: string }
  | { type: 'approveProposal'; editedRequirementDoc?: string; editedDesignChanges?: string; removedFeatureIndices?: number[]; removedTaskIndices?: number[] }
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
  | { type: 'setParserModel'; model: string }
  | { type: 'setTaskDeliveryMode'; mode: string };
