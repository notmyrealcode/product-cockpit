import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../types';

interface TaskListProps {
  tasks: Task[];
  selectedIds?: Set<string>;
  buildDisabled?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onBuild?: (id: string) => void;
  onReorder: (taskIds: string[]) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onTitleChange: (id: string, title: string) => void;
  onDescriptionChange: (id: string, description: string) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, selectedIds, buildDisabled, onSelect, onBuild, onReorder, onStatusChange, onTitleChange, onDescriptionChange, onDelete }: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(tasks, oldIndex, newIndex);
      onReorder(newOrder.map((t) => t.id));
    }
  };

  if (tasks.length === 0) {
    return (
      // Shepherd: Use calm, minimal empty state
      <div className="text-center py-12 border border-dashed border-neutral-200 rounded-lg bg-neutral-0">
        <p className="text-sm text-neutral-500">No tasks yet</p>
        <p className="text-xs text-neutral-400 mt-1">Add a task to get started</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              selected={selectedIds?.has(task.id)}
              buildDisabled={buildDisabled}
              onSelect={onSelect}
              onBuild={onBuild}
              onStatusChange={onStatusChange}
              onTitleChange={onTitleChange}
              onDescriptionChange={onDescriptionChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
