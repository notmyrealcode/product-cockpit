import React, { useState, useEffect } from 'react';
import { vscode } from './lib/vscode';
import { TaskList } from './components/TaskList';
import { AddTaskForm } from './components/AddTaskForm';
import { VoiceCapture } from './components/VoiceCapture';
import { RequirementsList } from './components/RequirementsList';
import { Button } from './components/ui';
import { Play, ChevronDown, ChevronRight, X, Settings } from 'lucide-react';
import type { Task, Requirement, TaskStatus, ExtensionMessage } from './types';

const PARSER_MODELS = [
  { id: 'haiku', name: 'Haiku', description: 'Fast & cheap' },
  { id: 'sonnet', name: 'Sonnet', description: 'Balanced' },
  { id: 'opus', name: 'Opus', description: 'Most capable' },
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [buildInProgress, setBuildInProgress] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parserModel, setParserModel] = useState('haiku');

  // Split tasks into active and done
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'initialized':
          setTasks(message.tasks);
          setRequirements(message.requirements);
          break;
        case 'tasksUpdated':
          setTasks(message.tasks);
          // Clear selection for tasks that no longer exist
          setSelectedTaskIds(prev => {
            const taskIds = new Set(message.tasks.map((t: Task) => t.id));
            const newSelection = new Set<string>();
            prev.forEach(id => { if (taskIds.has(id)) newSelection.add(id); });
            return newSelection;
          });
          break;
        case 'requirementsUpdated':
          setRequirements(message.requirements);
          break;
        case 'buildStarted':
          setBuildInProgress(true);
          break;
        case 'buildEnded':
          setBuildInProgress(false);
          setSelectedTaskIds(new Set()); // Clear selection after build
          break;
        case 'settingsLoaded':
          setParserModel(message.parserModel);
          break;
        // voiceTranscribed and voiceError are handled by VoiceCapture component directly
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleAddTask = (title: string, description: string) => {
    vscode.postMessage({ type: 'addTask', title, description });
  };

  const handleReorder = (taskIds: string[]) => {
    vscode.postMessage({ type: 'reorderTasks', taskIds });
  };

  const handleStatusChange = (id: string, status: TaskStatus) => {
    vscode.postMessage({ type: 'updateTask', id, updates: { status } });
  };

  const handleTitleChange = (id: string, title: string) => {
    vscode.postMessage({ type: 'updateTask', id, updates: { title } });
  };

  const handleDescriptionChange = (id: string, description: string) => {
    vscode.postMessage({ type: 'updateTask', id, updates: { description } });
  };

  const handleDelete = (id: string) => {
    vscode.postMessage({ type: 'deleteTask', id });
  };

  const handleArchiveDone = () => {
    vscode.postMessage({ type: 'archiveDone' });
  };

  const handleStartInterview = () => {
    vscode.postMessage({ type: 'startInterview' });
  };

  const handleOpenRequirement = (path: string) => {
    vscode.postMessage({ type: 'openRequirement', path });
  };

  const handleVoiceTasksCreated = (voiceTasks: { title: string; description: string }[]) => {
    voiceTasks.forEach(task => {
      vscode.postMessage({ type: 'addTask', title: task.title, description: task.description });
    });
  };

  const handleSelectTask = (id: string, selected: boolean) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleBuildTask = (id: string) => {
    if (buildInProgress) return;
    vscode.postMessage({ type: 'buildTasks', taskIds: [id] });
  };

  const handleBuildSelected = () => {
    if (buildInProgress || selectedTaskIds.size === 0) return;
    // Build in priority order (as displayed)
    const orderedIds = tasks
      .filter(t => selectedTaskIds.has(t.id))
      .map(t => t.id);
    vscode.postMessage({ type: 'buildTasks', taskIds: orderedIds });
    setSelectedTaskIds(new Set()); // Clear selection immediately
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.size === activeTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(activeTasks.map(t => t.id)));
    }
  };

  const handleResetBuild = () => {
    vscode.postMessage({ type: 'resetBuild' });
  };

  const handleParserModelChange = (model: string) => {
    setParserModel(model);
    vscode.postMessage({ type: 'setParserModel', model });
  };

  return (
    // Shepherd: Section padding p-6, backgrounds neutral-0/50/100
    <div className="p-4 min-h-screen bg-neutral-50">
      {/* Shepherd: Section title text-xl font-semibold */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-800">Product Cockpit</h1>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          {activeTasks.length} {activeTasks.length === 1 ? 'task' : 'tasks'} • Drag to prioritize
        </p>
      </header>

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-neutral-900/60"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative bg-neutral-0 rounded-lg shadow-lg p-4 w-72">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-800">Settings</h3>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 mb-2 block">
                Task Parser Model
              </label>
              <div className="space-y-1.5">
                {PARSER_MODELS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => handleParserModelChange(model.id)}
                    className={`w-full px-3 py-2 text-left text-xs rounded-md border transition-colors ${
                      parserModel === model.id
                        ? 'bg-primary/10 text-primary border-primary'
                        : 'bg-neutral-0 text-neutral-600 border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <span className="font-medium">{model.name}</span>
                    <span className="text-neutral-400 ml-2">{model.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <AddTaskForm onAdd={handleAddTask} />
      <VoiceCapture onTasksCreated={handleVoiceTasksCreated} />

      {/* Selection actions bar */}
      {activeTasks.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs text-neutral-500 hover:text-neutral-700"
            >
              {selectedTaskIds.size === activeTasks.length ? 'Deselect all' : 'Select all'}
            </button>
            {selectedTaskIds.size > 0 && (
              <span className="text-xs text-neutral-400">
                {selectedTaskIds.size} selected
              </span>
            )}
          </div>
          {selectedTaskIds.size > 0 && (
            <Button
              size="sm"
              onClick={handleBuildSelected}
              disabled={buildInProgress}
              className="h-7 px-3 text-xs gap-1.5"
            >
              <Play size={12} />
              Build {selectedTaskIds.size > 1 ? `${selectedTaskIds.size} tasks` : 'task'}
            </Button>
          )}
        </div>
      )}

      {buildInProgress && (
        <div className="mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md flex items-center justify-between">
          <p className="text-xs text-primary font-medium">
            Build in progress... Claude is working on your tasks.
          </p>
          <button
            onClick={handleResetBuild}
            className="text-xs text-primary/60 hover:text-primary flex items-center gap-1"
            title="Reset build state if out of sync"
          >
            <X size={12} />
            Reset
          </button>
        </div>
      )}

      <TaskList
        tasks={activeTasks}
        selectedIds={selectedTaskIds}
        buildDisabled={buildInProgress}
        onSelect={handleSelectTask}
        onBuild={handleBuildTask}
        onReorder={handleReorder}
        onStatusChange={handleStatusChange}
        onTitleChange={handleTitleChange}
        onDescriptionChange={handleDescriptionChange}
        onDelete={handleDelete}
      />

      {/* Archive section for done tasks */}
      {doneTasks.length > 0 && (
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <button
            onClick={() => setArchiveExpanded(!archiveExpanded)}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-3"
          >
            {archiveExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Done ({doneTasks.length})</span>
          </button>
          {archiveExpanded && (
            <>
              <div className="flex justify-end mb-2">
                <button
                  onClick={handleArchiveDone}
                  className="text-xs text-neutral-500 hover:text-danger"
                >
                  Delete all done
                </button>
              </div>
              <div className="opacity-60">
                <TaskList
                  tasks={doneTasks}
                  onReorder={() => {}} // No reordering for done tasks
                  onStatusChange={handleStatusChange}
                  onTitleChange={handleTitleChange}
                  onDescriptionChange={handleDescriptionChange}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}
        </div>
      )}

      <RequirementsList
        requirements={requirements}
        tasks={tasks}
        onOpenRequirement={handleOpenRequirement}
        onStartInterview={handleStartInterview}
      />
    </div>
  );
}
