import { diffLines } from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const changes = diffLines(oldText || '', newText || '');
  const result: DiffLine[] = [];

  for (const change of changes) {
    const lines = change.value.split('\n');
    // Remove trailing empty string from split (last newline)
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    for (const line of lines) {
      if (change.added) {
        result.push({ type: 'added', content: line });
      } else if (change.removed) {
        result.push({ type: 'removed', content: line });
      } else {
        result.push({ type: 'unchanged', content: line });
      }
    }
  }

  return result;
}

export function hasChanges(oldText: string, newText: string): boolean {
  return (oldText || '').trim() !== (newText || '').trim();
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function getDiffStats(diffLines: DiffLine[]): DiffStats {
  return diffLines.reduce(
    (acc, line) => {
      acc[line.type]++;
      return acc;
    },
    { added: 0, removed: 0, unchanged: 0 }
  );
}
