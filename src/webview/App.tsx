import React, { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { vscode } from './lib/vscode';
import { TaskList } from './components/TaskList';
import { FeatureSection } from './components/FeatureSection';
import { AddTaskForm } from './components/AddTaskForm';
import { VoiceCapture } from './components/VoiceCapture';
import { RequirementsList } from './components/RequirementsList';
import { Button } from './components/ui';
import { Play, ChevronDown, ChevronRight, X, Settings, Plus } from 'lucide-react';
import type { Task, Feature, Requirement, TaskStatus, ExtensionMessage } from './types';

const PARSER_MODELS = [
  { id: 'haiku', name: 'Haiku', description: 'Fast & cheap' },
  { id: 'sonnet', name: 'Sonnet', description: 'Balanced' },
  { id: 'opus', name: 'Opus', description: 'Most capable' },
];

// Virtual feature for ungrouped tasks
const UNGROUPED_FEATURE: Feature = {
  id: '__ungrouped__',
  title: 'Ungrouped',
  description: null,
  requirement_path: null,
  priority: 999999,
  created_at: '',
  updated_at: '',
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [buildInProgress, setBuildInProgress] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parserModel, setParserModel] = useState('haiku');
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeatureTitle, setNewFeatureTitle] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Split tasks into active and done
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');

  // Group active tasks by feature
  const tasksByFeature = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    // Initialize with all features (even empty ones)
    features.forEach(f => grouped.set(f.id, []));
    grouped.set(UNGROUPED_FEATURE.id, []);

    activeTasks.forEach(task => {
      const featureId = task.feature_id || UNGROUPED_FEATURE.id;
      const existing = grouped.get(featureId) || [];
      existing.push(task);
      grouped.set(featureId, existing);
    });

    // Sort tasks within each feature by priority
    grouped.forEach((tasks, key) => {
      grouped.set(key, tasks.sort((a, b) => a.priority - b.priority));
    });

    return grouped;
  }, [features, activeTasks]);

  // All draggable items (features + tasks)
  const allDraggableIds = useMemo(() => {
    const ids: string[] = [];
    features.forEach(f => {
      ids.push(f.id);
      const featureTasks = tasksByFeature.get(f.id) || [];
      featureTasks.forEach(t => ids.push(t.id));
    });
    // Add ungrouped tasks
    const ungroupedTasks = tasksByFeature.get(UNGROUPED_FEATURE.id) || [];
    ungroupedTasks.forEach(t => ids.push(t.id));
    return ids;
  }, [features, tasksByFeature]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'initialized':
          setTasks(message.tasks);
          setFeatures(message.features);
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
        case 'featuresUpdated':
          setFeatures(message.features);
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

  // Feature handlers
  const handleAddFeature = () => {
    if (!newFeatureTitle.trim()) return;
    vscode.postMessage({ type: 'addFeature', title: newFeatureTitle.trim() });
    setNewFeatureTitle('');
    setShowAddFeature(false);
  };

  const handleFeatureEdit = (id: string, title: string, description: string) => {
    vscode.postMessage({ type: 'updateFeature', id, updates: { title, description: description || null } });
  };

  const handleFeatureDelete = (id: string) => {
    vscode.postMessage({ type: 'deleteFeature', id });
  };

  const handleBuildFeature = (featureId: string) => {
    if (buildInProgress) return;
    const featureTasks = tasksByFeature.get(featureId) || [];
    const todoTasks = featureTasks.filter(t => t.status === 'todo' || t.status === 'in-progress');
    if (todoTasks.length === 0) return;
    vscode.postMessage({ type: 'buildTasks', taskIds: todoTasks.map(t => t.id) });
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // Check if dragging a task
    if (tasks.some(t => t.id === active.id)) {
      setActiveTaskId(active.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check what we're dragging
    const draggedTask = tasks.find(t => t.id === activeId);
    const draggedFeature = features.find(f => f.id === activeId);

    if (draggedTask) {
      // Dragging a task
      const overTask = tasks.find(t => t.id === overId);
      const overFeature = features.find(f => f.id === overId);

      if (overTask) {
        // Dropping on another task - reorder within same feature or move to new feature
        const targetFeatureId = overTask.feature_id;
        if (draggedTask.feature_id !== targetFeatureId) {
          // Move to different feature
          vscode.postMessage({
            type: 'moveTask',
            taskId: draggedTask.id,
            featureId: targetFeatureId
          });
        }
        // Reorder tasks
        const featureTasks = tasksByFeature.get(targetFeatureId || UNGROUPED_FEATURE.id) || [];
        const oldIndex = featureTasks.findIndex(t => t.id === activeId);
        const newIndex = featureTasks.findIndex(t => t.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(featureTasks, oldIndex, newIndex);
          vscode.postMessage({ type: 'reorderTasks', taskIds: newOrder.map(t => t.id) });
        }
      } else if (overFeature || overId === UNGROUPED_FEATURE.id) {
        // Dropping on a feature header - move task to that feature
        const newFeatureId = overId === UNGROUPED_FEATURE.id ? null : overId;
        if (draggedTask.feature_id !== newFeatureId) {
          vscode.postMessage({
            type: 'moveTask',
            taskId: draggedTask.id,
            featureId: newFeatureId
          });
        }
      }
    } else if (draggedFeature) {
      // Dragging a feature - reorder features
      const overFeature = features.find(f => f.id === overId);
      if (overFeature) {
        const oldIndex = features.findIndex(f => f.id === activeId);
        const newIndex = features.findIndex(f => f.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(features, oldIndex, newIndex);
          vscode.postMessage({ type: 'reorderFeatures', featureIds: newOrder.map(f => f.id) });
        }
      }
    }
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

      {/* Add Task / Feature buttons */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <AddTaskForm onAdd={handleAddTask} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowAddFeature(!showAddFeature)}
          className="h-9 px-3 text-xs whitespace-nowrap"
        >
          <Plus size={14} className="mr-1" />
          Feature
        </Button>
      </div>

      {/* Add Feature form */}
      {showAddFeature && (
        <div className="mb-4 p-3 bg-neutral-0 border border-neutral-200 rounded-lg">
          <div className="flex gap-2">
            <input
              type="text"
              value={newFeatureTitle}
              onChange={(e) => setNewFeatureTitle(e.target.value)}
              placeholder="Feature name..."
              className="flex-1 text-sm bg-neutral-0 border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddFeature();
                if (e.key === 'Escape') setShowAddFeature(false);
              }}
            />
            <Button size="sm" onClick={handleAddFeature} disabled={!newFeatureTitle.trim()}>
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAddFeature(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

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

      {/* Features and tasks with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allDraggableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {/* Features */}
            {features.map((feature) => (
              <FeatureSection
                key={feature.id}
                feature={feature}
                tasks={tasksByFeature.get(feature.id) || []}
                selectedIds={selectedTaskIds}
                buildDisabled={buildInProgress}
                onSelectTask={handleSelectTask}
                onBuildTask={handleBuildTask}
                onBuildFeature={handleBuildFeature}
                onTaskStatusChange={handleStatusChange}
                onTaskTitleChange={handleTitleChange}
                onTaskDescriptionChange={handleDescriptionChange}
                onTaskDelete={handleDelete}
                onFeatureEdit={handleFeatureEdit}
                onFeatureDelete={handleFeatureDelete}
              />
            ))}

            {/* Ungrouped tasks */}
            {(tasksByFeature.get(UNGROUPED_FEATURE.id)?.length ?? 0) > 0 && (
              <FeatureSection
                feature={UNGROUPED_FEATURE}
                tasks={tasksByFeature.get(UNGROUPED_FEATURE.id) || []}
                selectedIds={selectedTaskIds}
                buildDisabled={buildInProgress}
                isUngrouped
                onSelectTask={handleSelectTask}
                onBuildTask={handleBuildTask}
                onTaskStatusChange={handleStatusChange}
                onTaskTitleChange={handleTitleChange}
                onTaskDescriptionChange={handleDescriptionChange}
                onTaskDelete={handleDelete}
              />
            )}

            {/* Empty state */}
            {features.length === 0 && activeTasks.length === 0 && (
              <div className="text-center py-12 border border-dashed border-neutral-200 rounded-lg bg-neutral-0">
                <p className="text-sm text-neutral-500">No tasks or features yet</p>
                <p className="text-xs text-neutral-400 mt-1">Add a task or create a feature to get started</p>
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

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
