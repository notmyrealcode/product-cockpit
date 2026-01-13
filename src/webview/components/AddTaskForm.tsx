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
  placeholder = 'Describe the task...',
  autoFocus = false,
  showRecord = false
}: AddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showTitle, setShowTitle] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && descriptionRef.current) {
      descriptionRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      onAdd(title.trim(), description.trim());
      setTitle('');
      setDescription('');
      setShowTitle(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  const handleTranscript = (text: string) => {
    // Use full transcript as description
    setDescription(text);
    descriptionRef.current?.focus();
  };

  const handleShowTitle = () => {
    setShowTitle(true);
    // Focus title input after it renders
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className={onCancel ? '' : 'mb-3 bg-neutral-0 border border-neutral-200 rounded-md p-2'}
    >
      {/* Optional title field */}
      {showTitle && (
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)..."
          className="w-full mb-2 bg-transparent border border-neutral-300 rounded px-2 py-1.5 text-sm font-medium text-neutral-800
                     placeholder:text-neutral-400
                     focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}

      {/* Description textarea row */}
      <div className="flex gap-1.5">
        {showRecord && (
          <RecordButton onTranscript={handleTranscript} size="sm" />
        )}
        <textarea
          ref={descriptionRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={2}
          className="flex-1 min-w-0 bg-transparent border border-neutral-300 rounded px-2 py-2 text-sm text-neutral-800
                     placeholder:text-neutral-400
                     focus:outline-none focus:ring-2 focus:ring-primary
                     resize-none"
        />
      </div>

      {/* Buttons row */}
      <div className="flex gap-1.5 mt-2 justify-between items-center">
        <div>
          {!showTitle && (
            <button
              type="button"
              onClick={handleShowTitle}
              className="text-xs text-neutral-500 hover:text-primary"
            >
              + Add title
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8 px-2 text-xs">
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!description.trim()} className="h-8 px-3 text-xs">
            <Plus size={12} />
            <span className="ml-1">Add</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
