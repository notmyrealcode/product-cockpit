import React, { useState, useRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from './ui';

interface AddTaskFormProps {
  onAdd: (title: string, description: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function AddTaskForm({ onAdd, onCancel, placeholder = 'New task...', autoFocus = false }: AddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isExpanded, setIsExpanded] = useState(autoFocus);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim(), description.trim());
      setTitle('');
      setDescription('');
      setIsExpanded(false);
    }
  };

  const handleTitleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only collapse if clicking outside the form entirely and no onCancel provided
    if (onCancel) return; // Don't auto-collapse if used inline
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('form')) {
      if (!title.trim() && !description.trim()) {
        setIsExpanded(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} onBlur={handleBlur} onKeyDown={handleKeyDown} className={onCancel ? '' : 'mb-3 bg-neutral-0 border border-neutral-200 rounded-md p-2'}>
      <div className="flex gap-1.5">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={handleTitleFocus}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 bg-transparent border border-neutral-300 rounded px-3 py-2 text-sm font-medium text-neutral-800
                     placeholder:text-neutral-400
                     focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="sm" disabled={!title.trim()} className="shrink-0 h-9 px-3">
          <Plus size={14} />
          <span className="ml-1">Add</span>
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="shrink-0 h-9 px-2">
            Cancel
          </Button>
        )}
      </div>

      {isExpanded && (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)..."
          rows={2}
          className="w-full mt-2 bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-xs text-neutral-600
                     placeholder:text-neutral-400
                     hover:border-neutral-300
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                     transition-fast resize-none"
        />
      )}
    </form>
  );
}
