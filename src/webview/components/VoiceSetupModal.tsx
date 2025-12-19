import React from 'react';
import { X, Check, Terminal, Download } from 'lucide-react';
import { vscode } from '../lib/vscode';

interface VoiceSetupModalProps {
  needsSox: boolean;
  needsWhisperBinary: boolean;
  needsWhisperModel: boolean;
  platform: string;
  onClose: () => void;
}

export function VoiceSetupModal({
  needsSox,
  needsWhisperBinary,
  needsWhisperModel,
  platform,
  onClose,
}: VoiceSetupModalProps) {
  const handleInstallDependencies = () => {
    vscode.postMessage({ type: 'installVoiceDeps' });
  };

  const handleDownloadModel = () => {
    vscode.postMessage({ type: 'downloadModel' });
  };

  const allComplete = !needsSox && !needsWhisperBinary && !needsWhisperModel;
  const needsCliTools = needsSox || needsWhisperBinary;

  return (
    <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50 p-2">
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg shadow-lg w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
            Voice Capture Setup
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X size={18} className="text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Status items */}
          <div className="space-y-2">
            <StatusItem label="sox (audio recording)" done={!needsSox} />
            <StatusItem label="whisper.cpp (transcription)" done={!needsWhisperBinary} />
            <StatusItem label="Whisper model (~150MB)" done={!needsWhisperModel} />
          </div>

          {/* Install button */}
          {needsCliTools && platform === 'darwin' && (
            <button
              onClick={handleInstallDependencies}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors mt-4"
            >
              <Terminal size={16} />
              Install via Homebrew
            </button>
          )}

          {/* Model download - only show when CLI tools are installed */}
          {!needsCliTools && needsWhisperModel && (
            <button
              onClick={handleDownloadModel}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors mt-4"
            >
              <Download size={16} />
              Download Model
            </button>
          )}

          {/* Non-macOS instructions */}
          {needsCliTools && platform !== 'darwin' && (
            <div className="mt-4 p-3 rounded bg-neutral-100 dark:bg-neutral-700/50">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Install manually:
              </p>
              <code className="block mt-1 text-xs bg-neutral-200 dark:bg-neutral-600 px-2 py-1 rounded">
                {platform === 'win32'
                  ? 'choco install sox whisper-cpp'
                  : 'sudo apt install sox && brew install whisper-cpp'}
              </code>
            </div>
          )}

          {/* All done */}
          {allComplete && (
            <div className="mt-4 p-3 rounded bg-green-50 dark:bg-green-900/20 text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                ✓ Voice capture is ready!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            {allComplete ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      {done ? (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <Check size={12} className="text-white" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
      )}
      <span className={`text-sm ${done ? 'text-neutral-500' : 'text-neutral-800 dark:text-neutral-100'}`}>
        {label}
      </span>
    </div>
  );
}
