import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import { Playbook, PlaybookStep } from '../types';
import {
  BookOpen,
  Plus,
  Play,
  Copy,
  Edit,
  Layers,
  Sparkles,
  Lock,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ArrowRight,
  Workflow
} from 'lucide-react';
import { NewMissionModal } from './NewMissionModal';

export const PlaybooksView: React.FC = () => {
  const { playbooks, addPlaybook, agents } = useTeamOS();
  const [selectedPlaybookToRun, setSelectedPlaybookToRun] = useState<string | null>(null);
  const [isNewMissionOpen, setIsNewMissionOpen] = useState(false);
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(playbooks[0]?.id || null);

  const handleLaunch = (playbookId: string) => {
    setSelectedPlaybookToRun(playbookId);
    setIsNewMissionOpen(true);
  };

  const handleDuplicate = (pb: Playbook) => {
    const clonedSteps: PlaybookStep[] = pb.steps.map(s => ({
      ...s,
      id: `pbs-${Date.now()}-${s.seq}`,
      playbook_id: `pb-${Date.now()}`
    }));

    addPlaybook({
      org_id: 'custom',
      name: `${pb.name} (Custom Copy)`,
      description: pb.description,
      category: pb.category,
      steps: clonedSteps,
      estimated_tokens: pb.estimated_tokens,
      estimated_cost_cents: pb.estimated_cost_cents
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2dc] pb-6">
        <div>
          <div className="dd-section-tag text-black mb-1">
            03 / PLAYBOOK SEQUENCE GRAPHS
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-black font-sans">Deterministic Playbooks</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 border border-[#e2e2dc] text-neutral-700">
              {playbooks.length} Active DAGs
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Deterministic step graphs. Eliminates stochastic planning drift and ensures reproducible outcomes.
          </p>
        </div>

        <button
          onClick={() => handleDuplicate(playbooks[0])}
          className="px-4 py-2 rounded bg-black text-white font-mono font-bold text-xs hover:bg-neutral-800 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>NEW CUSTOM PLAYBOOK →</span>
        </button>
      </div>

      {/* Playbooks List */}
      <div className="space-y-4">
        {playbooks.map(pb => {
          const isExpanded = expandedPlaybookId === pb.id;
          return (
            <div
              key={pb.id}
              className="dd-card overflow-hidden transition-all"
            >
              {/* Playbook Header Bar */}
              <div className="p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e2dc]">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-black font-sans">
                      {pb.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 uppercase font-semibold">
                      {pb.category}
                    </span>
                    {pb.org_id === null && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                        SYSTEM TEMPLATE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                    {pb.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right font-mono text-[11px] text-neutral-500 mr-2 hidden md:block">
                    <div className="text-black font-bold">{pb.steps.length} Steps</div>
                    <div className="text-[10px] text-neutral-600 font-mono">~${((pb.estimated_cost_cents || 25) / 100).toFixed(2)}/run</div>
                  </div>

                  <button
                    onClick={() => handleDuplicate(pb)}
                    className="p-2 rounded border border-[#e2e2dc] bg-white text-neutral-600 hover:text-black hover:border-black transition-colors"
                    title="Clone playbook"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleLaunch(pb.id)}
                    className="px-3.5 py-1.5 rounded bg-black text-white font-mono font-bold hover:bg-neutral-800 text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>RUN PLAYBOOK</span>
                  </button>

                  <button
                    onClick={() => setExpandedPlaybookId(isExpanded ? null : pb.id)}
                    className="p-2 rounded border border-[#e2e2dc] bg-white text-neutral-600 hover:text-black hover:border-black transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Playbook Steps Details */}
              {isExpanded && (
                <div className="p-5 bg-[#fafaf8] space-y-4">
                  <div className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider">
                    Execution Graph Sequence ({pb.steps.length} Steps)
                  </div>

                  <div className="space-y-3">
                    {pb.steps.map(step => (
                      <div
                        key={step.id}
                        className="p-4 rounded border border-[#e2e2dc] bg-white space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-black font-mono text-[10px] font-bold text-[#d4f000] flex items-center justify-center">
                              {step.seq}
                            </span>
                            <span className="font-bold text-black font-sans">{step.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const matchingAgent = agents.find(a => a.role_label.toLowerCase() === step.role_label.toLowerCase() || a.name?.toLowerCase() === step.role_label.toLowerCase());
                              return (
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 font-semibold">
                                  {matchingAgent?.name ? `${matchingAgent.name} (${step.role_label})` : step.role_label}
                                </span>
                              );
                            })()}
                            {step.requires_approval && (
                              <span className="inline-flex items-center gap-1 font-mono text-[9px] px-2 py-0.5 rounded bg-[#d4f000] text-black border border-black font-bold">
                                <Lock className="w-2.5 h-2.5" />
                                L4 GATE
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded bg-[#f6f6f2] font-mono text-[11px] text-neutral-700 border border-[#e2e2dc] whitespace-pre-wrap">
                          {step.instruction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <NewMissionModal
        isOpen={isNewMissionOpen}
        onClose={() => setIsNewMissionOpen(false)}
        initialPlaybookId={selectedPlaybookToRun}
      />
    </div>
  );
};

