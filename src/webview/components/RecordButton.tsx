import React, { useState, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { vscode } from '../lib/vscode';
import { cn } from '../lib/utils';

interface RecordButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function RecordButton({ onTranscript, className, size = 'sm' }: RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'recordingStarted':
          setIsRecording(true);
          break;
        case 'recordingStopped':
          setIsRecording(false);
          setIsProcessing(true);
          break;
        case 'voiceTranscribed':
          setIsProcessing(false);
          // Combine tasks into a single transcript
          if (message.tasks && message.tasks.length > 0) {
            const text = message.tasks.map((t: { title: string; description: string }) =>
              t.description ? `${t.title}: ${t.description}` : t.title
            ).join('\n');
            onTranscript(text);
          }
          break;
        case 'voiceError':
          setIsRecording(false);
          setIsProcessing(false);
          break;
        case 'showSetup':
          // Setup needed - stop loading states
          setIsRecording(false);
          setIsProcessing(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTranscript]);

  const handleClick = () => {
    if (isProcessing) return;

    if (isRecording) {
      vscode.postMessage({ type: 'stopRecording' });
    } else {
      vscode.postMessage({ type: 'startRecording' });
    }
  };

  const iconSize = size === 'sm' ? 14 : 16;
  const buttonSize = size === 'sm' ? 'h-9 w-9' : 'h-10 w-10';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isProcessing}
      className={cn(
        'flex items-center justify-center rounded transition-colors',
        buttonSize,
        isRecording
          ? 'bg-danger text-neutral-0 hover:bg-danger/90'
          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700',
        isProcessing && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={isRecording ? 'Stop recording' : 'Record voice'}
    >
      {isProcessing ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : isRecording ? (
        <Square size={iconSize} />
      ) : (
        <Mic size={iconSize} />
      )}
    </button>
  );
}
