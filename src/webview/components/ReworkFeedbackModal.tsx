import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ReworkFeedbackModalProps {
  taskTitle: string;
  onSubmit: (feedback: string) => void;
  onCancel: () => void;
}

const MIN_FEEDBACK_LENGTH = 10;

export function ReworkFeedbackModal({
  taskTitle,
  onSubmit,
  onCancel,
}: ReworkFeedbackModalProps) {
  const [feedback, setFeedback] = useState('');

  const isValid = feedback.trim().length >= MIN_FEEDBACK_LENGTH;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onSubmit(feedback.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-2">
      <div className="bg-neutral-0 rounded-lg shadow-sm border border-neutral-200 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-800">
            What needs to be reworked?
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-neutral-100 transition-fast"
          >
            <X size={18} className="text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-3">
            <p className="text-sm text-neutral-500">
              Provide feedback for: <span className="font-medium text-neutral-700">{taskTitle}</span>
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe what needs to be fixed or changed..."
              className="w-full h-32 px-3 py-2 text-sm border border-neutral-200 rounded-md bg-neutral-0 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              autoFocus
            />
            <p className="text-xs text-neutral-400">
              {feedback.trim().length < MIN_FEEDBACK_LENGTH
                ? `Minimum ${MIN_FEEDBACK_LENGTH} characters required (${feedback.trim().length}/${MIN_FEEDBACK_LENGTH})`
                : `${feedback.trim().length} characters`}
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-fast"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-fast"
            >
              Submit Feedback
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
