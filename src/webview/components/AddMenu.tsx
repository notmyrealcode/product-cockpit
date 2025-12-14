import React, { useState, useRef, useEffect } from 'react';
import { Plus, FileText, ListTodo, Bug, ChevronDown } from 'lucide-react';
import { Button } from './ui';
import { cn } from '../lib/utils';

interface AddMenuProps {
  onAddTask: () => void;
  onAddBug: () => void;
  onAddFeature: () => void;
  onNewFeatureWithRequirements: () => void;
}

export function AddMenu({
  onAddTask,
  onAddBug,
  onAddFeature,
  onNewFeatureWithRequirements,
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
      >
        <Plus size={14} />
        Add
        <ChevronDown size={12} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-neutral-0 border border-neutral-200 rounded-lg shadow-lg z-50 py-1">
          {/* Task section */}
          <div className="px-2 py-1">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide px-2 mb-1">
              Tasks
            </p>
            <button
              onClick={() => handleSelect(onAddTask)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
            >
              <ListTodo size={14} className="text-neutral-400" />
              New Task
            </button>
            <button
              onClick={() => handleSelect(onAddBug)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
            >
              <Bug size={14} className="text-danger" />
              New Bug
            </button>
          </div>

          <div className="border-t border-neutral-100 my-1" />

          {/* Feature section */}
          <div className="px-2 py-1">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide px-2 mb-1">
              Features
            </p>
            <button
              onClick={() => handleSelect(onAddFeature)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded"
            >
              <Plus size={14} className="text-neutral-400" />
              New Feature
            </button>
            <button
              onClick={() => handleSelect(onNewFeatureWithRequirements)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded group"
            >
              <FileText size={14} className="text-primary" />
              <span className="flex-1 text-left">
                New Feature
                <span className="text-[10px] text-primary ml-1">(with Requirements)</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
