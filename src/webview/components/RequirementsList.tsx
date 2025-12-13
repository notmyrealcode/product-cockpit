import React from 'react';
import { FileText, Plus } from 'lucide-react';
import type { Requirement, Task } from '../types';

interface RequirementsListProps {
  requirements: Requirement[];
  tasks: Task[];
  onOpenRequirement: (path: string) => void;
  onStartInterview: () => void;
}

export function RequirementsList({
  requirements,
  tasks,
  onOpenRequirement,
  onStartInterview
}: RequirementsListProps) {
  // Count tasks linked to each requirement
  const getLinkedTaskCount = (reqPath: string) => {
    return tasks.filter(t => t.requirementPath === reqPath).length;
  };

  return (
    <div className="mt-6">
      {/* Shepherd: Section title text-base font-medium */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium text-neutral-800">Requirements</h2>
        <button
          onClick={onStartInterview}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {requirements.length === 0 ? (
        <div className="text-sm text-neutral-500 py-4 text-center border border-dashed border-neutral-200 rounded-md">
          No requirements yet. Click "New" to start an interview with Claude.
        </div>
      ) : (
        <div className="space-y-2">
          {requirements.map((req) => {
            const linkedCount = getLinkedTaskCount(req.path);
            return (
              <button
                key={req.path}
                onClick={() => onOpenRequirement(req.path)}
                className="w-full text-left p-3 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <FileText size={16} className="text-neutral-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-800 truncate">
                      {req.title}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {req.path}
                      {linkedCount > 0 && (
                        <span className="ml-2 text-primary">
                          {linkedCount} {linkedCount === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
