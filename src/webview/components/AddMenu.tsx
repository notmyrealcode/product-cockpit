import React, { useState, useRef, useEffect } from 'react';
import { Plus, FileText, ListTodo, Bug, ChevronDown, MessageSquare, FolderKanban } from 'lucide-react';
import { Button } from './ui';
import { cn } from '../lib/utils';

interface AddMenuProps {
  onAddTask: () => void;
  onAddBug: () => void;
  onAddFeature: () => void;
  onInterviewTask: () => void;
  onInterviewFeature: () => void;
  onInterviewProject: () => void;
}

export function AddMenu({
  onAddTask,
  onAddBug,
  onAddFeature,
  onInterviewTask,
  onInterviewFeature,
  onInterviewProject,
}: AddMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 px-3 gap-1.5"
        title="Add tasks, features, or start an interview"
      >
        <Plus size={14} />
        Add
        <ChevronDown size={12} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-neutral-0 border border-neutral-200 rounded-lg shadow-lg z-50 py-1">
          {/* Interactive section (with Claude) */}
          <div className="px-2 py-1">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide px-2 mb-1">
              Interactive
            </p>
            <button
              onClick={() => handleSelect(onInterviewTask)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
              title="Describe a task and Claude will help refine it"
            >
              <MessageSquare size={14} className="text-primary" />
              <span className="flex-1 text-left">
                Task
                <span className="text-[10px] text-neutral-400 ml-1">— describe & refine</span>
              </span>
            </button>
            <button
              onClick={() => handleSelect(onInterviewFeature)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
              title="Define a feature with requirements and tasks"
            >
              <MessageSquare size={14} className="text-primary" />
              <span className="flex-1 text-left">
                Feature
                <span className="text-[10px] text-neutral-400 ml-1">— requirements + tasks</span>
              </span>
            </button>
            <button
              onClick={() => handleSelect(onInterviewProject)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
              title="Plan your entire project with Claude"
            >
              <FileText size={14} className="text-primary" />
              <span className="flex-1 text-left">
                Project Plan
                <span className="text-[10px] text-neutral-400 ml-1">— full roadmap</span>
              </span>
            </button>
          </div>

          <div className="border-t border-neutral-100 my-1" />

          {/* Quick section */}
          <div className="px-2 py-1">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide px-2 mb-1">
              Quick
            </p>
            <button
              onClick={() => handleSelect(onAddTask)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
              title="Add a task without AI assistance"
            >
              <ListTodo size={14} className="text-neutral-400" />
              Task
            </button>
            <button
              onClick={() => handleSelect(onAddBug)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
              title="Log a bug to fix"
            >
              <Bug size={14} className="text-danger" />
              Bug
            </button>
            <button
              onClick={() => handleSelect(onAddFeature)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
              title="Create an empty feature group"
            >
              <FolderKanban size={14} className="text-neutral-400" />
              Feature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
