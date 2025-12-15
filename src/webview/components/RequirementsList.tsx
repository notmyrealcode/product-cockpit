import React, { useState } from 'react';
import { FileText, Plus, Trash2, Palette, Pencil } from 'lucide-react';
import type { Requirement, Task } from '../types';

interface RequirementsListProps {
  requirements: Requirement[];
  tasks: Task[];
  onOpenRequirement: (path: string) => void;
  onDeleteRequirement: (path: string) => void;
  onStartInterview: () => void;
}

export function RequirementsList({
  requirements,
  tasks,
  onOpenRequirement,
  onDeleteRequirement,
  onStartInterview
}: RequirementsListProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Separate design.md from other requirements
  const designReq = requirements.find(r => r.path === 'docs/requirements/design.md');
  const otherRequirements = requirements.filter(r => r.path !== 'docs/requirements/design.md');

  // Count tasks linked to each requirement
  const getLinkedTaskCount = (reqPath: string) => {
    return tasks.filter(t => t.requirementPath === reqPath).length;
  };

  const handleDelete = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete === path) {
      onDeleteRequirement(path);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(path);
    }
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

      <div className="space-y-2">
        {/* Design Guide - always show at top */}
        {designReq && (
          <button
            onClick={() => onOpenRequirement(designReq.path)}
            className="w-full group flex items-center bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 hover:border-purple-300 transition-colors text-left"
          >
            <div className="flex-1 p-3">
              <div className="flex items-start gap-2">
                <Palette size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-purple-800 truncate">
                    {designReq.title}
                  </div>
                  <div className="text-xs text-purple-600/70 mt-0.5">
                    Colors, typography, UI patterns
                  </div>
                </div>
              </div>
            </div>
            <div className="p-2 mr-2 text-purple-400 group-hover:text-purple-600">
              <Pencil size={14} />
            </div>
          </button>
        )}

        {/* Other requirements */}
        {otherRequirements.length === 0 && !designReq ? (
          <div className="text-sm text-neutral-500 py-4 text-center border border-dashed border-neutral-200 rounded-md">
            No requirements yet. Click "New" to start an interview with Claude.
          </div>
        ) : (
          otherRequirements.map((req) => {
            const linkedCount = getLinkedTaskCount(req.path);
            const isConfirming = confirmDelete === req.path;
            return (
              <div
                key={req.path}
                className="group relative flex items-center bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-300 transition-colors"
              >
                <button
                  onClick={() => onOpenRequirement(req.path)}
                  className="flex-1 text-left p-3"
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
                <button
                  onClick={(e) => handleDelete(req.path, e)}
                  onBlur={() => setConfirmDelete(null)}
                  className={`p-2 mr-2 rounded transition-colors ${
                    isConfirming
                      ? 'bg-danger text-white'
                      : 'text-neutral-400 hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100'
                  }`}
                  title={isConfirming ? 'Click again to confirm' : 'Delete requirement'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
