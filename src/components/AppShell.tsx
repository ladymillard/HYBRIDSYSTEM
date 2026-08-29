import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import {
  Layers,
  Users,
  Brain,
  BookOpen,
  FileCode2,
  Settings,
  ChevronDown,
  Plus,
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  children
}) => {
  const {
    currentOrg,
    orgs,
    switchOrg,
    createOrg,
    currentUser,
    monthSpendCents,
    spendPercentage,
    isSpendCapped,
    workerStatus,
    toggleAutoWorker,
    tickWorker,
    isProcessingStep,
    approvals,
    proposedMemory,
    missions,
    resetToSeedData
  } = useTeamOS();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<'trial' | 'team' | 'enterprise'>('team');

  const pendingApprovalsCount = approvals.filter(a => !a.decision).length;
  const proposedMemoryCount = proposedMemory.length;
  const activeMissionsCount = missions.filter(m => m.status === 'running' || m.status === 'draft').length;

  const handleCreateOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    createOrg(newOrgName.trim(), newOrgPlan);
    setNewOrgName('');
    setShowNewOrgModal(false);
    setOrgDropdownOpen(false);
  };

  const navItems = [
    {
      id: 'missions',
      seq: '01',
      label: 'Missions',
      code: 'APPROACH',
      icon: Layers,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} req` : (activeMissionsCount > 0 ? `${activeMissionsCount}` : undefined),
      badgeColor: pendingApprovalsCount > 0 ? 'bg-[#d4f000] text-neutral-950 font-bold' : 'bg-neutral-100 text-neutral-600'
    },
    {
      id: 'team',
      seq: '02',
      label: 'Team Roster',
      code: 'WORK',
      icon: Users
    },
    {
      id: 'playbooks',
      seq: '03',
      label: 'Playbooks',
      code: 'ARCHITECTURE',
      icon: BookOpen
    },
    {
      id: 'memory',
      seq: '04',
      label: 'Team Memory',
      code: 'EVIDENCE',
      icon: Brain,
      badge: proposedMemoryCount > 0 ? `${proposedMemoryCount} new` : undefined,
      badgeColor: 'bg-[#d4f000] text-neutral-950 font-bold'
    },
    {
      id: 'blueprint',
      seq: '05',
      label: 'Blueprint & Spec',
      code: 'OUTCOME',
      icon: FileCode2,
      badge: 'v1 spec',
      badgeColor: 'bg-black text-white font-mono text-[9px]'
    },
    {
      id: 'settings',
      seq: '06',
      label: 'Settings',
      code: 'TENANCY',
      icon: Settings
    }
  ];

  return (
    <div className="relative flex flex-col h-screen w-full bg-[#f6f6f2] text-[#111111] overflow-hidden select-none dd-grid-bg">
      {/* D&D TOP NAVBAR (Matches top bar of D&D aesthetic) */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-[#e2e2dc] px-6 flex items-center justify-between z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {/* Brand Logo & Tag */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black font-sans tracking-tight text-black">D&D</span>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-[#f6f6f2] border border-[#e2e2dc] rounded text-[10px] font-mono text-neutral-600 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4f000]"></span>
              <span>FUTURE OS</span>
            </div>
          </div>

          {/* Org Switcher */}
          <div className="relative">
            <button
              id="org-switcher-button"
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#e2e2dc] bg-white hover:border-black text-left transition-colors text-xs"
            >
              <span className="font-bold text-black">{currentOrg.name}</span>
              <span className="text-[10px] font-mono text-neutral-500 uppercase">({currentOrg.plan})</span>
              <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {orgDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-black rounded shadow-xl py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] font-mono text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                  Organizations
                </div>
                {orgs.map(org => (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchOrg(org.id);
                      setOrgDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-neutral-100 transition-colors ${
                      org.id === currentOrg.id ? 'bg-neutral-50 text-black font-bold' : 'text-neutral-700'
                    }`}
                  >
                    <span className="truncate">{org.name}</span>
                    <span className="text-[10px] font-mono text-neutral-400 uppercase">{org.plan}</span>
                  </button>
                ))}
                <div className="border-t border-neutral-200 my-1"></div>
                <button
                  onClick={() => {
                    setShowNewOrgModal(true);
                    setOrgDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-black hover:bg-neutral-100 flex items-center gap-1.5 font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create new team</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation Links (styled cleanly like D&D top right nav) */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onTabChange(item.id)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-semibold tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-black text-white shadow-xs'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Top Right Controls: Worker Indicator & Token Cap */}
        <div className="flex items-center gap-3">
          {/* Worker Status Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#f6f6f2] border border-[#e2e2dc] rounded text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isProcessingStep ? 'bg-[#d4f000]' : 'bg-emerald-500'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isProcessingStep ? 'bg-[#d4f000]' : 'bg-emerald-500'
              }`}></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-neutral-800">
              {isProcessingStep ? 'RUNNING' : workerStatus.autoWorkerEnabled ? 'ACTIVE (10s)' : 'PAUSED'}
            </span>
            <button
              onClick={toggleAutoWorker}
              className="text-[9px] font-mono text-neutral-500 hover:text-black underline ml-0.5"
            >
              {workerStatus.autoWorkerEnabled ? 'PAUSE' : 'RESUME'}
            </button>
            <button
              onClick={() => tickWorker()}
              disabled={isProcessingStep}
              title="Manually execute next step"
              className="text-[10px] text-black font-bold flex items-center gap-0.5 hover:opacity-75 disabled:opacity-40 ml-1"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
            </button>
          </div>

          {/* Reset state */}
          <button
            title="Reset state to D&D seed data"
            onClick={resetToSeedData}
            className="p-1.5 text-neutral-400 hover:text-black rounded hover:bg-neutral-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="md:hidden flex items-center justify-around bg-white border-b border-[#e2e2dc] px-2 py-1.5 z-20 overflow-x-auto">
        {navItems.map(item => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`px-2.5 py-1 text-[11px] font-mono uppercase whitespace-nowrap rounded ${
                isActive ? 'bg-black text-white font-bold' : 'text-neutral-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-transparent relative z-10">
        {children}

        {/* D&D FOOTER (Exact Match with Image Bottom: "D&D" ... "© D&D ALL RIGHTS RESERVED") */}
        <footer className="mt-auto border-t border-[#e2e2dc] bg-white px-8 py-4 flex items-center justify-between text-[11px] font-mono text-neutral-500">
          <div className="flex items-center gap-3">
            <span className="font-bold text-black font-sans text-xs">D&D</span>
            <span>·</span>
            <span>AUTONOMOUS TEAM OPERATING SYSTEM</span>
          </div>
          <div>
            © D&D ALL RIGHTS RESERVED
          </div>
        </footer>
      </main>

      {/* CREATE NEW ORG MODAL */}
      {showNewOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-black rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e2dc] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#d4f000] inline-block"></span>
                <h3 className="text-sm font-bold text-black font-mono">Create Team Organization</h3>
              </div>
              <button
                onClick={() => setShowNewOrgModal(false)}
                className="text-neutral-400 hover:text-black text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrgSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-700 font-medium mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Ventures, Nomad Studios"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded px-3 py-2 text-black placeholder:text-neutral-400 focus:outline-hidden focus:border-black font-medium"
                />
              </div>

              <div>
                <label className="block text-neutral-700 font-medium mb-1">Target Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['trial', 'team', 'enterprise'] as const).map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setNewOrgPlan(p)}
                      className={`py-2 px-2.5 rounded border text-center font-mono capitalize transition-all ${
                        newOrgPlan === p
                          ? 'bg-black text-white border-black font-bold'
                          : 'bg-white border-[#e2e2dc] text-neutral-600 hover:border-black'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-[11px] text-neutral-600 space-y-1">
                <div className="text-black font-semibold">Automatic Provisioning:</div>
                <div>• Initial Postgres schema & tenant isolation (RLS)</div>
                <div>• Default 3-seat AI executive roster (Strategy, Reviewer, Ops)</div>
                <div>• Token metering cap set to {newOrgPlan === 'trial' ? '$25.00' : newOrgPlan === 'team' ? '$100.00' : '$500.00'}/mo</div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e2e2dc]">
                <button
                  type="button"
                  onClick={() => setShowNewOrgModal(false)}
                  className="px-3.5 py-2 rounded border border-[#e2e2dc] text-neutral-600 hover:text-black hover:bg-neutral-100 transition-colors font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-black text-white font-bold hover:bg-neutral-800 transition-colors font-mono text-xs shadow-xs"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

