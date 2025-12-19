import React from 'react';
import { X, Check, Download, Terminal } from 'lucide-react';
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
  const handleInstallSox = () => {
    vscode.postMessage({ type: 'installSox' });
  };

  const handleInstallWhisper = (method: 'homebrew' | 'source') => {
    vscode.postMessage({ type: 'installWhisper', method });
  };

  const handleDownloadModel = () => {
    console.log('[VoiceSetupModal] Download button clicked, posting downloadModel message');
    vscode.postMessage({ type: 'downloadModel' });
  };

  const handleCheckAgain = () => {
    vscode.postMessage({ type: 'checkSetup' });
  };

  const allComplete = !needsSox && !needsWhisperBinary && !needsWhisperModel;

  return (
    <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-50">
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
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
        <div className="p-4 space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Voice capture requires the following dependencies:
          </p>

          {/* Sox */}
          <div className="flex items-start gap-3 p-3 rounded-md bg-neutral-100 dark:bg-neutral-700/50">
            <div className="mt-0.5">
              {needsSox ? (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm text-neutral-800 dark:text-neutral-100">
                sox (audio recording)
              </div>
              {needsSox && (
                <div className="mt-2">
                  {platform === 'darwin' ? (
                    <button
                      onClick={handleInstallSox}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      <Terminal size={14} />
                      Install via Homebrew
                    </button>
                  ) : (
                    <p className="text-xs text-neutral-500">
                      Install sox manually: <code className="bg-neutral-200 dark:bg-neutral-600 px-1 rounded">
                        {platform === 'win32' ? 'choco install sox' : 'sudo apt install sox'}
                      </code>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Whisper Binary */}
          <div className="flex items-start gap-3 p-3 rounded-md bg-neutral-100 dark:bg-neutral-700/50">
            <div className="mt-0.5">
              {needsWhisperBinary ? (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm text-neutral-800 dark:text-neutral-100">
                whisper.cpp (transcription)
              </div>
              {needsWhisperBinary && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {platform === 'darwin' && (
                    <button
                      onClick={() => handleInstallWhisper('homebrew')}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                      <Terminal size={14} />
                      Homebrew
                    </button>
                  )}
                  <button
                    onClick={() => handleInstallWhisper('source')}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                  >
                    Build from source
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Whisper Model */}
          <div className="flex items-start gap-3 p-3 rounded-md bg-neutral-100 dark:bg-neutral-700/50">
            <div className="mt-0.5">
              {needsWhisperModel ? (
                <div className="w-5 h-5 rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm text-neutral-800 dark:text-neutral-100">
                Whisper model (~150MB)
              </div>
              {needsWhisperModel && !needsWhisperBinary && (
                <div className="mt-2">
                  <button
                    onClick={handleDownloadModel}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                  >
                    <Download size={14} />
                    Download Model
                  </button>
                </div>
              )}
              {needsWhisperModel && needsWhisperBinary && (
                <p className="text-xs text-neutral-500 mt-1">
                  Install whisper.cpp first
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={handleCheckAgain}
            className="px-4 py-2 text-sm font-medium rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
          >
            Check Again
          </button>
          {allComplete && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
