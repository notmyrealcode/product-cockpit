import React, { useState, useEffect } from 'react';
import { Check, RefreshCw, FileText, ListTodo, Palette, Trash2, ChevronDown, ChevronRight, Send } from 'lucide-react';
import { Button } from './ui';
import { RecordButton } from './RecordButton';
import { DiffView } from './DiffView';
import { cn } from '../lib/utils';
import type { InterviewProposal } from '../types';

interface ExistingFeatureRef {
  id: string;
  title: string;
}

interface ProposalReviewProps {
  scope: 'project' | 'new-feature' | 'task';
  proposal: InterviewProposal;
  currentDesignMd: string | null;
  existingFeatures: ExistingFeatureRef[];
  onApprove: (editedRequirementDoc?: string, editedDesignChanges?: string, removedFeatureIndices?: number[], removedTaskIndices?: number[]) => void;
  onReject: (feedback: string) => void;
  onCancel: () => void;
}

export function ProposalReview({
  scope,
  proposal,
  currentDesignMd,
  existingFeatures,
  onApprove,
  onReject,
  onCancel,
}: ProposalReviewProps) {
  // Edited content state
  const [editedRequirementDoc, setEditedRequirementDoc] = useState<string>(proposal.requirementDoc);
  const [editedProposedDesign, setEditedProposedDesign] = useState<string | null>(proposal.proposedDesignMd || null);
  const [showDiffView, setShowDiffView] = useState(true);

  // Removed items state
  const [removedFeatures, setRemovedFeatures] = useState<Set<number>>(new Set());
  const [removedTasks, setRemovedTasks] = useState<Set<number>>(new Set());

  // Expanded descriptions state
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // Reject feedback state
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Reset state when proposal changes
  useEffect(() => {
    setEditedRequirementDoc(proposal.requirementDoc);
    setEditedProposedDesign(proposal.proposedDesignMd || null);
    setShowDiffView(true);
    setRemovedFeatures(new Set());
    setRemovedTasks(new Set());
  }, [proposal]);

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectFeedback.trim());
      setRejectFeedback('');
      setShowRejectInput(false);
    } else {
      setShowRejectInput(true);
    }
  };

  const handleApprove = () => {
    onApprove(
      editedRequirementDoc || undefined,
      editedProposedDesign || undefined,
      removedFeatures.size > 0 ? Array.from(removedFeatures) : undefined,
      removedTasks.size > 0 ? Array.from(removedTasks) : undefined
    );
  };

  const activeFeatures = proposal.features.filter((_, i) => !removedFeatures.has(i));
  const activeTasks = proposal.tasks.filter((_, i) => !removedTasks.has(i));
  const tasksForExistingFeatures = activeTasks.filter(t => t.existingFeatureId);
  const newFeatureTasks = activeTasks.filter(t => t.featureIndex !== undefined && !t.existingFeatureId);
  const standaloneTasks = activeTasks.filter(t => t.featureIndex === undefined && !t.existingFeatureId);

  // Build summary parts
  const summaryParts: string[] = [];
  if (activeFeatures.length > 0) {
    summaryParts.push(`${activeFeatures.length} new feature${activeFeatures.length !== 1 ? 's' : ''}`);
  }
  if (tasksForExistingFeatures.length > 0) {
    summaryParts.push(`${tasksForExistingFeatures.length} task${tasksForExistingFeatures.length !== 1 ? 's' : ''} to existing`);
  }
  if (standaloneTasks.length > 0) {
    summaryParts.push(`${standaloneTasks.length} standalone task${standaloneTasks.length !== 1 ? 's' : ''}`);
  }
  if (proposal.proposedDesignMd) {
    summaryParts.push('design updates');
  }

  return (
    <div className="h-full flex flex-col bg-neutral-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50">
        <div>
          <h1 className="text-lg font-semibold text-neutral-800">Review Proposal</h1>
          <p className="text-sm text-neutral-500">
            {summaryParts.length > 0 ? summaryParts.join(', ') : 'No changes'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          Cancel
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Requirements document - only for project/feature scope */}
        {scope !== 'task' && (
          <div className="bg-success/5 border border-success/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-success mb-3">
              <FileText size={18} />
              <span className="font-medium">Requirements Document</span>
              <span className="text-xs text-neutral-400">(editable)</span>
            </div>
            <textarea
              value={editedRequirementDoc}
              onChange={(e) => setEditedRequirementDoc(e.target.value)}
              rows={12}
              className="w-full text-sm text-neutral-800 font-mono bg-neutral-0 rounded border border-neutral-200 p-4 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            />
            <p className="text-xs text-neutral-500 mt-2">
              Will be saved to: <code className="bg-neutral-100 px-1.5 py-0.5 rounded">{proposal.requirementPath}</code>
            </p>
          </div>
        )}

        {/* Design.md changes */}
        {proposal.proposedDesignMd && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-purple-700">
                <Palette size={18} />
                <span className="font-medium">Design Guide Updates</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowDiffView(true)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded transition-colors',
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
                    'px-3 py-1.5 text-sm rounded transition-colors',
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
              <DiffView
                oldText={currentDesignMd || ''}
                newText={editedProposedDesign || ''}
              />
            ) : (
              <div>
                <textarea
                  value={editedProposedDesign || ''}
                  onChange={(e) => setEditedProposedDesign(e.target.value)}
                  rows={16}
                  className="w-full text-sm text-neutral-800 font-mono bg-neutral-0 rounded border border-purple-300 p-4 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                />
                <p className="text-xs text-neutral-400 mt-2">
                  This will completely replace the current design.md file
                </p>
              </div>
            )}
          </div>
        )}

        {/* Features with tasks */}
        {proposal.features.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-primary mb-4">
              <ListTodo size={18} />
              <span className="font-medium">
                {activeFeatures.length} Feature{activeFeatures.length !== 1 ? 's' : ''}, {activeTasks.length} Task{activeTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {proposal.features.map((feature, idx) => {
                if (removedFeatures.has(idx)) return null;
                const featureTasks = proposal.tasks
                  .map((t, i) => ({ ...t, originalIndex: i }))
                  .filter(t => t.featureIndex === idx && !removedTasks.has(t.originalIndex));

                return (
                  <div key={idx} className="bg-neutral-0 rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Feature
                          </span>
                        </div>
                        <p className="font-medium text-neutral-800">{feature.title}</p>
                        {feature.description && (
                          <p className="text-sm text-neutral-600 mt-1">{feature.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setRemovedFeatures(prev => new Set([...prev, idx]))}
                        className="p-1.5 text-neutral-400 hover:text-danger hover:bg-danger/10 rounded"
                        title="Remove feature"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Tasks for this feature */}
                    {featureTasks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Tasks</p>
                        {featureTasks.map((task) => (
                          <div key={task.originalIndex} className="flex items-start gap-2 bg-neutral-50 rounded p-2">
                            <span className="text-neutral-400 mt-0.5">•</span>
                            <div className="flex-1">
                              <span className="text-sm text-neutral-700">{task.title}</span>
                              {task.description && (
                                <p className="text-xs text-neutral-500 mt-1">{task.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => setRemovedTasks(prev => new Set([...prev, task.originalIndex]))}
                              className="p-1 text-neutral-400 hover:text-danger shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Tasks for existing features */}
              {(() => {
                const tasksForExisting = proposal.tasks
                  .map((t, i) => ({ ...t, originalIndex: i }))
                  .filter(t => t.existingFeatureId && !removedTasks.has(t.originalIndex));
                if (tasksForExisting.length === 0) return null;

                // Group by existing feature
                const grouped = tasksForExisting.reduce((acc, task) => {
                  const featureId = task.existingFeatureId!;
                  if (!acc[featureId]) acc[featureId] = [];
                  acc[featureId].push(task);
                  return acc;
                }, {} as Record<string, typeof tasksForExisting>);

                return Object.entries(grouped).map(([featureId, tasks]) => {
                  const featureTitle = existingFeatures.find(f => f.id === featureId)?.title || 'Unknown Feature';
                  return (
                    <div key={featureId} className="bg-neutral-0 rounded-lg border border-success/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wide bg-success/10 text-success px-2 py-0.5 rounded">
                          Adding to Existing
                        </span>
                        <span className="text-sm font-medium text-neutral-800">{featureTitle}</span>
                      </div>
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <div key={task.originalIndex} className="flex items-start gap-2 bg-neutral-50 rounded p-2">
                            <span className="text-neutral-400 mt-0.5">•</span>
                            <div className="flex-1">
                              <span className="text-sm text-neutral-700">{task.title}</span>
                              {task.description && (
                                <p className="text-xs text-neutral-500 mt-1">{task.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => setRemovedTasks(prev => new Set([...prev, task.originalIndex]))}
                              className="p-1 text-neutral-400 hover:text-danger shrink-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Standalone tasks (no feature association) */}
              {(() => {
                const standaloneTasks = proposal.tasks
                  .map((t, i) => ({ ...t, originalIndex: i }))
                  .filter(t => t.featureIndex === undefined && !t.existingFeatureId && !removedTasks.has(t.originalIndex));
                if (standaloneTasks.length === 0) return null;

                return (
                  <div className="bg-neutral-0 rounded-lg border border-neutral-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Standalone Tasks</p>
                    <div className="space-y-2">
                      {standaloneTasks.map((task) => (
                        <div key={task.originalIndex} className="flex items-start gap-2 bg-neutral-50 rounded p-2">
                          <span className="text-xs font-medium uppercase bg-neutral-200 text-neutral-500 px-1.5 py-0.5 rounded shrink-0">
                            Task
                          </span>
                          <div className="flex-1">
                            <span className="text-sm text-neutral-700">{task.title}</span>
                            {task.description && (
                              <p className="text-xs text-neutral-500 mt-1">{task.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setRemovedTasks(prev => new Set([...prev, task.originalIndex]))}
                            className="p-1 text-neutral-400 hover:text-danger shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
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
            <div className="flex items-center gap-2 text-primary mb-4">
              <ListTodo size={18} />
              <span className="font-medium">
                {activeTasks.length} Task{activeTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {proposal.tasks.map((task, idx) => {
                if (removedTasks.has(idx)) return null;
                return (
                  <div key={idx} className="bg-neutral-0 rounded-lg border border-neutral-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded">
                            Task
                          </span>
                        </div>
                        <p className="font-medium text-neutral-800">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-neutral-600 mt-1">{task.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setRemovedTasks(prev => new Set([...prev, idx]))}
                        className="p-1.5 text-neutral-400 hover:text-danger hover:bg-danger/10 rounded"
                        title="Remove task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-neutral-200 p-4 bg-neutral-50">
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
              <Send size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowRejectInput(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button onClick={handleApprove} className="flex-1 gap-2">
              <Check size={18} />
              {scope === 'task' ? 'Create Task' : 'Create Requirements & Tasks'}
            </Button>
            <Button variant="secondary" onClick={handleReject} className="gap-2">
              <RefreshCw size={18} />
              Request Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
