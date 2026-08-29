import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import { Mission, MissionStatus } from '../types';
import {
  Layers,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  DollarSign,
  Zap,
  ShieldCheck,
  Target,
  Workflow,
  Compass
} from 'lucide-react';
import { NewMissionModal } from './NewMissionModal';

interface MissionsListViewProps {
  onSelectMission: (missionId: string) => void;
}

export const MissionsListView: React.FC<MissionsListViewProps> = ({ onSelectMission }) => {
  const { missions, missionSteps, currentOrg, approvals, monthSpendCents } = useTeamOS();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMissions = missions.filter(m => {
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.goal.toLowerCase().includes(q) || (m.playbook_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusBadge = (status: MissionStatus, missionId: string) => {
    const hasPendingApproval = approvals.some(a => a.mission_id === missionId && !a.decision);
    if (hasPendingApproval) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#d4f000] text-black border border-black animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
          AWAITING L4 APPROVAL
        </span>
      );
    }

    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-900 text-white border border-neutral-700">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4f000] animate-ping"></span>
            RUNNING
          </span>
        );
      case 'done':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            DONE
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            BLOCKED / REJECTED
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300">
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
            DRAFT
          </span>
        );
    }
  };

  const getStepProgress = (missionId: string) => {
    const steps = missionSteps.filter(s => s.mission_id === missionId);
    if (steps.length === 0) return '0 / 0';
    const doneCount = steps.filter(s => s.status === 'done').length;
    return `${doneCount} / ${steps.length}`;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 w-full">
      
      {/* SECTION 01: THE PREMISE (Exact D&D Header) */}
      <section className="space-y-3">
        <div className="dd-section-tag text-black">
          01 / THE PREMISE
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black font-sans leading-tight max-w-4xl">
          Most companies have a vision for their future. They don't have an operating system for getting there.
        </h1>
        <p className="text-sm text-neutral-600 max-w-3xl leading-relaxed">
          Strategy without structural execution degrades into stochastic noise. D&D replaces unpredictable prompt chains with deterministic state machines, human-gated authority levels, and persistent verified organizational memory.
        </p>
      </section>

      {/* SECTION 02: THE ARCHITECTURE (① FUTURE STATE -> ② ALIGNMENT BLUEPRINT -> ③ FUTURE OS) */}
      <section className="space-y-4">
        <div className="dd-section-tag text-black">
          02 / THE ARCHITECTURE
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative items-stretch">
          {/* Box 1 */}
          <div className="dd-flow-box flex flex-col justify-between p-6">
            <div className="space-y-2 text-left">
              <div className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">
                ① FUTURE STATE
              </div>
              <div className="text-base font-bold text-black font-sans">
                Vision & Intent Definition
              </div>
              <p className="text-xs text-neutral-600 leading-normal">
                High-level objectives, strategic guardrails, ICP boundaries, and target metrics formulated by leadership.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-200 text-left font-mono text-[10px] text-neutral-400">
              INPUT: GOALS & CONSTRAINTS
            </div>
          </div>

          {/* Box 2 */}
          <div className="dd-flow-box flex flex-col justify-between p-6">
            <div className="space-y-2 text-left">
              <div className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-wider">
                ② ALIGNMENT BLUEPRINT
              </div>
              <div className="text-base font-bold text-black font-sans">
                Step Graphs & Gates
              </div>
              <p className="text-xs text-neutral-600 leading-normal">
                Deterministic DAG execution sequences with explicit L0-L4 role assignments and human approval gates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-200 text-left font-mono text-[10px] text-neutral-400">
              SPEC: POSTGRES + RLS SCHEMA
            </div>
          </div>

          {/* Box 3 - Highlighted Box with Chartreuse Frame */}
          <div className="dd-flow-box dd-flow-box-highlight flex flex-col justify-between p-6 relative">
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-black uppercase tracking-wider">
                  ③ FUTURE OS
                </span>
                <span className="w-2 h-2 rounded-full bg-[#d4f000] border border-black"></span>
              </div>
              <div className="text-base font-bold text-black font-sans">
                Autonomous Execution Loop
              </div>
              <p className="text-xs text-neutral-600 leading-normal">
                Polls job queues via single-seat orchestrator, invokes typed agent tools, and yields before L4 actions.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-200 text-left font-mono text-[10px] font-bold text-black flex items-center justify-between">
              <span>OUTPUT: VERIFIED ARTIFACTS</span>
              <span className="text-[#98ab00]">LIVE</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 03: THE ALIGNMENT PROBLEM (Inverted Dark Architectural Panel) */}
      <section className="space-y-4">
        <div className="dd-section-tag text-black">
          03 / THE ALIGNMENT PROBLEM
        </div>

        <div className="dd-dark-panel p-8 relative overflow-hidden">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 dd-dark-grid-bg opacity-30 pointer-events-none"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <h2 className="text-2xl font-bold font-sans tracking-tight text-white">
                Eliminate Stochastic Drift Across Autonomous Teams
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                When multi-agent systems communicate organically, small errors compound exponentially across handoffs. D&D enforces strict single-seat task execution, typed structured outputs, and human sign-off on irreversible operations.
              </p>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <div className="text-[10px] font-mono text-neutral-400">DRIFT PREVENTION</div>
                  <div className="text-sm font-bold text-[#d4f000] font-mono">100% Deterministic</div>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <div className="text-[10px] font-mono text-neutral-400">IRREVERSIBLE ACTIONS</div>
                  <div className="text-sm font-bold text-white font-mono">L4 Human Gate</div>
                </div>
              </div>
            </div>

            {/* Convergence Diagram: AMBITION, DECISIONS, OWNERSHIP, EXECUTION -> CENTRAL NODE */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-black/60 border border-neutral-800 rounded relative">
              <div className="grid grid-cols-2 gap-6 w-full max-w-sm text-center">
                <div className="p-3 border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 font-bold">
                  AMBITION
                </div>
                <div className="p-3 border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 font-bold">
                  DECISIONS
                </div>
                <div className="p-3 border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 font-bold">
                  OWNERSHIP
                </div>
                <div className="p-3 border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 font-bold">
                  EXECUTION
                </div>
              </div>

              {/* Central Junction Marker */}
              <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-[#d4f000] text-black font-mono text-xs font-bold rounded">
                <Target className="w-3.5 h-3.5" />
                <span>ALIGNMENT CONVERGENCE NODE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 04: EVIDENCE (Live Metrics with Chartreuse Indicators) */}
      <section className="space-y-4">
        <div className="dd-section-tag text-black">
          04 / EVIDENCE & REPRODUCIBILITY
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1 */}
          <div className="dd-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase">CLARITY INDEX</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#d4f000] text-black rounded">
                +14 PTS
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-black">62</div>
            <div className="w-full bg-neutral-100 h-1.5 rounded overflow-hidden">
              <div className="bg-[#d4f000] h-full" style={{ width: '62%' }}></div>
            </div>
            <p className="text-[11px] text-neutral-500">Cross-agent instruction compliance without prompt drifting.</p>
          </div>

          {/* Metric 2 */}
          <div className="dd-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase">DECISION VELOCITY</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-black text-white rounded">
                -28% MS
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-black">21s</div>
            <div className="w-full bg-neutral-100 h-1.5 rounded overflow-hidden">
              <div className="bg-black h-full" style={{ width: '79%' }}></div>
            </div>
            <p className="text-[11px] text-neutral-500">Average round-trip step resolution across autonomous loop.</p>
          </div>

          {/* Metric 3 */}
          <div className="dd-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase">COHESION RATING</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#d4f000] text-black rounded">
                +19 PTS
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-black">57</div>
            <div className="w-full bg-neutral-100 h-1.5 rounded overflow-hidden">
              <div className="bg-[#d4f000] h-full" style={{ width: '57%' }}></div>
            </div>
            <p className="text-[11px] text-neutral-500">Approved team memory facts consistently injected into context.</p>
          </div>

          {/* Metric 4 */}
          <div className="dd-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase">OUTCOME PREDICTABILITY</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-[#d4f000] text-black rounded">
                +11 PTS
              </span>
            </div>
            <div className="text-3xl font-black font-mono text-black">48</div>
            <div className="w-full bg-neutral-100 h-1.5 rounded overflow-hidden">
              <div className="bg-[#d4f000] h-full" style={{ width: '48%' }}></div>
            </div>
            <p className="text-[11px] text-neutral-500">Zero unhandled hallucinated steps on production missions.</p>
          </div>
        </div>
      </section>

      {/* SECTION 05: ACTIVE MISSIONS & DISPATCH */}
      <section className="space-y-4 pt-4 border-t border-[#e2e2dc]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="dd-section-tag text-black">
              05 / ACTIVE MISSIONS & QUEUE
            </div>
            <h2 className="text-xl font-bold tracking-tight text-black font-sans mt-1">
              Mission Orchestrator Queue ({missions.length})
            </h2>
          </div>

          <button
            id="btn-new-mission"
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2.5 rounded bg-black text-white font-mono font-bold text-xs hover:bg-neutral-800 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>LAUNCH MISSION →</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search missions by title, goal, or playbook..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#e2e2dc] rounded pl-9 pr-3.5 py-2 text-black placeholder:text-neutral-400 focus:outline-hidden focus:border-black font-medium text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            {['all', 'running', 'done', 'blocked'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded text-xs font-mono capitalize transition-all ${
                  filterStatus === status
                    ? 'bg-black text-white font-bold'
                    : 'bg-white text-neutral-600 hover:text-black border border-[#e2e2dc]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Missions Table Container */}
        <div className="dd-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e2e2dc] bg-[#fafaf8] text-neutral-600 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-bold">Mission Title & Playbook</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Step Progress</th>
                  <th className="py-3 px-4 font-bold">Tokens & Cost</th>
                  <th className="py-3 px-4 font-bold">Created</th>
                  <th className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e2dc]">
                {filteredMissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      <Layers className="w-7 h-7 mx-auto mb-2 opacity-30" />
                      <div>No missions found. Launch your first playbook mission above.</div>
                    </td>
                  </tr>
                ) : (
                  filteredMissions.map(m => {
                    const mSteps = missionSteps.filter(s => s.mission_id === m.id);
                    const totalCost = mSteps.reduce((sum, s) => sum + (s.cost_cents || 0), 0);
                    const totalTokens = mSteps.reduce((sum, s) => sum + (s.tokens_in || 0) + (s.tokens_out || 0), 0);

                    return (
                      <tr
                        key={m.id}
                        onClick={() => onSelectMission(m.id)}
                        className="hover:bg-[#fafaf8] cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 min-w-[240px]">
                          <div className="font-bold text-black group-hover:text-black transition-colors flex items-center gap-2">
                            <span className="truncate">{m.title}</span>
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate mt-0.5 font-sans">
                            {m.playbook_name || 'Custom Playbook'} · <span className="font-mono text-[10px] text-neutral-400">{m.id}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(m.status, m.id)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-black font-bold">
                              {getStepProgress(m.id)}
                            </span>
                            <div className="w-16 h-1.5 bg-neutral-100 rounded overflow-hidden border border-neutral-200">
                              <div
                                className="h-full bg-[#d4f000]"
                                style={{
                                  width: mSteps.length > 0
                                    ? `${(mSteps.filter(s => s.status === 'done').length / mSteps.length) * 100}%`
                                    : '0%'
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                          <div className="text-black font-bold">
                            ${(totalCost / 100).toFixed(3)}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {totalTokens.toLocaleString()} tok
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-neutral-500 text-[11px] font-mono">
                          {new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-600 group-hover:text-black font-mono font-bold transition-colors">
                            <span>INSPECT</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <NewMissionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />
    </div>
  );
};

