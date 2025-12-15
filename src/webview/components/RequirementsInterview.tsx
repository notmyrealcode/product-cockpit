import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Check, RefreshCw, Loader2, FileText, ListTodo } from 'lucide-react';
import { Button } from './ui';
import { cn } from '../lib/utils';
import type { InterviewQuestion, InterviewProposal, InterviewMessage } from '../types';

interface RequirementsInterviewProps {
  scope: 'project' | 'new-feature' | 'task';
  messages: InterviewMessage[];
  currentQuestion: InterviewQuestion | null;
  proposal: InterviewProposal | null;
  isThinking: boolean;
  error: string | null;
  awaitingInput?: boolean;  // Show initial input before starting
  onStart: (initialInput: string) => void;  // Start with user's initial input
  onAnswer: (questionId: string, answer: string) => void;
  onApprove: (editedRequirementDoc?: string) => void;  // Pass edited doc
  onReject: (feedback: string) => void;
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
  onApprove,
  onReject,
  onCancel,
}: RequirementsInterviewProps) {
  const [initialInput, setInitialInput] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherAnswer, setOtherAnswer] = useState('');
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [editedRequirementDoc, setEditedRequirementDoc] = useState<string | null>(null);

  // Initialize edited doc when proposal arrives
  useEffect(() => {
    if (proposal?.requirementDoc && editedRequirementDoc === null) {
      setEditedRequirementDoc(proposal.requirementDoc);
    }
  }, [proposal, editedRequirementDoc]);
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

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectFeedback.trim());
      setRejectFeedback('');
      setShowRejectInput(false);
    } else {
      setShowRejectInput(true);
    }
  };

  const handleStartInterview = () => {
    if (initialInput.trim()) {
      onStart(initialInput.trim());
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
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

          {/* Thinking indicator */}
          {isThinking && (
            <div className="flex justify-start">
              <div className="bg-neutral-100 rounded-lg px-3 py-2 text-sm text-neutral-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Thinking...
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
                      <input
                        type="text"
                        value={otherAnswer}
                        onChange={(e) => setOtherAnswer(e.target.value)}
                        placeholder="Type your answer..."
                        className="w-full text-sm text-neutral-800 bg-neutral-0 border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSubmitAnswer();
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proposal review */}
          {proposal && (
            <div className="space-y-4">
              {/* Requirements document - only for project/feature scope */}
              {scope !== 'task' && (
                <div className="bg-success/5 border border-success/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-success mb-3">
                    <FileText size={16} />
                    <span className="text-sm font-medium">Requirements Document</span>
                    <span className="text-xs text-neutral-400">(editable)</span>
                  </div>
                  <textarea
                    value={editedRequirementDoc || ''}
                    onChange={(e) => setEditedRequirementDoc(e.target.value)}
                    rows={10}
                    className="w-full text-xs text-neutral-800 font-mono bg-neutral-0 rounded border border-neutral-200 p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Will be saved to: <code className="bg-neutral-100 px-1 rounded">{proposal.requirementPath}</code>
                  </p>
                </div>
              )}

              {/* Features with tasks */}
              {proposal.features.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <ListTodo size={16} />
                    <span className="text-sm font-medium">
                      {proposal.features.length} Feature{proposal.features.length > 1 ? 's' : ''} + {proposal.tasks.length} Task{proposal.tasks.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {proposal.features.map((feature, idx) => (
                      <div key={idx} className="bg-neutral-0 rounded border border-neutral-200 p-2">
                        <p className="text-sm font-medium text-neutral-800">{feature.title}</p>
                        {feature.description && (
                          <p className="text-xs text-neutral-500 mt-1">{feature.description}</p>
                        )}
                        {/* Tasks for this feature */}
                        <div className="mt-2 pl-3 border-l-2 border-neutral-200 space-y-1">
                          {proposal.tasks
                            .filter(t => t.featureIndex === idx)
                            .map((task, tidx) => (
                              <div key={tidx} className="text-xs text-neutral-600">
                                <span className="text-neutral-400 mr-1">•</span>
                                {task.title}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                    {/* Standalone tasks within feature view */}
                    {proposal.tasks.filter(t => t.featureIndex === undefined).length > 0 && (
                      <div className="bg-neutral-0 rounded border border-neutral-200 p-2">
                        <p className="text-xs font-medium text-neutral-500 mb-1">Standalone Tasks</p>
                        {proposal.tasks
                          .filter(t => t.featureIndex === undefined)
                          .map((task, tidx) => (
                            <div key={tidx} className="text-xs text-neutral-600">
                              <span className="text-neutral-400 mr-1">•</span>
                              {task.title}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tasks only (for task scope with no features) */}
              {proposal.features.length === 0 && proposal.tasks.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <ListTodo size={16} />
                    <span className="text-sm font-medium">
                      {proposal.tasks.length} Task{proposal.tasks.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {proposal.tasks.map((task, idx) => (
                      <div key={idx} className="bg-neutral-0 rounded border border-neutral-200 p-3">
                        <p className="text-sm font-medium text-neutral-800">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-neutral-500 mt-1">{task.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <textarea
                ref={initialInputRef}
                value={initialInput}
                onChange={(e) => setInitialInput(e.target.value)}
                placeholder={placeholder}
                rows={3}
                className="w-full text-sm text-neutral-800 bg-neutral-0 border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    handleStartInterview();
                  }
                }}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-400">⌘+Enter to start</span>
                <Button onClick={handleStartInterview} disabled={!initialInput.trim()}>
                  <Send size={16} className="mr-2" />
                  Start
                </Button>
              </div>
            </div>
          ) : proposal ? (
            /* Proposal actions */
            <div className="space-y-3">
              {showRejectInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rejectFeedback}
                    onChange={(e) => setRejectFeedback(e.target.value)}
                    placeholder="What would you like to change?"
                    className="flex-1 text-sm text-neutral-800 bg-neutral-0 border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleReject();
                      if (e.key === 'Escape') setShowRejectInput(false);
                    }}
                  />
                  <Button size="sm" onClick={handleReject}>
                    Send
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowRejectInput(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => onApprove(editedRequirementDoc || undefined)} className="flex-1 gap-2">
                    <Check size={16} />
                    {scope === 'task' ? 'Create Task' : 'Create Requirements & Tasks'}
                  </Button>
                  <Button variant="secondary" onClick={handleReject} className="gap-2">
                    <RefreshCw size={16} />
                    Request Changes
                  </Button>
                </div>
              )}
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
