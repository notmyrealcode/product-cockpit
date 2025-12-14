import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Pencil, Check, X, ChevronDown, Play } from 'lucide-react';
import { Button } from './ui';
import { cn } from '../lib/utils';
import type { Task, TaskStatus } from '../types';

interface TaskCardProps {
  task: Task;
  selected?: boolean;
  buildDisabled?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onBuild?: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onTitleChange: (id: string, title: string) => void;
  onDescriptionChange: (id: string, description: string) => void;
  onDelete: (id: string) => void;
}

const statusLabels: Record<TaskStatus, string> = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'ready-for-signoff': 'Review',
  'done': 'Done',
  'rework': 'Rework'
};

const statusColors: Record<TaskStatus, string> = {
  'todo': 'bg-neutral-100 text-neutral-600 border-neutral-200',
  'in-progress': 'bg-primary/10 text-primary border-primary/20',
  'ready-for-signoff': 'bg-purple-100 text-purple-700 border-purple-200',
  'done': 'bg-success/10 text-success border-success/20',
  'rework': 'bg-danger/10 text-danger border-danger/20'
};

const statusOptions: TaskStatus[] = ['todo', 'in-progress', 'ready-for-signoff', 'done', 'rework'];

export function TaskCard({ task, selected, buildDisabled, onSelect, onBuild, onStatusChange, onTitleChange, onDescriptionChange, onDelete }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editTitle.trim() !== task.title) {
      onTitleChange(task.id, editTitle.trim());
    }
    if (editDescription.trim() !== (task.description || '')) {
      onDescriptionChange(task.id, editDescription.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
    // Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-neutral-0 border border-neutral-200 rounded-md p-4',
        'transition-fast',
        'hover:border-neutral-300 hover:bg-neutral-50',
        isDragging && 'shadow-drag border-primary bg-neutral-0'
      )}
    >
      {isEditing ? (
        /* Combined edit mode - title + description together */
        <div className="max-h-[50vh] overflow-y-auto">
          <div className="space-y-3">
            {/* Title input */}
            <div>
              <label className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1 block">
                Title
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full text-sm font-semibold text-neutral-800 bg-neutral-0 border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Task title..."
              />
            </div>

            {/* Description textarea */}
            <div>
              <label className="text-[10px] font-medium text-neutral-500 uppercase tracking-wide mb-1 block">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                className="w-full text-sm text-neutral-600 bg-neutral-0 border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="Add description..."
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className="h-8 text-xs text-success hover:bg-success/10"
                >
                  <Check size={14} className="mr-1" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-8 text-xs text-neutral-500 hover:text-neutral-700"
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
              </div>
              <span className="text-[10px] text-neutral-400">
                ⌘+Enter to save • Esc to cancel
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* View mode */
        <div className="flex items-start gap-3">
          {/* Selection checkbox */}
          {onSelect && (
            <input
              type="checkbox"
              checked={selected || false}
              onChange={(e) => onSelect(task.id, e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary cursor-pointer"
              aria-label="Select task"
            />
          )}

          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab text-neutral-300 hover:text-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            aria-label="Drag to reorder"
          >
            <GripVertical size={18} />
          </button>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Task title */}
            <div className="flex items-center gap-2">
              <p
                className="text-sm font-semibold text-neutral-800 leading-snug cursor-pointer hover:text-primary"
                onClick={handleStartEdit}
                title="Click to edit"
              >
                {task.title}
              </p>
              <span className="text-[10px] font-mono text-neutral-400" title={`ID: ${task.id}`}>
                #{task.id.slice(0, 4)}
              </span>
            </div>

            {/* Task description - collapsed by default */}
            {task.description ? (
              <p
                className={cn(
                  "text-xs leading-relaxed text-neutral-600 mt-1 cursor-pointer hover:text-neutral-800",
                  !isDescriptionExpanded && "line-clamp-1"
                )}
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                title={isDescriptionExpanded ? "Click to collapse" : "Click to expand"}
              >
                {task.description}
              </p>
            ) : (
              <p
                className="text-xs leading-relaxed mt-1 cursor-pointer text-neutral-400 italic hover:text-neutral-500"
                onClick={handleStartEdit}
                title="Click to add description"
              >
                Add description...
              </p>
            )}
          </div>

          {/* Right column: action buttons + status */}
          <div className="flex flex-col items-end gap-2 -mr-1 -mt-1">
            {/* Action buttons */}
            <div className="flex items-center gap-1">
              {onBuild && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onBuild(task.id)}
                  disabled={buildDisabled}
                  className={cn(
                    "h-8 w-8",
                    buildDisabled
                      ? "text-neutral-200 cursor-not-allowed"
                      : "text-neutral-300 hover:text-success hover:bg-success/10"
                  )}
                  aria-label="Build with Claude"
                  title={buildDisabled ? "Build in progress..." : "Build with Claude"}
                >
                  <Play size={14} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStartEdit}
                className="h-8 w-8 text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100"
                aria-label="Edit task"
              >
                <Pencil size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(task.id)}
                className="h-8 w-8 text-neutral-300 hover:text-danger hover:bg-danger/10"
                aria-label="Delete task"
              >
                <Trash2 size={14} />
              </Button>
            </div>

            {/* Status dropdown - under action buttons */}
            <div className="relative inline-flex items-center">
              <select
                value={task.status}
                onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
                className={cn(
                  'text-[11px] font-medium rounded-full pl-2.5 pr-7 py-1 border cursor-pointer',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                  'transition-fast appearance-none',
                  statusColors[task.status]
                )}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2 pointer-events-none opacity-60"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
