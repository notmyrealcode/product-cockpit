import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Flame, Smile, ExternalLink } from 'lucide-react';
import { Button } from './ui';
import { RecordButton } from './RecordButton';
import { IntensitySelector } from './IntensitySelector';
import { cn } from '../lib/utils';
import { vscode } from '../lib/vscode';
import type { InterviewQuestion, InterviewProposal, InterviewMessage, ThoughtPartnerIntensity } from '../types';
import { getWaitingContent, preloadHNStories, type WaitingContent } from '../lib/waitingContent';

interface RequirementsInterviewProps {
  scope: 'project' | 'new-feature' | 'task';
  messages: InterviewMessage[];
  currentQuestion: InterviewQuestion | null;
  proposal: InterviewProposal | null;  // When present, review happens in editor panel
  isThinking: boolean;
  error: string | null;
  awaitingInput?: boolean;  // Show initial input before starting
  onStart: (initialInput: string, intensity: ThoughtPartnerIntensity) => void;  // Start with user's initial input and intensity
  onAnswer: (questionId: string, answer: string) => void;
  onCancel: () => void;
}

export function RequirementsInterview({
  scope,
  messages,
  currentQuestion,
  proposal,
  isThinking,
  error,
  awaitingInput = false,
  onStart,
  onAnswer,
  onCancel,
}: RequirementsInterviewProps) {
  const [initialInput, setInitialInput] = useState('');
  const [intensity, setIntensity] = useState<ThoughtPartnerIntensity>('balanced');
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherAnswer, setOtherAnswer] = useState('');
  const [waitingContent, setWaitingContent] = useState<WaitingContent | null>(null);

  // Preload HN stories on mount
  useEffect(() => {
    preloadHNStories();
  }, []);

  // Rotate waiting content while thinking
  useEffect(() => {
    if (!isThinking) {
      setWaitingContent(null);
      return;
    }

    // Load initial content immediately
    getWaitingContent().then(setWaitingContent);

    // Rotate content every 12 seconds
    const interval = setInterval(() => {
      getWaitingContent().then(setWaitingContent);
    }, 12000);

    return () => clearInterval(interval);
  }, [isThinking]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const initialInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentQuestion, proposal, isThinking]);

  // Focus input when question changes or awaiting input
  useEffect(() => {
    if (awaitingInput && initialInputRef.current) {
      initialInputRef.current.focus();
    } else if (currentQuestion && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentQuestion, awaitingInput]);

  const handleSubmitAnswer = () => {
    if (!currentQuestion) return;

    let answer: string | null;
    if (currentQuestion.type === 'choice') {
      answer = showOtherInput ? otherAnswer : selectedOption;
    } else {
      answer = textAnswer;
    }
    if (!answer?.trim()) return;

    onAnswer(currentQuestion.id, answer.trim());
    setTextAnswer('');
    setSelectedOption(null);
    setShowOtherInput(false);
    setOtherAnswer('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && currentQuestion?.type === 'text') {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const handleOpenPanel = () => {
    vscode.postMessage({ type: 'openProposalPanel' });
  };

  const handleStartInterview = () => {
    if (initialInput.trim()) {
      onStart(initialInput.trim(), intensity);
      setInitialInput('');
    }
  };

  const titles: Record<string, string> = {
    'project': 'Project Plan',
    'new-feature': 'New Feature',
    'task': 'Define Task'
  };
  const title = titles[scope] || 'Interview';

  const placeholders: Record<string, string> = {
    'project': 'Describe your project idea, goals, and what you want to build...',
    'new-feature': 'Describe the feature you want to build...',
    'task': 'Describe what you want to accomplish...'
  };
  const placeholder = placeholders[scope] || 'Describe what you want...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-neutral-900/70" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-neutral-0 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
            <p className="text-xs text-neutral-500">
              Answer questions to generate requirements
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
          {/* Initial input phase */}
          {awaitingInput && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-neutral-600 mb-4">
                Tell Claude what you want to {scope === 'task' ? 'accomplish' : 'build'}
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-neutral-0'
                    : 'bg-neutral-100 text-neutral-800'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Thinking indicator with rotating content */}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-neutral-100 rounded-lg px-3 py-3 text-sm max-w-[85%]">
                <div className="flex items-center gap-2 text-neutral-500 mb-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Claude is thinking...</span>
                </div>
                {waitingContent && (
                  <div className="border-t border-neutral-200 pt-2 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                      {waitingContent.type === 'hn' ? (
                        <>
                          <Flame size={12} className="text-orange-500" />
                          <span>Hacker News</span>
                          {waitingContent.score && (
                            <span className="text-neutral-300">• {waitingContent.score} points</span>
                          )}
                        </>
                      ) : (
                        <>
                          <Smile size={12} />
                          <span>While you wait...</span>
                        </>
                      )}
                    </div>
                    {waitingContent.type === 'hn' && waitingContent.url ? (
                      <a
                        href={waitingContent.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-700 hover:text-primary hover:underline block"
                      >
                        {waitingContent.content}
                      </a>
                    ) : (
                      <p className="text-neutral-600 italic">{waitingContent.content}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current question */}
          {currentQuestion && !proposal && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-neutral-100 rounded-lg px-3 py-2 text-sm text-neutral-800">
                <p className="whitespace-pre-wrap font-medium">{currentQuestion.text}</p>
                {currentQuestion.type === 'choice' && currentQuestion.options && (
                  <div className="mt-3 space-y-2">
                    {currentQuestion.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedOption(option);
                          setShowOtherInput(false);
                          setOtherAnswer('');
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded border text-xs transition-colors',
                          selectedOption === option && !showOtherInput
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                        )}
                      >
                        {option}
                      </button>
                    ))}
                    {/* Other option */}
                    <button
                      onClick={() => {
                        setShowOtherInput(true);
                        setSelectedOption(null);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded border text-xs transition-colors',
                        showOtherInput
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                      )}
                    >
                      Other...
                    </button>
                    {showOtherInput && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={otherAnswer}
                          onChange={(e) => setOtherAnswer(e.target.value)}
                          placeholder="Type your answer..."
                          className="flex-1 text-sm text-neutral-800 bg-neutral-0 border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitAnswer();
                          }}
                        />
                        <RecordButton
                          rawMode
                          size="sm"
                          onTranscript={(text) => setOtherAnswer(prev => prev ? `${prev} ${text}` : text)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proposal status - review happens in editor panel */}
          {proposal && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <ExternalLink size={24} className="text-primary" />
              </div>
              <h3 className="text-sm font-medium text-neutral-800 mb-1">
                Proposal Ready
              </h3>
              <p className="text-xs text-neutral-500 mb-4">
                {proposal.features.length} feature{proposal.features.length !== 1 ? 's' : ''}, {proposal.tasks.length} task{proposal.tasks.length !== 1 ? 's' : ''}
                {proposal.proposedDesignMd && ' + design updates'}
              </p>
              <Button variant="secondary" size="sm" onClick={handleOpenPanel} className="gap-2">
                <ExternalLink size={14} />
                Open Review Panel
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-danger/5 border border-danger/20 rounded-lg p-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-neutral-200 p-4">
          {awaitingInput ? (
            /* Initial input */
            <div className="space-y-3">
              <IntensitySelector value={intensity} onChange={setIntensity} />
              <div className="relative">
                <textarea
                  ref={initialInputRef}
                  value={initialInput}
                  onChange={(e) => setInitialInput(e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  className="w-full text-sm text-neutral-800 bg-neutral-0 border border-neutral-300 rounded-lg px-3 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) {
                      handleStartInterview();
                    }
                  }}
                />
                <div className="absolute right-2 top-2">
                  <RecordButton
                    rawMode
                    size="sm"
                    onTranscript={(text) => setInitialInput(prev => prev ? `${prev} ${text}` : text)}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">⌘+Enter to start</span>
                <Button onClick={handleStartInterview} disabled={!initialInput.trim()}>
                  <Send size={16} className="mr-2" />
                  Start
                </Button>
              </div>
            </div>
          ) : proposal ? (
            /* Proposal ready - review in panel */
            <div className="text-center text-sm text-neutral-500">
              Review proposal in the editor panel
            </div>
          ) : currentQuestion ? (
            /* Question input */
            currentQuestion.type === 'choice' ? (
              <Button
                onClick={handleSubmitAnswer}
                disabled={!selectedOption && !(showOtherInput && otherAnswer.trim())}
                className="w-full"
              >
                Continue
              </Button>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer..."
                  className="flex-1 text-sm text-neutral-800 bg-neutral-0 border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <RecordButton
                  rawMode
                  size="sm"
                  onTranscript={(text) => setTextAnswer(prev => prev ? `${prev} ${text}` : text)}
                />
                <Button onClick={handleSubmitAnswer} disabled={!textAnswer.trim()}>
                  <Send size={16} />
                </Button>
              </div>
            )
          ) : isThinking ? (
            <div className="text-center text-sm text-neutral-500">
              Waiting for response...
            </div>
          ) : (
            <div className="text-center text-sm text-neutral-500">
              Interview starting...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
