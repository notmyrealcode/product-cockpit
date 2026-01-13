import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, GripVertical, Play, Pencil, Trash2, Check, X, FileText, Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Button } from './ui';
import { cn } from '../lib/utils';
import type { Feature, Task, TaskStatus, FeatureStatus } from '../types';

const featureStatusLabels: Record<FeatureStatus, string> = {
  'active': 'Active',
  'done': 'Done'
};

const featureStatusColors: Record<FeatureStatus, string> = {
  'active': 'bg-primary/10 text-primary border-primary/20',
  'done': 'bg-success/10 text-success border-success/20'
};

const featureStatusOptions: FeatureStatus[] = ['active', 'done'];

interface FeatureSectionProps {
  feature: Feature;
  tasks: Task[];
  selectedIds?: Set<string>;
  buildDisabled?: boolean;
  isUngrouped?: boolean;
  defaultExpanded?: boolean;
  onSelectTask?: (id: string, selected: boolean) => void;
  onBuildTask?: (id: string) => void;
  onBuildFeature?: (featureId: string) => void;
  onTaskStatusChange: (id: string, status: TaskStatus) => void;
  onTaskTitleChange: (id: string, title: string) => void;
  onTaskDescriptionChange: (id: string, description: string) => void;
  onTaskDelete: (id: string) => void;
  onFeatureEdit?: (id: string, title: string, description: string) => void;
  onFeatureDelete?: (id: string) => void;
  onFeatureStatusChange?: (id: string, status: FeatureStatus) => void;
  onOpenRequirement?: (path: string) => void;
  onAddTask?: (featureId: string) => void;
}

export function FeatureSection({
  feature,
  tasks,
  selectedIds,
  buildDisabled,
  isUngrouped = false,
  defaultExpanded = true,
  onSelectTask,
  onBuildTask,
  onBuildFeature,
  onTaskStatusChange,
  onTaskTitleChange,
  onTaskDescriptionChange,
  onTaskDelete,
  onFeatureEdit,
  onFeatureDelete,
  onFeatureStatusChange,
  onOpenRequirement,
  onAddTask,
}: FeatureSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(feature.title);
  const [editDescription, setEditDescription] = useState(feature.description || '');

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: feature.id,
    disabled: isUngrouped,
  });

  // Make the feature a drop target for tasks
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: feature.id,
  });

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in-progress').length;

  const handleSaveEdit = () => {
    if (onFeatureEdit && editTitle.trim()) {
      onFeatureEdit(feature.id, editTitle.trim(), editDescription.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(feature.title);
    setEditDescription(feature.description || '');
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border border-neutral-200 rounded-lg bg-neutral-0 overflow-hidden',
        isDragging && 'shadow-drag border-primary',
        isOver && !isDragging && 'border-primary bg-primary/5'
      )}
    >
      {/* Feature Header */}
      <div
        className={cn(
          'px-3 py-2 bg-neutral-50 border-b border-neutral-200',
          !isUngrouped && 'cursor-pointer hover:bg-neutral-100'
        )}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        {/* Top row: drag, expand, title */}
        <div className="flex items-center gap-1.5">
          {/* Drag handle for features (not ungrouped) */}
          {!isUngrouped && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab text-neutral-300 hover:text-neutral-500 focus:outline-none shrink-0"
              onClick={(e) => e.stopPropagation()}
              aria-label="Drag to reorder"
            >
              <GripVertical size={14} />
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            className="text-neutral-400 hover:text-neutral-600 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Title */}
          {isEditing ? (
            <div className="flex-1 flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 min-w-0 text-sm font-semibold text-neutral-800 bg-neutral-0 border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveEdit}
                className="h-6 w-6 text-success hover:bg-success/10 shrink-0"
              >
                <Check size={12} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancelEdit}
                className="h-6 w-6 text-neutral-500 hover:text-neutral-700 shrink-0"
              >
                <X size={12} />
              </Button>
            </div>
          ) : (
            <>
              <span className="flex-1 min-w-0 text-sm font-semibold text-neutral-800 truncate">
                {feature.title}
              </span>

              {/* Task counts - compact */}
              <span className="text-[10px] text-neutral-400 shrink-0">
                {todoCount > 0 ? `${todoCount} todo` : tasks.length > 0 ? `${tasks.length}` : ''}
              </span>
            </>
          )}
        </div>

        {/* Bottom row: status dropdown + action buttons (only for features, not ungrouped) */}
        {!isUngrouped && !isEditing && (
          <div className="flex items-center justify-between mt-1 -mr-1" onClick={(e) => e.stopPropagation()}>
            {/* Status dropdown */}
            {onFeatureStatusChange && (
              <div className="relative inline-flex items-center">
                <select
                  value={feature.status}
                  onChange={(e) => onFeatureStatusChange(feature.id, e.target.value as FeatureStatus)}
                  className={cn(
                    'text-[10px] font-medium rounded-full pl-2 pr-6 py-0.5 border cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                    'transition-fast appearance-none',
                    featureStatusColors[feature.status]
                  )}
                >
                  {featureStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {featureStatusLabels[status]}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-1.5 pointer-events-none opacity-60"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-0.5">
              {onAddTask && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onAddTask(feature.id)}
                  className="h-6 w-6 text-neutral-400 hover:text-primary hover:bg-primary/10"
                >
                  <Plus size={12} />
                </Button>
              )}
              {feature.requirement_path && onOpenRequirement && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenRequirement(feature.requirement_path!)}
                  className="h-6 w-6 text-neutral-400 hover:text-primary hover:bg-primary/10"
                >
                  <FileText size={12} />
                </Button>
              )}
              {onBuildFeature && tasks.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onBuildFeature(feature.id)}
                  disabled={buildDisabled}
                  className={cn(
                    'h-6 w-6',
                    buildDisabled
                      ? 'text-neutral-200 cursor-not-allowed'
                      : 'text-neutral-400 hover:text-success hover:bg-success/10'
                  )}
                >
                  <Play size={12} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-6 w-6 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
              >
                <Pencil size={12} />
              </Button>
              {onFeatureDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onFeatureDelete(feature.id)}
                  className="h-6 w-6 text-neutral-400 hover:text-danger hover:bg-danger/10"
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tasks */}
      {isExpanded && (
        <div className="p-3">
          {tasks.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">
              {isUngrouped ? 'No ungrouped tasks' : 'No tasks in this feature'}
            </p>
          ) : (
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={selectedIds?.has(task.id)}
                    buildDisabled={buildDisabled}
                    onSelect={onSelectTask}
                    onBuild={onBuildTask}
                    onStatusChange={onTaskStatusChange}
                    onTitleChange={onTaskTitleChange}
                    onDescriptionChange={onTaskDescriptionChange}
                    onDelete={onTaskDelete}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}
