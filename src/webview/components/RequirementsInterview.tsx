import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Check, RefreshCw, Loader2, FileText, ListTodo, Flame, Smile, Palette, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './ui';
import { RecordButton } from './RecordButton';
import { DiffView } from './DiffView';
import { cn } from '../lib/utils';
import type { InterviewQuestion, InterviewProposal, InterviewMessage } from '../types';
import { getWaitingContent, preloadHNStories, type WaitingContent } from '../lib/waitingContent';

interface RequirementsInterviewProps {
  scope: 'project' | 'new-feature' | 'task';
  messages: InterviewMessage[];
  currentQuestion: InterviewQuestion | null;
  proposal: InterviewProposal | null;
  currentDesignMd: string | null;  // Current content of design.md for diff view
  isThinking: boolean;
  error: string | null;
  awaitingInput?: boolean;  // Show initial input before starting
  onStart: (initialInput: string) => void;  // Start with user's initial input
  onAnswer: (questionId: string, answer: string) => void;
  onApprove: (editedRequirementDoc?: string, editedDesignChanges?: string, removedFeatureIndices?: number[], removedTaskIndices?: number[]) => void;
  onReject: (feedback: string) => void;
  onCancel: () => void;
}

export function RequirementsInterview({
  scope,
  messages,
  currentQuestion,
  proposal,
  currentDesignMd,
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
  const [lastProposalDoc, setLastProposalDoc] = useState<string | null>(null);
  const [waitingContent, setWaitingContent] = useState<WaitingContent | null>(null);

  // Proposed design.md state
  const [editedProposedDesign, setEditedProposedDesign] = useState<string | null>(null);
  const [lastProposedDesign, setLastProposedDesign] = useState<string | null>(null);
  const [showDiffView, setShowDiffView] = useState(true);  // Toggle between diff and edit

  // Removed items state
  const [removedFeatures, setRemovedFeatures] = useState<Set<number>>(new Set());
  const [removedTasks, setRemovedTasks] = useState<Set<number>>(new Set());

  // Expanded descriptions state
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // Update edited doc when proposal changes (new proposal or revised after feedback)
  useEffect(() => {
    if (proposal?.requirementDoc && proposal.requirementDoc !== lastProposalDoc) {
      setEditedRequirementDoc(proposal.requirementDoc);
      setLastProposalDoc(proposal.requirementDoc);
    }
  }, [proposal, lastProposalDoc]);

  // Update proposed design when proposal changes
  useEffect(() => {
    if (proposal?.proposedDesignMd !== undefined && proposal.proposedDesignMd !== lastProposedDesign) {
      setEditedProposedDesign(proposal.proposedDesignMd || null);
      setLastProposedDesign(proposal.proposedDesignMd || null);
      setShowDiffView(true);  // Default to diff view for new proposals
      // Reset removed items when proposal changes
      setRemovedFeatures(new Set());
      setRemovedTasks(new Set());
    }
  }, [proposal, lastProposedDesign]);

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

              {/* Design.md changes - only show if there are design changes */}
              {proposal.proposedDesignMd && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-purple-700">
                      <Palette size={16} />
                      <span className="text-sm font-medium">Design Guide Updates</span>
                      <span className="text-xs text-neutral-400">(will replace design.md)</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowDiffView(true)}
                        className={cn(
                          'px-2 py-1 text-xs rounded transition-colors',
                          showDiffView
                            ? 'bg-purple-200 text-purple-800'
                            : 'text-purple-600 hover:bg-purple-100'
                        )}
                      >
                        Diff
                      </button>
                      <button
                        onClick={() => setShowDiffView(false)}
                        className={cn(
                          'px-2 py-1 text-xs rounded transition-colors',
                          !showDiffView
                            ? 'bg-purple-200 text-purple-800'
                            : 'text-purple-600 hover:bg-purple-100'
                        )}
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {showDiffView ? (
                    /* Diff view */
                    <DiffView
                      oldText={currentDesignMd || ''}
                      newText={editedProposedDesign || ''}
                    />
                  ) : (
                    /* Edit view */
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">
                        Proposed design.md (full content)
                      </p>
                      <textarea
                        value={editedProposedDesign || ''}
                        onChange={(e) => setEditedProposedDesign(e.target.value)}
                        rows={12}
                        className="w-full text-xs text-neutral-800 font-mono bg-neutral-0 rounded border border-purple-300 p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        This will completely replace the current design.md file
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Features with tasks */}
              {proposal.features.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <ListTodo size={16} />
                    <span className="text-sm font-medium">
                      {proposal.features.filter((_, i) => !removedFeatures.has(i)).length} Feature{proposal.features.filter((_, i) => !removedFeatures.has(i)).length !== 1 ? 's' : ''} + {proposal.tasks.filter((_, i) => !removedTasks.has(i)).length} Task{proposal.tasks.filter((_, i) => !removedTasks.has(i)).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {proposal.features.map((feature, idx) => {
                      if (removedFeatures.has(idx)) return null;
                      const isExpanded = expandedFeatures.has(idx);
                      const featureTasks = proposal.tasks
                        .map((t, i) => ({ ...t, originalIndex: i }))
                        .filter(t => t.featureIndex === idx && !removedTasks.has(t.originalIndex));

                      return (
                        <div key={idx} className="bg-neutral-0 rounded border border-neutral-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  Feature
                                </span>
                              </div>
                              <p className="text-sm font-medium text-neutral-800">{feature.title}</p>
                              {feature.description && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => {
                                      const next = new Set(expandedFeatures);
                                      if (isExpanded) next.delete(idx);
                                      else next.add(idx);
                                      setExpandedFeatures(next);
                                    }}
                                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
                                  >
                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    {isExpanded ? 'Hide details' : 'Show details'}
                                  </button>
                                  {isExpanded && (
                                    <p className="text-xs text-neutral-500 mt-1 whitespace-pre-wrap">{feature.description}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setRemovedFeatures(prev => new Set([...prev, idx]))}
                              className="p-1 text-neutral-300 hover:text-danger hover:bg-danger/10 rounded"
                              title="Remove feature"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {/* Tasks for this feature */}
                          {featureTasks.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-neutral-100">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-2">Tasks</p>
                              <div className="space-y-1.5">
                                {featureTasks.map((task) => {
                                  const taskExpanded = expandedTasks.has(task.originalIndex);
                                  return (
                                    <div key={task.originalIndex} className="flex items-start gap-2 text-xs text-neutral-600 bg-neutral-50 rounded px-2 py-1.5">
                                      <span className="text-[9px] font-medium uppercase bg-neutral-200 text-neutral-500 px-1 py-0.5 rounded mt-0.5 shrink-0">
                                        Task
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <span>{task.title}</span>
                                        {task.description && (
                                          <div>
                                            <button
                                              onClick={() => {
                                                const next = new Set(expandedTasks);
                                                if (taskExpanded) next.delete(task.originalIndex);
                                                else next.add(task.originalIndex);
                                                setExpandedTasks(next);
                                              }}
                                              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 mt-0.5"
                                            >
                                              {taskExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                              {taskExpanded ? 'Hide' : 'Details'}
                                            </button>
                                            {taskExpanded && (
                                              <p className="text-neutral-500 mt-1 whitespace-pre-wrap">{task.description}</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => setRemovedTasks(prev => new Set([...prev, task.originalIndex]))}
                                        className="p-0.5 text-neutral-300 hover:text-danger shrink-0"
                                        title="Remove task"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Standalone tasks within feature view */}
                    {(() => {
                      const standaloneTasks = proposal.tasks
                        .map((t, i) => ({ ...t, originalIndex: i }))
                        .filter(t => t.featureIndex === undefined && !removedTasks.has(t.originalIndex));
                      if (standaloneTasks.length === 0) return null;

                      return (
                        <div className="bg-neutral-0 rounded border border-neutral-200 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 mb-2">Standalone Tasks</p>
                          <div className="space-y-1.5">
                            {standaloneTasks.map((task) => {
                              const taskExpanded = expandedTasks.has(task.originalIndex);
                              return (
                                <div key={task.originalIndex} className="flex items-start gap-2 text-xs text-neutral-600 bg-neutral-50 rounded px-2 py-1.5">
                                  <span className="text-[9px] font-medium uppercase bg-neutral-200 text-neutral-500 px-1 py-0.5 rounded mt-0.5 shrink-0">
                                    Task
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span>{task.title}</span>
                                    {task.description && (
                                      <div>
                                        <button
                                          onClick={() => {
                                            const next = new Set(expandedTasks);
                                            if (taskExpanded) next.delete(task.originalIndex);
                                            else next.add(task.originalIndex);
                                            setExpandedTasks(next);
                                          }}
                                          className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 mt-0.5"
                                        >
                                          {taskExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                          {taskExpanded ? 'Hide' : 'Details'}
                                        </button>
                                        {taskExpanded && (
                                          <p className="text-neutral-500 mt-1 whitespace-pre-wrap">{task.description}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setRemovedTasks(prev => new Set([...prev, task.originalIndex]))}
                                    className="p-0.5 text-neutral-300 hover:text-danger shrink-0"
                                    title="Remove task"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Tasks only (for task scope with no features) */}
              {proposal.features.length === 0 && proposal.tasks.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <ListTodo size={16} />
                    <span className="text-sm font-medium">
                      {proposal.tasks.filter((_, i) => !removedTasks.has(i)).length} Task{proposal.tasks.filter((_, i) => !removedTasks.has(i)).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {proposal.tasks.map((task, idx) => {
                      if (removedTasks.has(idx)) return null;
                      const isExpanded = expandedTasks.has(idx);
                      return (
                        <div key={idx} className="bg-neutral-0 rounded border border-neutral-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide bg-neutral-200 text-neutral-500 px-1.5 py-0.5 rounded">
                                  Task
                                </span>
                              </div>
                              <p className="text-sm font-medium text-neutral-800">{task.title}</p>
                              {task.description && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => {
                                      const next = new Set(expandedTasks);
                                      if (isExpanded) next.delete(idx);
                                      else next.add(idx);
                                      setExpandedTasks(next);
                                    }}
                                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600"
                                  >
                                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    {isExpanded ? 'Hide details' : 'Show details'}
                                  </button>
                                  {isExpanded && (
                                    <p className="text-xs text-neutral-500 mt-1 whitespace-pre-wrap">{task.description}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setRemovedTasks(prev => new Set([...prev, idx]))}
                              className="p-1 text-neutral-300 hover:text-danger hover:bg-danger/10 rounded"
                              title="Remove task"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                  <RecordButton
                    rawMode
                    size="sm"
                    onTranscript={(text) => setRejectFeedback(prev => prev ? `${prev} ${text}` : text)}
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
                  <Button
                    onClick={() => onApprove(
                      editedRequirementDoc || undefined,
                      editedProposedDesign || undefined,
                      removedFeatures.size > 0 ? Array.from(removedFeatures) : undefined,
                      removedTasks.size > 0 ? Array.from(removedTasks) : undefined
                    )}
                    className="flex-1 gap-2"
                  >
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
