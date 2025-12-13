export type TaskStatus = 'todo' | 'in-progress' | 'ready-for-signoff' | 'done' | 'rework';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  requirementPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Requirement {
  path: string;
  title: string;
}

// Messages from extension to webview
export type ExtensionMessage =
  | { type: 'tasksUpdated'; tasks: Task[] }
  | { type: 'requirementsUpdated'; requirements: Requirement[] }
  | { type: 'initialized'; tasks: Task[]; requirements: Requirement[] }
  | { type: 'recordingStarted' }
  | { type: 'recordingStopped' }
  | { type: 'voiceTranscribed'; tasks: { title: string; description: string }[] }
  | { type: 'voiceError'; error: string }
  | { type: 'buildStarted' }
  | { type: 'buildEnded' }
  | { type: 'settingsLoaded'; parserModel: string };

// Messages from webview to extension
export type WebviewMessage =
  | { type: 'addTask'; title: string; description: string }
  | { type: 'updateTask'; id: string; updates: Partial<Task> }
  | { type: 'deleteTask'; id: string }
  | { type: 'reorderTasks'; taskIds: string[] }
  | { type: 'archiveDone' }
  | { type: 'startInterview' }
  | { type: 'openRequirement'; path: string }
  | { type: 'startRecording' }
  | { type: 'stopRecording' }
  | { type: 'buildTasks'; taskIds: string[] }
  | { type: 'resetBuild' }
  | { type: 'setParserModel'; model: string }
  | { type: 'ready' };
