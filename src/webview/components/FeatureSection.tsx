import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, GripVertical, Play, Pencil, Trash2, Check, X, FileText } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { Button } from './ui';
import { Tooltip } from './Tooltip';
import { cn } from '../lib/utils';
import type { Feature, Task, TaskStatus } from '../types';

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
  onOpenRequirement?: (path: string) => void;
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
  onOpenRequirement,
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
          'flex items-center gap-2 px-3 py-2 bg-neutral-50 border-b border-neutral-200',
          !isUngrouped && 'cursor-pointer hover:bg-neutral-100'
        )}
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        {/* Drag handle for features (not ungrouped) */}
        {!isUngrouped && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-neutral-300 hover:text-neutral-500 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder"
          >
            <GripVertical size={16} />
          </button>
        )}

        {/* Expand/Collapse */}
        <button
          className="text-neutral-400 hover:text-neutral-600"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Title */}
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="flex-1 text-sm font-semibold text-neutral-800 bg-neutral-0 border border-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="h-6 w-6 text-success hover:bg-success/10"
            >
              <Check size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancelEdit}
              className="h-6 w-6 text-neutral-500 hover:text-neutral-700"
            >
              <X size={14} />
            </Button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-sm font-semibold text-neutral-800 flex items-center gap-2">
              {!isUngrouped && (
                <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">Feature</span>
              )}
              {feature.title}
              {!isUngrouped && (
                <span className="text-[10px] font-mono text-neutral-400">
                  #{feature.id.slice(0, 4).toUpperCase()}
                </span>
              )}
            </span>

            {/* Task counts */}
            <span className="text-xs text-neutral-400">
              {tasks.length === 0 ? 'empty' : (
                <>
                  {todoCount > 0 && <span>{todoCount} todo</span>}
                  {todoCount > 0 && inProgressCount > 0 && ' • '}
                  {inProgressCount > 0 && <span className="text-primary">{inProgressCount} in progress</span>}
                  {todoCount === 0 && inProgressCount === 0 && `${tasks.length} tasks`}
                </>
              )}
            </span>

            {/* Action buttons */}
            {!isUngrouped && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Requirement doc link */}
                {feature.requirement_path && onOpenRequirement && (
                  <Tooltip content="Open requirements">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onOpenRequirement(feature.requirement_path!)}
                      className="h-7 w-7 text-neutral-400 hover:text-primary hover:bg-primary/10"
                    >
                      <FileText size={14} />
                    </Button>
                  </Tooltip>
                )}
                {onBuildFeature && tasks.length > 0 && (
                  <Tooltip content={buildDisabled ? "Build in progress..." : "Build all tasks"}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onBuildFeature(feature.id)}
                      disabled={buildDisabled}
                      className={cn(
                        'h-7 w-7',
                        buildDisabled
                          ? 'text-neutral-200 cursor-not-allowed'
                          : 'text-neutral-400 hover:text-success hover:bg-success/10'
                      )}
                    >
                      <Play size={14} />
                    </Button>
                  </Tooltip>
                )}
                <Tooltip content="Edit">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="h-7 w-7 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
                  >
                    <Pencil size={14} />
                  </Button>
                </Tooltip>
                {onFeatureDelete && (
                  <Tooltip content="Delete">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onFeatureDelete(feature.id)}
                      className="h-7 w-7 text-neutral-400 hover:text-danger hover:bg-danger/10"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Tooltip>
                )}
              </div>
            )}
          </>
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
