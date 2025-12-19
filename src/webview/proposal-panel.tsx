import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ProposalReview } from './components/ProposalReview';
import { vscode } from './lib/vscode';
import type { InterviewProposal } from './types';

interface ProposalPanelData {
  proposal: InterviewProposal;
  currentDesignMd: string | null;
  scope: 'project' | 'new-feature' | 'task';
}

function ProposalPanel() {
  const [data, setData] = useState<ProposalPanelData | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'proposalData') {
        setData({
          proposal: message.proposal,
          currentDesignMd: message.currentDesignMd,
          scope: message.scope || 'new-feature',
        });
      }

      if (message.type === 'interviewComplete') {
        // Panel can close itself or show success
        setData(null);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial data in case panel was reopened
    vscode.postMessage({ type: 'requestProposalData' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleApprove = (
    editedRequirementDoc?: string,
    editedDesignChanges?: string,
    removedFeatureIndices?: number[],
    removedTaskIndices?: number[]
  ) => {
    vscode.postMessage({
      type: 'approveProposal',
      editedRequirementDoc,
      editedDesignChanges,
      removedFeatureIndices,
      removedTaskIndices,
    });
  };

  const handleReject = (feedback: string) => {
    vscode.postMessage({
      type: 'rejectProposal',
      feedback,
    });
  };

  const handleCancel = () => {
    vscode.postMessage({ type: 'cancelProposal' });
  };

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-neutral-500">Loading proposal...</p>
        </div>
      </div>
    );
  }

  return (
    <ProposalReview
      scope={data.scope}
      proposal={data.proposal}
      currentDesignMd={data.currentDesignMd}
      onApprove={handleApprove}
      onReject={handleReject}
      onCancel={handleCancel}
    />
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ProposalPanel />
    </React.StrictMode>
  );
}
