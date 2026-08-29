import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import {
  Settings,
  Shield,
  DollarSign,
  Users,
  Database,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Clock,
  Key,
  HardDrive
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    currentOrg,
    members,
    updateOrgCap,
    usageEvents,
    monthSpendCents,
    spendPercentage,
    resetToSeedData
  } = useTeamOS();

  const [capDollars, setCapDollars] = useState(currentOrg.monthly_cost_cap_cents / 100);
  const [isSaved, setIsSaved] = useState(false);

  const orgMembers = members.filter(m => m.org_id === currentOrg.id);

  const handleSaveCap = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrgCap(Math.round(capDollars * 100));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2dc] pb-6">
        <div>
          <div className="dd-section-tag text-black mb-1">
            05 / TENANCY CONFIGURATION & QUOTAS
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-black font-sans">Settings & Tenancy Controls</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 border border-[#e2e2dc] text-neutral-700">
              {currentOrg.slug}
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Tenant quotas, spending caps, member permissions, and model routing parameters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Organization & Plan */}
        <div className="dd-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#e2e2dc] pb-3">
            <h2 className="text-xs font-mono font-bold uppercase text-black">
              Organization Profile
            </h2>
            <span className="capitalize font-mono text-[10px] px-2 py-0.5 rounded bg-black text-white font-bold">
              {currentOrg.plan} Tier
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-neutral-500 block text-[11px] font-mono mb-1">Company / Organization Name</label>
              <div className="font-bold text-black bg-[#f6f6f2] p-2.5 rounded border border-[#e2e2dc] font-sans">
                {currentOrg.name}
              </div>
            </div>

            <div>
              <label className="text-neutral-500 block text-[11px] font-mono mb-1">Tenant Slug (RLS Isolation Key)</label>
              <div className="font-mono text-black bg-[#f6f6f2] p-2.5 rounded border border-[#e2e2dc]">
                {currentOrg.slug}
              </div>
            </div>

            <div>
              <label className="text-neutral-500 block text-[11px] font-mono mb-1">Created Timestamp</label>
              <div className="font-mono text-neutral-600 bg-[#f6f6f2] p-2.5 rounded border border-[#e2e2dc]">
                {new Date(currentOrg.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Cost Cap & Metering */}
        <div className="dd-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#e2e2dc] pb-3">
            <h2 className="text-xs font-mono font-bold uppercase text-black flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Token Spending Meter</span>
            </h2>
            <span className="font-mono text-[11px] text-neutral-600 font-bold">
              ${(monthSpendCents / 100).toFixed(2)} / ${capDollars.toFixed(2)}
            </span>
          </div>

          <form onSubmit={handleSaveCap} className="space-y-3">
            <div>
              <label className="text-black font-bold block mb-1 font-sans">
                Monthly Spending Ceiling ($ USD)
              </label>
              <p className="text-[11px] text-neutral-600 mb-2">
                Worker checks this limit before leasing each step. Execution halts if cap is reached.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="5"
                  min="5"
                  max="5000"
                  value={capDollars}
                  onChange={e => setCapDollars(Number(e.target.value))}
                  className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded px-3 py-2 text-black font-mono text-xs focus:outline-hidden focus:border-black font-bold"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-black text-white font-mono font-bold hover:bg-neutral-800 flex-shrink-0 shadow-xs transition-all cursor-pointer text-xs"
                >
                  Update Cap
                </button>
              </div>
              {isSaved && (
                <div className="text-[11px] text-black mt-1.5 flex items-center gap-1 font-mono font-bold">
                  <CheckCircle2 className="w-3 h-3 text-[#d4f000]" />
                  <span>Cap updated successfully</span>
                </div>
              )}
            </div>

            {/* Quick preset buttons */}
            <div className="flex items-center gap-2 pt-2 text-[11px] font-mono">
              <span className="text-neutral-500">Presets:</span>
              {[25, 50, 100, 250, 500].map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => {
                    setCapDollars(val);
                    updateOrgCap(val * 100);
                  }}
                  className="px-2.5 py-1 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-neutral-700 hover:text-black hover:border-black transition-colors cursor-pointer"
                >
                  ${val}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>

      {/* Organization Members Table */}
      <div className="dd-card overflow-hidden">
        <div className="p-4 bg-[#fafaf8] border-b border-[#e2e2dc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-black" />
            <h3 className="text-xs font-mono font-bold text-black uppercase">Organization Members</h3>
          </div>
          <span className="text-[10px] font-mono text-neutral-500 font-bold">
            {orgMembers.length} Verified Seats
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#e2e2dc] bg-[#f6f6f2] text-neutral-600 text-[10px] uppercase">
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5">Email</th>
                <th className="py-3 px-5">Role</th>
                <th className="py-3 px-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e2dc] font-sans">
              {orgMembers.map(member => (
                <tr key={member.user_id} className="hover:bg-[#fafaf8] transition-colors">
                  <td className="py-3 px-5 font-bold text-black">{member.name}</td>
                  <td className="py-3 px-5 font-mono text-neutral-600 text-[11px]">{member.email}</td>
                  <td className="py-3 px-5">
                    <span className="capitalize text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-black border border-[#e2e2dc] font-bold">
                      {member.role}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-black font-mono text-[10px] font-bold">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d4f000] border border-black"></span>
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Events Log */}
      <div className="dd-card overflow-hidden">
        <div className="p-4 bg-[#fafaf8] border-b border-[#e2e2dc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-black" />
            <h3 className="text-xs font-mono font-bold text-black uppercase">Recent Token Metering Events (usage_events)</h3>
          </div>
          <span className="text-[10px] font-mono text-neutral-500 font-bold">
            {usageEvents.length} Events Logged
          </span>
        </div>

        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-[#f6f6f2] border-b border-[#e2e2dc] text-neutral-600 text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Model Router</th>
                <th className="py-2.5 px-4">Tokens In</th>
                <th className="py-2.5 px-4">Tokens Out</th>
                <th className="py-2.5 px-4 text-right">Cost (Cents)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e2dc]">
              {usageEvents.slice(-8).reverse().map(ev => (
                <tr key={ev.id} className="hover:bg-[#fafaf8] text-neutral-800 transition-colors">
                  <td className="py-2.5 px-4 text-neutral-500">{new Date(ev.occurred_at).toLocaleTimeString()}</td>
                  <td className="py-2.5 px-4 font-bold text-black">{ev.model}</td>
                  <td className="py-2.5 px-4">{ev.tokens_in}</td>
                  <td className="py-2.5 px-4">{ev.tokens_out}</td>
                  <td className="py-2.5 px-4 text-right text-black font-bold font-mono">
                    ${(ev.cost_cents / 100).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset State */}
      <div className="p-5 rounded border border-[#e2e2dc] bg-[#fafaf8] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="font-bold text-black font-sans">Reset Demo State to Blueprint Baseline</div>
          <p className="text-[11px] text-neutral-600 mt-0.5">
            Restores initial Diana & Derek playbooks, seed agents, and mission runs.
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm('Reset state to initial blueprint baseline?')) {
              resetToSeedData();
            }
          }}
          className="px-4 py-2 rounded bg-white border border-[#e2e2dc] text-neutral-700 hover:text-black hover:border-black text-xs font-mono font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All State</span>
        </button>
      </div>
    </div>
  );
};
