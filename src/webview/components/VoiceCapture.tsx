import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, ChevronDown, ChevronUp, X, Type } from 'lucide-react';
import { Button } from './ui';
import { cn } from '../lib/utils';
import { vscode } from '../lib/vscode';

type CaptureState = 'idle' | 'recording' | 'processing' | 'reviewing' | 'text-input' | 'setup';

const MAX_RECORDING_SECONDS = 120; // 2 minutes

interface ParsedTask {
  title: string;
  description: string;
}

interface VoiceCaptureProps {
  onTasksCreated: (tasks: ParsedTask[]) => void;
}

export function VoiceCapture({ onTasksCreated }: VoiceCaptureProps) {
  const [state, setState] = useState<CaptureState>('idle');
  const [duration, setDuration] = useState(0);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [inputText, setInputText] = useState('');
  const [setupNeeds, setSetupNeeds] = useState<{ sox: boolean; whisperBinary: boolean; whisperModel: boolean }>({ sox: false, whisperBinary: false, whisperModel: false });
  const [platform, setPlatform] = useState<'darwin' | 'win32' | 'linux'>('darwin');
  const [processingStatus, setProcessingStatus] = useState<string>('Processing...');

  const timerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'recordingStarted':
          setState('recording');
          setDuration(0);
          setError(null);
          timerRef.current = window.setInterval(() => {
            setDuration(d => {
              const newDuration = d + 1;
              // Auto-stop at max duration
              if (newDuration >= MAX_RECORDING_SECONDS) {
                vscode.postMessage({ type: 'stopRecording' });
              }
              return newDuration;
            });
          }, 1000);
          break;
        case 'recordingStopped':
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setProcessingStatus('Processing...');
          setState('processing');
          break;
        case 'processingStatus':
          setProcessingStatus(message.status);
          break;
        case 'voiceTranscribed':
          setState('reviewing');
          setParsedTasks(message.tasks || []);
          break;
        case 'voiceError':
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setError(message.error);
          setState('idle');
          break;
        case 'showSetup':
          setSetupNeeds({
            sox: message.needsSox,
            whisperBinary: message.needsWhisperBinary,
            whisperModel: message.needsWhisperModel
          });
          setPlatform(message.platform || 'darwin');
          setState('setup');
          setError(null);
          break;
        case 'setupComplete':
          setState('idle');
          setError(null);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleStartRecording = useCallback(() => {
    setError(null);
    vscode.postMessage({ type: 'startRecording' });
  }, []);

  const handleStopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    vscode.postMessage({ type: 'stopRecording' });
  }, []);

  const handleToggleRecording = useCallback(() => {
    if (state === 'recording') {
      handleStopRecording();
    } else if (state === 'idle') {
      handleStartRecording();
    }
  }, [state, handleStartRecording, handleStopRecording]);

  const handleOpenTextInput = useCallback(() => {
    setState('text-input');
    setInputText('');
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const handleCloseTextInput = useCallback(() => {
    setState('idle');
    setInputText('');
  }, []);

  const handleCloseSetup = useCallback(() => {
    setState('idle');
  }, []);

  const handleInstallSox = useCallback(() => {
    vscode.postMessage({ type: 'installSox' });
  }, []);

  const handleInstallWhisper = useCallback((method: 'homebrew' | 'source') => {
    vscode.postMessage({ type: 'installWhisper', method });
  }, []);

  const handleCheckSetup = useCallback(() => {
    console.log('[VoiceCapture] Sending checkSetup message');
    vscode.postMessage({ type: 'checkSetup' });
  }, []);

  const handleDownloadModel = useCallback(() => {
    vscode.postMessage({ type: 'downloadModel' });
  }, []);

  const handleProcessText = useCallback(() => {
    if (!inputText.trim()) return;
    setProcessingStatus('Organizing into tasks...');
    setState('processing');
    vscode.postMessage({ type: 'processText', text: inputText.trim() });
  }, [inputText]);

  const handleConfirmTasks = useCallback(() => {
    onTasksCreated(parsedTasks);
    setParsedTasks([]);
    setExpandedIndex(null);
    setState('idle');
  }, [parsedTasks, onTasksCreated]);

  const handleCancelReview = useCallback(() => {
    setParsedTasks([]);
    setExpandedIndex(null);
    setState('idle');
  }, []);

  const handleRemoveTask = useCallback((index: number) => {
    setParsedTasks(tasks => tasks.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  }, [expandedIndex]);

  const handleToggleExpand = useCallback((index: number) => {
    setExpandedIndex(prev => prev === index ? null : index);
  }, []);

  const handleUpdateTask = useCallback((index: number, field: 'title' | 'description', value: string) => {
    setParsedTasks(tasks => tasks.map((task, i) =>
      i === index ? { ...task, [field]: value } : task
    ));
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Setup mode - show installation instructions
  if (state === 'setup') {
    const isMac = platform === 'darwin';
    const isWindows = platform === 'win32';
    const isLinux = platform === 'linux';

    return (
      <div className="mb-4 bg-neutral-0 border border-neutral-200 rounded-md p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-neutral-800">
            Voice Recording Setup
          </span>
          <button
            onClick={handleCloseSetup}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {setupNeeds.sox && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-600">
              <strong>Sox</strong> is required to record audio from your microphone.
            </p>
            {isMac && (
              <Button
                size="sm"
                onClick={handleInstallSox}
                className="w-full h-8 text-xs"
              >
                Install Sox with Homebrew
              </Button>
            )}
            {isLinux && (
              <p className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded font-mono">
                sudo apt install sox<br />
                <span className="text-neutral-400"># or: sudo dnf install sox</span>
              </p>
            )}
            {isWindows && (
              <p className="text-xs text-neutral-500">
                Download from <a href="https://sourceforge.net/projects/sox/" target="_blank" rel="noopener" className="underline text-primary">sox.sourceforge.net</a> and add to PATH.
              </p>
            )}
          </div>
        )}

        {setupNeeds.whisperBinary && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-600">
              <strong>whisper.cpp</strong> is required to transcribe audio locally.
            </p>
            {isMac && (
              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  onClick={() => handleInstallWhisper('homebrew')}
                  className="w-full h-8 text-xs"
                >
                  Install with Homebrew
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleInstallWhisper('source')}
                  className="w-full h-8 text-xs"
                >
                  Build from Source
                </Button>
              </div>
            )}
            {(isLinux || isWindows) && (
              <p className="text-xs text-neutral-500">
                Build from source: <a href="https://github.com/ggerganov/whisper.cpp" target="_blank" rel="noopener" className="underline text-primary">github.com/ggerganov/whisper.cpp</a>
              </p>
            )}
          </div>
        )}

        {!setupNeeds.whisperBinary && setupNeeds.whisperModel && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-600">
              <strong>Transcription model</strong> needs to be downloaded.
            </p>
            <Button
              size="sm"
              onClick={handleDownloadModel}
              className="w-full h-8 text-xs"
            >
              Download Model
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          <p className="text-[10px] text-neutral-400">
            Or <button onClick={handleCloseSetup} className="underline hover:text-neutral-600">use Bulk add</button> instead.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCheckSetup}
            className="h-6 px-2 text-xs"
          >
            Check Again
          </Button>
        </div>
      </div>
    );
  }

  // Text input mode - type or paste tasks
  if (state === 'text-input') {
    return (
      <div className="mb-4 bg-neutral-0 border border-neutral-200 rounded-md p-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-neutral-600">
            Bulk add tasks
          </span>
          <button
            onClick={handleCloseTextInput}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Describe tasks to create..."
          rows={3}
          className="w-full text-xs text-neutral-700 bg-white border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-neutral-400"
        />
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={handleCloseTextInput} className="h-6 px-2 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleProcessText}
            disabled={!inputText.trim()}
            className="h-6 px-2 text-xs"
          >
            Create Tasks
          </Button>
        </div>
      </div>
    );
  }

  // Idle or recording state - show capture options
  if (state === 'idle' || state === 'recording') {
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {state === 'recording' ? (
            <button
              type="button"
              onClick={handleToggleRecording}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-600 hover:bg-red-100 transition-colors"
            >
              <Square size={14} className="fill-current" />
              <span className="text-sm font-medium font-mono">
                {formatDuration(duration)} / {formatDuration(MAX_RECORDING_SECONDS)}
              </span>
              <span className="text-xs">Stop</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleToggleRecording}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-md text-neutral-700 hover:bg-neutral-200 transition-colors"
              >
                <Mic size={14} />
                <span className="text-sm font-medium">Record</span>
              </button>
              <button
                type="button"
                onClick={handleOpenTextInput}
                className="flex items-center gap-2 px-3 py-2 bg-neutral-100 border border-neutral-200 rounded-md text-neutral-700 hover:bg-neutral-200 transition-colors"
              >
                <Type size={14} />
                <span className="text-sm font-medium">Bulk add</span>
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-2">{error}</p>
        )}
      </div>
    );
  }

  // Processing state
  if (state === 'processing') {
    return (
      <div className="mb-4 flex items-center gap-1.5 text-xs text-neutral-500">
        <Loader2 size={12} className="animate-spin" />
        <span>{processingStatus}</span>
      </div>
    );
  }

  // Review state - full width card
  if (state === 'reviewing' && parsedTasks.length > 0) {
    return (
      <div className="mb-4 bg-neutral-0 border border-neutral-200 rounded-md p-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-neutral-600">
            {parsedTasks.length} task{parsedTasks.length !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleCancelReview} className="h-6 px-2 text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmTasks} className="h-6 px-2 text-xs">
              Add
            </Button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {parsedTasks.map((task, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <div
                key={index}
                className={cn(
                  "p-1.5 bg-neutral-50 rounded border border-neutral-100",
                  isExpanded && "max-h-[50vh] overflow-y-auto"
                )}
              >
                <div className="flex items-start gap-1">
                  <button
                    onClick={() => handleToggleExpand(index)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors p-0.5 mt-0.5 shrink-0"
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {isExpanded ? (
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => handleUpdateTask(index, 'title', e.target.value)}
                        className="w-full text-xs font-medium text-neutral-800 bg-white border border-neutral-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <p className="text-xs font-medium text-neutral-800 line-clamp-2">
                        {task.title}
                      </p>
                    )}
                    {!isExpanded && task.description && (
                      <p className="text-[10px] text-neutral-500 line-clamp-4 mt-0.5">
                        {task.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveTask(index)}
                    className="text-neutral-400 hover:text-red-500 transition-colors p-0.5 text-sm leading-none shrink-0"
                  >
                    <span className="sr-only">Remove</span>
                    ×
                  </button>
                </div>
                {isExpanded && (
                  <div className="mt-1.5 ml-5">
                    <textarea
                      value={task.description}
                      onChange={(e) => handleUpdateTask(index, 'description', e.target.value)}
                      placeholder="Description (optional)..."
                      rows={6}
                      className="w-full text-[11px] text-neutral-600 bg-white border border-neutral-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary resize-y placeholder:text-neutral-400 max-h-[40vh]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Reviewing with no tasks
  if (state === 'reviewing') {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-neutral-500">No tasks detected</span>
        <button
          onClick={handleCancelReview}
          className="text-neutral-500 hover:text-neutral-700"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
