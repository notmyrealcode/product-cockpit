import React, { useState, useEffect } from 'react';
import { vscode } from './lib/vscode';
import type { Task, ExtensionMessage } from './types';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'initialized':
        case 'tasksUpdated':
          setTasks(message.tasks);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ type: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">Tasks ({tasks.length})</h1>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="p-3 rounded border border-vscode-border bg-vscode-input-bg"
          >
            <div className="font-medium">{task.description}</div>
            <div className="text-sm opacity-70">{task.status}</div>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-center opacity-50 py-8">No tasks yet</div>
        )}
      </div>
    </div>
  );
}
