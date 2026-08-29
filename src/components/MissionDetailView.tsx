import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import { MissionStep, Approval, Artifact, AuthorityLevel } from '../types';
import Markdown from 'react-markdown';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RotateCcw,
  Shield,
  Lock,
  ChevronDown,
  ChevronUp,
  FileText,
  Code,
  ExternalLink,
  Sparkles,
  Send,
  Check,
  X,
  MessageSquarePlus,
  Cpu,
  Boxes,
  Zap
} from 'lucide-react';
import { AuthorityLadder } from './AuthorityLadder';

interface MissionDetailViewProps {
  missionId: string;
  onBack: () => void;
}

export const MissionDetailView: React.FC<MissionDetailViewProps> = ({ missionId, onBack }) => {
  const {
    missions,
    missionSteps,
    approvals,
    artifacts,
    agents,
    decideApproval,
    tickWorker,
    isProcessingStep,
    workerStatus,
    currentUser
  } = useTeamOS();

  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [reviseNote, setReviseNote] = useState<{ [approvalId: string]: string }>({});
  const [isRevising, setIsRevising] = useState<{ [approvalId: string]: boolean }>({});
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  const mission = missions.find(m => m.id === missionId);
  const steps = missionSteps.filter(s => s.mission_id === missionId).sort((a, b) => a.seq - b.seq);
  const missionApprovals = approvals.filter(a => a.mission_id === missionId && !a.decision);
  const resolvedApprovals = approvals.filter(a => a.mission_id === missionId && a.decision);
  const missionArtifacts = artifacts.filter(a => a.mission_id === missionId);

  // Auto-expand the currently running or awaiting approval step if none selected
  React.useEffect(() => {
    if (!expandedStepId && steps.length > 0) {
      const activeStep = steps.find(s => s.status === 'running' || s.status === 'awaiting_approval') || steps[0];
      if (activeStep) setExpandedStepId(activeStep.id);
    }
  }, [steps, expandedStepId]);

  if (!mission) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="text-neutral-500 font-mono text-xs">Mission not found.</div>
        <button onClick={onBack} className="text-xs text-black font-bold font-mono underline cursor-pointer">
          Return to missions
        </button>
      </div>
    );
  }

  const handleApprove = async (approvalId: string) => {
    await decideApproval(approvalId, 'approved');
  };

  const handleReject = async (approvalId: string) => {
    await decideApproval(approvalId, 'rejected', reviseNote[approvalId] || 'Rejected by human reviewer.');
  };

  const handleReviseSubmit = async (approvalId: string) => {
    const note = reviseNote[approvalId] || '';
    await decideApproval(approvalId, 'revised', note);
    setIsRevising(prev => ({ ...prev, [approvalId]: false }));
  };

  const totalCost = steps.reduce((sum, s) => sum + (s.cost_cents || 0), 0);
  const totalTokens = steps.reduce((sum, s) => sum + (s.tokens_in || 0) + (s.tokens_out || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2dc] pb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded bg-white border border-[#e2e2dc] text-neutral-600 hover:text-black hover:border-black transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="dd-section-tag text-black mb-0.5">
              MISSION EXECUTION DAG · REALTIME STREAM
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-black truncate font-sans">
                {mission.title}
              </h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider font-bold border ${
                mission.status === 'running'
                  ? 'bg-black text-[#d4f000] border-black'
                  : mission.status === 'done'
                  ? 'bg-neutral-100 text-black border-[#e2e2dc]'
                  : mission.status === 'blocked'
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-white text-neutral-500 border-[#e2e2dc]'
              }`}>
                {mission.status}
              </span>
            </div>
            <div className="text-xs text-neutral-500 flex items-center gap-2 mt-1 font-mono">
              <span className="font-sans text-neutral-700 font-bold">{mission.playbook_name || 'Custom Sequence'}</span>
              <span className="text-neutral-300">·</span>
              <span className="text-neutral-500">{mission.id}</span>
              <span className="text-neutral-300">·</span>
              <span className="text-black font-bold">${(totalCost / 100).toFixed(3)} metered</span>
            </div>
          </div>
        </div>

        {/* Action button to manually tick / execute worker */}
        <div className="flex items-center gap-2">
          {mission.status === 'running' && (
            <button
              onClick={() => tickWorker()}
              disabled={isProcessingStep}
              className="px-4 py-2 rounded bg-black text-white font-mono font-bold text-xs flex items-center gap-2 shadow-xs hover:bg-neutral-800 transition-all disabled:opacity-40 cursor-pointer"
            >
              {isProcessingStep ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#d4f000] animate-ping" />
                  <span>Worker Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Next Step</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* THREE REGIONS LAYOUT: LEFT (60%) TIMELINE, RIGHT (40%) GOAL + APPROVALS + ARTIFACTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: 60% (7 cols on lg) - STEP TIMELINE */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              <span>Step Execution Timeline ({steps.length} Steps)</span>
            </h2>
            <span className="text-[11px] font-mono text-neutral-500">
              Supabase Realtime Streamed
            </span>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => {
              const isExpanded = expandedStepId === step.id;
              const agent = agents.find(a => a.id === step.agent_id) || agents.find(a => a.role_label === step.role_label);

              // Distinct visual styling based on status
              let statusBorder = 'border-[#e2e2dc]';
              let statusBg = 'bg-white';

              if (step.status === 'running') {
                statusBorder = 'border-black ring-1 ring-black';
                statusBg = 'bg-[#fafaf8]';
              } else if (step.status === 'awaiting_approval') {
                statusBorder = 'border-black';
                statusBg = 'bg-[#fafaf8]';
              } else if (step.status === 'done') {
                statusBorder = 'border-[#e2e2dc]';
                statusBg = 'bg-white';
              } else if (step.status === 'failed') {
                statusBorder = 'border-rose-300';
                statusBg = 'bg-rose-50/40';
              }

              return (
                <div
                  key={step.id}
                  className={`rounded border transition-all duration-200 ${statusBorder} ${statusBg} overflow-hidden shadow-xs`}
                >
                  {/* Step Row Header */}
                  <div
                    onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#f6f6f2] select-none transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Seq Pill */}
                      <div className="flex items-center justify-center w-7 h-7 rounded bg-black font-mono text-xs font-bold text-[#d4f000] flex-shrink-0">
                        {step.seq}
                      </div>

                      {/* Title & Agent */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-black truncate font-sans">
                            {step.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500">
                          <span className="font-bold text-neutral-800 font-sans">
                            {agent?.name ? `${agent.name} · ${step.role_label || agent.role_label}` : (step.role_label || agent?.role_label || 'Orchestrator')}
                          </span>
                          {agent && (
                            <>
                              <span className="text-neutral-300">·</span>
                              <span className="font-mono text-[10px] text-neutral-500">{agent.model}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill & Expand Trigger */}
                    <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
                      {step.status === 'pending' && (
                        <span className="text-[11px] font-mono text-neutral-500 bg-[#f6f6f2] px-2.5 py-0.5 rounded border border-[#e2e2dc]">
                          Pending
                        </span>
                      )}
                      {step.status === 'running' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-black bg-[#d4f000] px-2.5 py-0.5 rounded border border-black font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping"></span>
                          Running
                        </span>
                      )}
                      {step.status === 'awaiting_approval' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-white bg-black px-2.5 py-0.5 rounded font-bold animate-pulse">
                          <Lock className="w-2.5 h-2.5 text-[#d4f000]" />
                          Awaiting Approval
                        </span>
                      )}
                      {step.status === 'done' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-neutral-800 bg-[#f6f6f2] px-2.5 py-0.5 rounded border border-[#e2e2dc] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                          Done
                        </span>
                      )}
                      {step.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-300 font-bold">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          Failed
                        </span>
                      )}

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-neutral-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Step Body */}
                  {isExpanded && (
                    <div className="border-t border-[#e2e2dc] bg-[#fafaf8] p-5 space-y-4 text-xs">
                      {/* Step Input / Instruction */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider flex items-center justify-between font-bold">
                          <span>Prompt / Instruction Template:</span>
                          <span className="text-neutral-400">Variables Injected</span>
                        </div>
                        <div className="p-3 rounded bg-white border border-[#e2e2dc] text-neutral-800 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                          {step.input}
                        </div>
                      </div>

                      {/* Step Output Formatted Markdown */}
                      {step.output ? (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider flex items-center justify-between font-bold">
                            <span>Step Output & Deliverable:</span>
                            {step.cost_cents !== undefined && (
                              <span className="text-black font-mono font-bold">
                                ${((step.cost_cents || 0) / 100).toFixed(3)} · {(step.tokens_in || 0) + (step.tokens_out || 0)} tokens
                              </span>
                            )}
                          </div>
                          <div className="p-4 rounded bg-white border border-[#e2e2dc] text-neutral-900 leading-relaxed text-xs max-h-96 overflow-y-auto font-sans">
                            <div className="prose prose-xs max-w-none space-y-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-black [&_h4]:text-xs [&_h4]:font-bold [&_h4]:text-black [&_ul]:list-disc [&_ul]:pl-4 [&_p]:text-neutral-800 [&_blockquote]:border-l-2 [&_blockquote]:border-black [&_blockquote]:pl-3 [&_blockquote]:italic">
                              <Markdown>{step.output}</Markdown>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 text-center rounded bg-white border border-[#e2e2dc] text-neutral-500 font-mono text-[11px]">
                          {step.status === 'running' ? (
                            <span className="flex items-center justify-center gap-2 text-black font-bold">
                              <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                              Orchestrator worker executing step...
                            </span>
                          ) : (
                            <span>Step is queued and awaiting prior step completion.</span>
                          )}
                        </div>
                      )}

                      {/* Error banner */}
                      {step.error && (
                        <div className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-800 text-xs flex items-center gap-2 font-mono">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{step.error}</span>
                        </div>
                      )}

                      {/* Tools & Metadata Footer */}
                      <div className="pt-2.5 border-t border-[#e2e2dc] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-neutral-500">
                        <div className="flex items-center gap-2">
                          <span>Tools:</span>
                          {(step.tools_called && step.tools_called.length > 0) ? (
                            step.tools_called.map(t => (
                              <span key={t} className="px-2 py-0.5 rounded bg-white border border-[#e2e2dc] text-black font-bold">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-neutral-400">None</span>
                          )}
                        </div>
                        {agent && (
                          <div className="flex items-center gap-1.5">
                            <span>Authority:</span>
                            <span className="text-black capitalize font-bold">{agent.authority}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: 40% (5 cols on lg) - STICKY GOAL, APPROVALS, ARTIFACTS */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          
          {/* Mission Goal Card */}
          <div className="dd-card p-5 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 border-b border-[#e2e2dc] pb-2.5">
              <span className="uppercase tracking-wider font-bold text-black">Mission Goal</span>
              <span className="text-black font-bold">Prompt Context</span>
            </div>
            <div className="text-xs text-neutral-800 leading-relaxed font-sans">
              {mission.goal}
            </div>
            <div className="pt-2.5 border-t border-[#e2e2dc] flex items-center justify-between text-[10px] font-mono text-neutral-500">
              <span>Initiated: {mission.created_by}</span>
              <span>{new Date(mission.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* OPEN APPROVALS (The Human-in-the-Loop Gate) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-black flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Open Approvals ({missionApprovals.length})</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black text-[#d4f000] font-bold">
                L4 Human Gate
              </span>
            </div>

            {missionApprovals.length === 0 ? (
              <div className="p-4 rounded border border-[#e2e2dc] bg-white text-center text-xs text-neutral-500 font-mono">
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-neutral-400" />
                <span>No pending approvals for this mission.</span>
              </div>
            ) : (
              missionApprovals.map(approval => {
                const isReviseOpen = isRevising[approval.id];
                return (
                  <div
                    key={approval.id}
                    className="rounded border border-black bg-white p-5 space-y-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-[#e2e2dc] pb-2.5">
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono uppercase text-black font-bold tracking-wider">
                          Human Authority Required
                        </div>
                        <h4 className="text-xs font-bold text-black font-sans">
                          {approval.question}
                        </h4>
                      </div>
                    </div>

                    {/* Agent Proposal */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider font-bold">
                        Agent Proposal:
                      </div>
                      <div className="p-3 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-xs text-neutral-800 leading-relaxed max-h-48 overflow-y-auto font-mono text-[11px]">
                        <div className="prose prose-xs max-w-none">
                          <Markdown>{approval.proposal}</Markdown>
                        </div>
                      </div>
                    </div>

                    {/* Revise Note Input */}
                    {isReviseOpen && (
                      <div className="space-y-2 pt-1">
                        <label className="text-[11px] font-bold text-black block font-sans">
                          Revision Guidance & Constraints:
                        </label>
                        <textarea
                          rows={3}
                          placeholder="e.g. Adjust pilot price to $6k, require 3 founder references, and modify paragraph 2..."
                          value={reviseNote[approval.id] || ''}
                          onChange={e => setReviseNote(prev => ({ ...prev, [approval.id]: e.target.value }))}
                          className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded p-2.5 text-xs text-black placeholder:text-neutral-400 focus:outline-hidden focus:border-black font-mono"
                        />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => setIsRevising(prev => ({ ...prev, [approval.id]: false }))}
                            className="px-3 py-1.5 rounded border border-[#e2e2dc] text-neutral-600 hover:text-black text-xs font-mono transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReviseSubmit(approval.id)}
                            className="px-3.5 py-1.5 rounded bg-black text-white font-bold hover:bg-neutral-800 text-xs flex items-center gap-1.5 transition-colors cursor-pointer font-mono shadow-xs"
                          >
                            <Send className="w-3 h-3" />
                            <span>Save & Proceed</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons: Approve, Revise, Reject */}
                    {!isReviseOpen && (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          id={`btn-approve-${approval.id}`}
                          onClick={() => handleApprove(approval.id)}
                          className="py-2 px-3 rounded bg-black text-[#d4f000] font-mono font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Approve</span>
                        </button>

                        <button
                          id={`btn-revise-${approval.id}`}
                          onClick={() => setIsRevising(prev => ({ ...prev, [approval.id]: true }))}
                          className="py-2 px-3 rounded bg-white border border-[#e2e2dc] text-black hover:border-black transition-colors flex items-center justify-center gap-1.5 text-xs font-mono font-bold cursor-pointer"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                          <span>Revise</span>
                        </button>

                        <button
                          id={`btn-reject-${approval.id}`}
                          onClick={() => handleReject(approval.id)}
                          className="py-2 px-3 rounded bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5 text-xs font-mono font-bold cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* MISSION ARTIFACTS LIST */}
          <div className="dd-card p-5 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 border-b border-[#e2e2dc] pb-2.5">
              <span className="uppercase tracking-wider font-bold text-black">Generated Artifacts</span>
              <span className="text-neutral-500">{missionArtifacts.length} Documents</span>
            </div>

            {missionArtifacts.length === 0 ? (
              <div className="py-4 text-center text-xs text-neutral-500 font-mono">
                No artifacts written yet. As steps complete, generated documents, briefs, and code appear here.
              </div>
            ) : (
              <div className="space-y-2">
                {missionArtifacts.map(art => (
                  <button
                    key={art.id}
                    onClick={() => setSelectedArtifact(art)}
                    className="w-full p-3 rounded bg-[#f6f6f2] border border-[#e2e2dc] hover:border-black text-left flex items-center justify-between group transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {art.kind === 'code' ? (
                        <Code className="w-4 h-4 text-black flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-black flex-shrink-0" />
                      )}
                      <span className="text-xs font-mono font-bold text-black group-hover:text-black truncate">
                        {art.title}
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black flex-shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Resolved Approvals History */}
          {resolvedApprovals.length > 0 && (
            <div className="dd-card p-4 space-y-2.5 text-xs">
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold">
                Decision Audit Log
              </div>
              {resolvedApprovals.map(a => (
                <div key={a.id} className="p-2.5 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-black truncate font-sans">{a.question}</span>
                    <span className={`font-mono capitalize font-bold ${
                      a.decision === 'approved' ? 'text-black' : a.decision === 'revised' ? 'text-neutral-700' : 'text-rose-700'
                    }`}>
                      {a.decision}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-500 flex items-center justify-between font-mono">
                    <span>By: {a.decided_by}</span>
                    <span>{a.decided_at ? new Date(a.decided_at).toLocaleTimeString() : ''}</span>
                  </div>
                  {a.note && (
                    <div className="text-[10px] text-neutral-700 italic bg-white p-2 rounded border border-[#e2e2dc] font-sans">
                      "{a.note}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ARTIFACT PREVIEW MODAL */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-black rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#e2e2dc] pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-black" />
                <h3 className="text-sm font-bold text-black font-sans">{selectedArtifact.title}</h3>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="text-neutral-400 hover:text-black text-xs font-mono px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#111111] text-[#fafafa] p-4 rounded border border-black font-mono text-xs whitespace-pre-wrap leading-relaxed">
              {selectedArtifact.body}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#e2e2dc] text-xs">
              <span className="text-neutral-500 font-mono text-[11px]">
                Kind: {selectedArtifact.kind} · Created: {new Date(selectedArtifact.created_at).toLocaleDateString()}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedArtifact.body || '');
                }}
                className="px-3.5 py-1.5 rounded bg-black text-white hover:bg-neutral-800 text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                Copy Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
