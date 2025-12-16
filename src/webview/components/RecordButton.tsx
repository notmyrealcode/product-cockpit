import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { vscode } from '../lib/vscode';
import { cn } from '../lib/utils';

const MAX_RECORDING_SECONDS = 300; // 5 minutes

interface RecordButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  rawMode?: boolean;  // If true, returns raw transcript instead of parsed tasks
}

export function RecordButton({ onTranscript, className, size = 'sm', rawMode = false }: RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Format seconds as M:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start/stop timer based on recording state
  useEffect(() => {
    if (isRecording) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const next = prev + 1;
          // Auto-stop at max time
          if (next >= MAX_RECORDING_SECONDS) {
            vscode.postMessage({ type: 'stopRecording' });
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

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
          // Only handle if not in raw mode
          if (!rawMode) {
            setIsProcessing(false);
            // Combine tasks into a single transcript
            if (message.tasks && message.tasks.length > 0) {
              const text = message.tasks.map((t: { title: string; description: string }) =>
                t.description ? `${t.title}: ${t.description}` : t.title
              ).join('\n');
              onTranscript(text);
            }
          }
          break;
        case 'voiceRawTranscript':
          // Only handle if in raw mode
          if (rawMode) {
            setIsProcessing(false);
            if (message.transcript) {
              onTranscript(message.transcript);
            }
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
  }, [onTranscript, rawMode]);

  const handleClick = () => {
    if (isProcessing) return;

    if (isRecording) {
      vscode.postMessage({ type: 'stopRecording' });
    } else {
      vscode.postMessage({ type: 'startRecording', rawMode });
    }
  };

  const iconSize = size === 'sm' ? 14 : 16;
  const buttonSize = size === 'sm' ? 'h-9' : 'h-10';

  // When recording, show timer alongside stop button
  if (isRecording) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-xs font-mono text-danger tabular-nums">
          {formatTime(elapsedSeconds)} / {formatTime(MAX_RECORDING_SECONDS)}
        </span>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'flex items-center justify-center rounded transition-colors',
            buttonSize,
            size === 'sm' ? 'w-9' : 'w-10',
            'bg-danger text-neutral-0 hover:bg-danger/90'
          )}
          title="Stop recording"
        >
          <Square size={iconSize} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isProcessing}
      className={cn(
        'flex items-center justify-center rounded transition-colors',
        buttonSize,
        size === 'sm' ? 'w-9' : 'w-10',
        'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700',
        isProcessing && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={isProcessing ? 'Processing...' : 'Record voice'}
    >
      {isProcessing ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <Mic size={iconSize} />
      )}
    </button>
  );
}
