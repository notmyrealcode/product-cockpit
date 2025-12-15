import React from 'react';
import { computeDiff, getDiffStats } from '../lib/diff';
import { cn } from '../lib/utils';

interface DiffViewProps {
  oldText: string;
  newText: string;
  className?: string;
}

export function DiffView({ oldText, newText, className }: DiffViewProps) {
  const diffLines = computeDiff(oldText || '', newText || '');
  const stats = getDiffStats(diffLines);

  // Handle case where both are empty
  if (!oldText && !newText) {
    return (
      <div className={cn('rounded border border-neutral-200 p-3 text-xs text-neutral-500', className)}>
        No content
      </div>
    );
  }

  // Handle case where old is empty (all new content)
  if (!oldText && newText) {
    return (
      <div className={cn('rounded border border-neutral-200 overflow-hidden', className)}>
        <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-b border-neutral-200 text-xs">
          <span className="font-medium text-neutral-600">design.md changes</span>
          <span className="text-success">+{stats.added} lines (new file)</span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <pre className="text-xs font-mono">
            {diffLines.map((line, idx) => (
              <div key={idx} className="px-3 py-0.5 bg-success/10 text-success">
                <span className="inline-block w-4 mr-2 text-success/60 select-none">+</span>
                {line.content || ' '}
              </div>
            ))}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded border border-neutral-200 overflow-hidden', className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-b border-neutral-200 text-xs">
        <span className="font-medium text-neutral-600">design.md changes</span>
        <div className="flex gap-3">
          {stats.added > 0 && <span className="text-success">+{stats.added}</span>}
          {stats.removed > 0 && <span className="text-danger">-{stats.removed}</span>}
          {stats.added === 0 && stats.removed === 0 && (
            <span className="text-neutral-400">no changes</span>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="max-h-64 overflow-y-auto">
        <pre className="text-xs font-mono">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                'px-3 py-0.5',
                line.type === 'added' && 'bg-success/10 text-success',
                line.type === 'removed' && 'bg-danger/10 text-danger line-through',
                line.type === 'unchanged' && 'text-neutral-600'
              )}
            >
              <span className={cn(
                'inline-block w-4 mr-2 select-none',
                line.type === 'added' && 'text-success/60',
                line.type === 'removed' && 'text-danger/60',
                line.type === 'unchanged' && 'text-neutral-300'
              )}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              {line.content || ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
