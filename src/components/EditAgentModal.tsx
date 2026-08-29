import React, { useState } from 'react';
import { Agent, AuthorityLevel } from '../types';
import { AVAILABLE_MODELS, AVAILABLE_TOOLS } from '../data/seedData';
import { Lock, Shield, Sparkles, User, Bot, Wrench, X, Check, Cpu, Tag, Shuffle } from 'lucide-react';

interface EditAgentModalProps {
  isOpen: boolean;
  agent: Agent | null;
  onClose: () => void;
  onSave: (agentData: Partial<Agent>) => void;
  onDelete?: (id: string) => void;
}

const HUMAN_NAME_PRESETS = ['Derrick', 'Diana', 'Marcus', 'Elena', 'Alexander', 'Sofia', 'Julian', 'Claire'];
const AI_NAME_PRESETS = ['Athena', 'Diana', 'Aria', 'Cipher', 'Nexus', 'Atlas', 'Sage', 'Vanguard', 'Nova', 'Echo', 'Orion', 'Helios', 'Titan', 'Apex'];

export const EditAgentModal: React.FC<EditAgentModalProps> = ({
  isOpen,
  agent,
  onClose,
  onSave,
  onDelete
}) => {
  const isEditing = !!agent;

  const [name, setName] = useState(agent?.name || '');
  const [roleLabel, setRoleLabel] = useState(agent?.role_label || '');
  const [kind, setKind] = useState<'ai' | 'human'>(agent?.kind || 'ai');
  const [model, setModel] = useState(agent?.model || AVAILABLE_MODELS[0].id);
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '');
  const [authority, setAuthority] = useState<AuthorityLevel>(agent?.authority || 'draft');
  const [allowedTools, setAllowedTools] = useState<string[]>(agent?.allowed_tools || []);
  const [isActive, setIsActive] = useState(agent?.is_active ?? true);

  // Update form if agent changes
  React.useEffect(() => {
    if (agent) {
      setName(agent.name || '');
      setRoleLabel(agent.role_label);
      setKind(agent.kind);
      setModel(agent.model);
      setSystemPrompt(agent.system_prompt);
      setAuthority(agent.authority);
      setAllowedTools(agent.allowed_tools || []);
      setIsActive(agent.is_active);
    } else {
      setName('');
      setRoleLabel('');
      setKind('ai');
      setModel(AVAILABLE_MODELS[0].id);
      setSystemPrompt('');
      setAuthority('draft');
      setAllowedTools(['web_search']);
      setIsActive(true);
    }
  }, [agent, isOpen]);

  if (!isOpen) return null;

  const handleToolToggle = (toolId: string) => {
    setAllowedTools(prev =>
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const handleRandomName = () => {
    const list = kind === 'human' ? HUMAN_NAME_PRESETS : AI_NAME_PRESETS;
    const random = list[Math.floor(Math.random() * list.length)];
    setName(random);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleLabel.trim()) return;

    onSave({
      name: name.trim() || undefined,
      role_label: roleLabel.trim(),
      kind,
      model: kind === 'human' ? 'human:verified-seat' : model,
      system_prompt: systemPrompt,
      authority,
      allowed_tools: allowedTools,
      is_active: isActive
    });
    onClose();
  };

  const authorityOptions: { level: AuthorityLevel; label: string; desc: string; isL4?: boolean }[] = [
    {
      level: 'suggest',
      label: 'L0 · Suggest',
      desc: 'Produces recommendations only. Nothing leaves the application.'
    },
    {
      level: 'draft',
      label: 'L1 · Draft',
      desc: 'Writes artifacts — documents, plans, copy — into the mission (Default).'
    },
    {
      level: 'execute',
      label: 'L2 · Execute',
      desc: 'Reversible actions: search web, read Drive files, create email drafts, inspect code.'
    },
    {
      level: 'operate',
      label: 'L3 · Operate',
      desc: 'Runs named workflows within defined boundaries (Slack channel posts, Jira tasks).'
    },
    {
      level: 'human_only',
      label: 'L4 · Human only',
      desc: 'Money, publishing, contracts, deletion and external send always require a person.',
      isL4: true
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-black rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-2xl my-6">
        <div className="flex items-center justify-between border-b border-[#e2e2dc] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black text-[#d4f000] flex items-center justify-center font-bold">
              {kind === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-black font-sans">
                {isEditing ? `Configure Teammate · ${name || agent.role_label}` : 'Add New Teammate'}
              </h3>
              <p className="text-xs text-neutral-600">
                Define the agent's custom name, role label, model routing, and non-delegable authority tier.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-black text-xs font-mono px-2 py-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Agent Name Section (Humans can select / edit names) */}
          <div className="p-3.5 rounded bg-[#fbfbfa] border border-[#e2e2dc] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-black font-bold text-xs flex items-center gap-1.5 font-sans">
                <Tag className="w-3.5 h-3.5 text-neutral-700" />
                <span>Agent / Teammate Name</span>
              </label>
              <button
                type="button"
                onClick={handleRandomName}
                className="text-[11px] font-mono text-neutral-600 hover:text-black flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-[#e2e2dc] hover:border-black transition-all"
                title="Pick random name"
              >
                <Shuffle className="w-3 h-3" />
                <span>Suggest Name</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. Derrick, Diana, Athena, Aria, Cipher, Nexus, Atlas..."
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white border border-[#e2e2dc] rounded px-3 py-2 text-black font-sans font-bold text-sm placeholder:text-neutral-400 focus:outline-hidden focus:border-black shadow-xs"
              />
            </div>

            {/* Quick Name Selector Chips */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider font-semibold">
                Quick Select Name ({kind === 'human' ? 'Executive' : 'Specialist'} Presets):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(kind === 'human' ? HUMAN_NAME_PRESETS : AI_NAME_PRESETS).map(presetName => {
                  const isCurrent = name.toLowerCase() === presetName.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={presetName}
                      onClick={() => setName(presetName)}
                      className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer border ${
                        isCurrent
                          ? 'bg-black text-white border-black font-bold shadow-xs'
                          : 'bg-white text-neutral-700 border-[#e2e2dc] hover:border-black hover:text-black'
                      }`}
                    >
                      {presetName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row: Role Label & Kind */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-neutral-700 font-bold mb-1 font-sans">Role Label</label>
              <input
                type="text"
                required
                placeholder="e.g. Strategy Lead, Critical Reviewer, Tech Architect"
                value={roleLabel}
                onChange={e => setRoleLabel(e.target.value)}
                className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded px-3 py-2 text-black placeholder:text-neutral-400 focus:outline-hidden focus:border-black font-sans font-bold"
              />
            </div>

            <div>
              <label className="block text-neutral-700 font-bold mb-1 font-sans">Teammate Type</label>
              <div className="grid grid-cols-2 gap-1 bg-[#f6f6f2] p-1 rounded border border-[#e2e2dc]">
                <button
                  type="button"
                  onClick={() => setKind('ai')}
                  className={`py-1.5 rounded text-xs font-mono font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    kind === 'ai'
                      ? 'bg-black text-white'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <Bot className="w-3 h-3" />
                  <span>AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKind('human');
                    setAuthority('human_only');
                  }}
                  className={`py-1.5 rounded text-xs font-mono font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    kind === 'human'
                      ? 'bg-black text-white'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>Human</span>
                </button>
              </div>
            </div>
          </div>

          {/* Model Selector (Only if AI) */}
          {kind === 'ai' && (
            <div>
              <label className="block text-neutral-700 font-bold mb-1 flex items-center justify-between font-sans">
                <span>Model Router String (<code className="font-mono text-black font-normal">provider:model</code>)</span>
                <span className="text-[10px] text-neutral-500 font-mono">Configurable Field</span>
              </label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded px-3 py-2 text-black font-mono focus:outline-hidden focus:border-black"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id} className="bg-white text-black">
                    {m.name} ({m.id}) — ${m.cost_per_1k_in_cents}c in / ${m.cost_per_1k_out_cents}c out per 1k
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <label className="block text-neutral-700 font-bold mb-1 flex items-center justify-between font-sans">
              <span>System Prompt & Role Mandate</span>
              <span className="text-[10px] text-neutral-500 font-mono">Monospace editor</span>
            </label>
            <textarea
              rows={4}
              required={kind === 'ai'}
              placeholder="Define specific mandates, constraints, output styles, and critical rules for this teammate..."
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded px-3 py-2 text-black placeholder:text-neutral-400 font-mono text-xs leading-relaxed focus:outline-hidden focus:border-black"
            />
          </div>

          {/* Authority Ladder Selector */}
          <div className="space-y-1.5">
            <label className="block text-neutral-700 font-bold flex items-center justify-between font-sans">
              <span>Authority Tier (Database Enforced)</span>
              <span className="text-[10px] text-black font-mono font-bold">L0–L4 Engine</span>
            </label>
            <div className="space-y-1.5">
              {authorityOptions.map(opt => {
                const isSelected = authority === opt.level;
                return (
                  <div
                    key={opt.level}
                    onClick={() => setAuthority(opt.level)}
                    className={`p-3 rounded border cursor-pointer transition-all flex items-start gap-3 ${
                      isSelected
                        ? opt.isL4
                          ? 'bg-rose-50 border-rose-600 text-black shadow-xs'
                          : 'bg-neutral-50 border-black text-black shadow-xs'
                        : 'bg-white border-[#e2e2dc] text-neutral-700 hover:border-black'
                    }`}
                  >
                    <div className="mt-0.5">
                      <div className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center ${
                        isSelected ? (opt.isL4 ? 'border-rose-600 bg-rose-600' : 'border-black bg-black') : 'border-neutral-400'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 bg-[#d4f000]" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {opt.isL4 && <Lock className="w-3 h-3 text-rose-600" />}
                        <span className="font-bold text-black font-sans">
                          {opt.label}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 text-neutral-600">
                        {opt.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Allowed Tools Multi-Select */}
          <div>
            <label className="block text-neutral-700 font-bold mb-1.5 flex items-center justify-between font-sans">
              <span>Allowed Tools Gateway (n8n Integration)</span>
              <span className="text-[10px] text-neutral-500 font-mono">Tier comparison gates calls</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {AVAILABLE_TOOLS.map(tool => {
                const isChecked = allowedTools.includes(tool.id);
                return (
                  <button
                    type="button"
                    key={tool.id}
                    onClick={() => handleToolToggle(tool.id)}
                    className={`p-2.5 rounded border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-[#f6f6f2] border-black text-black'
                        : 'bg-white border-[#e2e2dc] text-neutral-600 hover:border-black'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench className={`w-3.5 h-3.5 ${isChecked ? 'text-black' : 'text-neutral-400'}`} />
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{tool.name}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">Req: L{tool.tier} {tool.tierLabel}</div>
                      </div>
                    </div>
                    {isChecked && <Check className="w-3.5 h-3.5 text-black flex-shrink-0 stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Switch */}
          <div className="flex items-center justify-between p-3.5 rounded bg-[#f6f6f2] border border-[#e2e2dc]">
            <div>
              <span className="text-black font-bold block font-sans">Active in Organization</span>
              <span className="text-[10px] text-neutral-500">
                Inactive teammates are skipped when playbooks resolve role labels.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border border-black ${
                isActive ? 'bg-black' : 'bg-neutral-200'
              }`}
            >
              <span className={`w-4 h-4 rounded-full bg-[#d4f000] absolute top-0.5 transition-transform ${
                isActive ? 'right-0.5' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-[#e2e2dc]">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove ${name || agent.role_label} from team?`)) {
                    onDelete(agent.id);
                    onClose();
                  }
                }}
                className="text-rose-600 hover:text-rose-800 text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                Remove Teammate
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border border-[#e2e2dc] text-neutral-600 hover:text-black font-mono text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded bg-black text-white font-mono font-bold hover:bg-neutral-800 shadow-xs transition-all cursor-pointer text-xs"
              >
                {isEditing ? 'Save Changes' : 'Add Teammate'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

