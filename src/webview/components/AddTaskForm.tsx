import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui';
import { RecordButton } from './RecordButton';

interface AddTaskFormProps {
  onAdd: (title: string, description: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  showRecord?: boolean;
}

export function AddTaskForm({
  onAdd,
  onCancel,
  placeholder = 'New task...',
  autoFocus = false,
  showRecord = false
}: AddTaskFormProps) {
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

  const handleTranscript = (text: string) => {
    // Use transcript as title (truncate if too long)
    const lines = text.split('\n');
    if (lines.length > 1) {
      setTitle(lines[0].slice(0, 100));
      setDescription(lines.slice(1).join('\n'));
      setIsExpanded(true);
    } else {
      setTitle(text.slice(0, 100));
      if (text.length > 100) {
        setDescription(text);
        setIsExpanded(true);
      }
    }
    titleInputRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleSubmit}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={onCancel ? '' : 'mb-3 bg-neutral-0 border border-neutral-200 rounded-md p-2'}
    >
      {/* Input row */}
      <div className="flex gap-1.5">
        {showRecord && (
          <RecordButton onTranscript={handleTranscript} size="sm" />
        )}
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={handleTitleFocus}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 bg-transparent border border-neutral-300 rounded px-2 py-2 text-sm font-medium text-neutral-800
                     placeholder:text-neutral-400
                     focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Buttons row - separate line for narrow widths */}
      <div className="flex gap-1.5 mt-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 px-2 text-xs">
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!title.trim()} className="h-8 px-3 text-xs">
          <Plus size={12} />
          <span className="ml-1">Add</span>
        </Button>
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
