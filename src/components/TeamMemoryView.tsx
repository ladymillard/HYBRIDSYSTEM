import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import { MemoryFact, MemoryFactKind } from '../types';
import {
  Brain,
  Check,
  X,
  RotateCcw,
  Plus,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Lightbulb,
  FileCheck,
  Sliders
} from 'lucide-react';

interface TeamMemoryViewProps {
  onNavigateToMission?: (missionId: string) => void;
}

export const TeamMemoryView: React.FC<TeamMemoryViewProps> = ({ onNavigateToMission }) => {
  const {
    inEffectMemory,
    proposedMemory,
    approveMemoryFact,
    dismissMemoryFact,
    revokeMemoryFact,
    addMemoryFact,
    currentUser
  } = useTeamOS();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newKind, setNewKind] = useState<MemoryFactKind>('lesson');
  const [newBody, setNewBody] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim()) return;
    addMemoryFact({ kind: newKind, body: newBody.trim() });
    setNewBody('');
    setShowAddModal(false);
  };

  // Group In Effect by Kind (Prompt 4)
  const groupedInEffect: Record<MemoryFactKind, MemoryFact[]> = {
    preference: inEffectMemory.filter(m => m.kind === 'preference'),
    decision: inEffectMemory.filter(m => m.kind === 'decision'),
    lesson: inEffectMemory.filter(m => m.kind === 'lesson'),
    fact: inEffectMemory.filter(m => m.kind === 'fact')
  };

  const groupLabels: Record<MemoryFactKind, { kind: MemoryFactKind; title: string; desc: string; icon: any }> = {
    preference: { kind: 'preference', title: 'Preferences', desc: 'Formatting rules, tone constraints, and structural output patterns.', icon: Sliders },
    decision: { kind: 'decision', title: 'Decisions', desc: 'Hardened strategic and architectural determinations agreed upon.', icon: FileCheck },
    lesson: { kind: 'lesson', title: 'Lessons', desc: 'Post-mission discoveries, red-team learnings, and operational caveats.', icon: Lightbulb },
    fact: { kind: 'fact', title: 'Facts', desc: 'Verified company profiles, target ICP criteria, and baseline truths.', icon: ShieldCheck }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2dc] pb-6">
        <div>
          <div className="dd-section-tag text-black mb-1">
            04 / VERIFIED ORGANIZATIONAL MEMORY
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-black font-sans">Team Memory Engine</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 border border-[#e2e2dc] text-neutral-700">
              {inEffectMemory.length} In Effect · {proposedMemory.length} Proposed
            </span>
          </div>
          {/* Prompt 4 mandatory line */}
          <p className="text-xs text-black font-bold mt-1 flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#d4f000] border border-black"></span>
            <span>Your team only acts on what you have approved here.</span>
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded bg-black text-white font-mono font-bold text-xs hover:bg-neutral-800 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>ADD MEMORY FACT →</span>
        </button>
      </div>

      {/* TWO COLUMNS LAYOUT: LEFT "IN EFFECT", RIGHT "PROPOSED" */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: IN EFFECT (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black"></span>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                In Effect ({inEffectMemory.length})
              </h2>
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">
              Injected into agent prompts
            </span>
          </div>

          <div className="space-y-4">
            {(['preference', 'decision', 'lesson', 'fact'] as MemoryFactKind[]).map(kindKey => {
              const meta = groupLabels[kindKey];
              const items = groupedInEffect[kindKey];
              const Icon = meta.icon;

              return (
                <div key={kindKey} className="dd-card overflow-hidden">
                  <div className="py-2.5 px-4 bg-[#fafaf8] border-b border-[#e2e2dc] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-black" />
                      <span className="text-xs font-bold text-black font-mono uppercase">{meta.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 font-bold">
                      {items.length} {items.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>

                  <div className="divide-y divide-[#e2e2dc]">
                    {items.length === 0 ? (
                      <div className="p-4 text-center text-[11px] text-neutral-400 font-mono">
                        No active {meta.title.toLowerCase()} configured.
                      </div>
                    ) : (
                      items.map(fact => (
                        <div
                          key={fact.id}
                          className="p-4 hover:bg-[#fafaf8] transition-colors group flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <p className="text-neutral-900 leading-relaxed font-sans font-medium">
                              {fact.body}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500 font-mono">
                              <span>Approved by <strong className="text-black font-semibold">{fact.approved_by}</strong></span>
                              <span>·</span>
                              <span>{new Date(fact.approved_at || fact.created_at).toLocaleDateString()}</span>
                              {fact.source_mission_title && (
                                <>
                                  <span>·</span>
                                  <span className="text-neutral-600 truncate max-w-[200px]">
                                    From: {fact.source_mission_title}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Hover action: Remove */}
                          <button
                            title="Remove from active context (moves to proposed)"
                            onClick={() => revokeMemoryFact(fact.id)}
                            className="opacity-0 group-hover:opacity-100 px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-rose-600 text-[10px] font-mono transition-all flex items-center gap-1 border border-[#e2e2dc]"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: PROPOSED (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#d4f000] border border-black animate-pulse"></span>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-black">
                Proposed for Review ({proposedMemory.length})
              </h2>
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">
              Not in context until approved
            </span>
          </div>

          {proposedMemory.length === 0 ? (
            <div className="p-8 dd-card text-center space-y-2.5">
              <Brain className="w-8 h-8 mx-auto text-neutral-300" />
              <div className="text-xs text-black font-bold font-sans">All memory proposals reviewed</div>
              <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">
                As autonomous missions run, agents will synthesize candidate lessons and propose them here for your sign-off.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {proposedMemory.map(prop => (
                <div
                  key={prop.id}
                  className="p-5 dd-card space-y-3 text-xs shadow-xs border-black"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-black text-white font-bold">
                      PROPOSED {prop.kind}
                    </span>
                    {prop.suggested_by_role && (
                      <span className="text-[10px] font-mono text-neutral-500">
                        Suggested by {prop.suggested_by_role}
                      </span>
                    )}
                  </div>

                  <p className="text-black font-medium leading-relaxed font-sans">
                    {prop.body}
                  </p>

                  {prop.source_mission_title && (
                    <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1.5 bg-[#f6f6f2] p-2 rounded border border-[#e2e2dc]">
                      <Layers className="w-3 h-3 text-neutral-400" />
                      <span className="truncate">Source: {prop.source_mission_title}</span>
                    </div>
                  )}

                  {/* Approve and Dismiss Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#e2e2dc]">
                    <button
                      onClick={() => approveMemoryFact(prop.id)}
                      className="py-2 px-3 rounded bg-black text-white font-mono font-bold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 text-xs shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-[#d4f000] stroke-[2.5]" />
                      <span>Approve into Context</span>
                    </button>

                    <button
                      onClick={() => dismissMemoryFact(prop.id)}
                      className="py-2 px-3 rounded bg-white border border-[#e2e2dc] text-neutral-600 hover:text-black hover:border-black transition-colors flex items-center justify-center gap-1.5 text-xs cursor-pointer font-mono font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADD MEMORY FACT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-black rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e2dc] pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-black" />
                <h3 className="text-sm font-bold text-black font-sans">Add Team Memory Fact</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-neutral-400 hover:text-black text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-700 font-medium mb-1.5">Fact Kind</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['preference', 'decision', 'lesson', 'fact'] as MemoryFactKind[]).map(k => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setNewKind(k)}
                      className={`p-2.5 rounded border text-center font-mono capitalize transition-all ${
                        newKind === k
                          ? 'bg-black border-black text-white font-bold'
                          : 'bg-white border-[#e2e2dc] text-neutral-700 hover:border-black'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1.5">Knowledge Body</label>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Always format strategic memos with 3-bullet Executive Summary..."
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded p-2.5 text-black placeholder:text-neutral-400 focus:outline-hidden focus:border-black font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e2dc]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded border border-[#e2e2dc] text-neutral-600 hover:text-black transition-colors font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-black text-white font-mono font-bold hover:bg-neutral-800 shadow-xs transition-all cursor-pointer text-xs"
                >
                  Add Fact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
