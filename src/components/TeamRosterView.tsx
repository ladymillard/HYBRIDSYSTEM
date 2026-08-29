import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import { Agent } from '../types';
import { AuthorityLadder } from './AuthorityLadder';
import { EditAgentModal } from './EditAgentModal';
import { AVAILABLE_TOOLS } from '../data/seedData';
import { Users, Plus, Bot, User, Lock, Sparkles, Wrench, Shield, ArrowRight, Cpu, Tag, Edit3, Check } from 'lucide-react';

const QUICK_NAMES_LIST = ['Derrick', 'Diana', 'Athena', 'Aria', 'Cipher', 'Nexus', 'Atlas', 'Sage', 'Vanguard', 'Nova', 'Echo', 'Orion'];

export const TeamRosterView: React.FC = () => {
  const { agents, currentOrg, addAgent, updateAgent, deleteAgent } = useTeamOS();
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickRenameAgentId, setQuickRenameAgentId] = useState<string | null>(null);
  const [customInlineName, setCustomInlineName] = useState('');

  const handleCardClick = (agent: Agent) => {
    setEditingAgent(agent);
    setIsModalOpen(true);
  };

  const handleAddNewClick = () => {
    setEditingAgent(null);
    setIsModalOpen(true);
  };

  const handleSave = (agentData: Partial<Agent>) => {
    if (editingAgent) {
      updateAgent(editingAgent.id, agentData);
    } else {
      addAgent(agentData as Omit<Agent, 'id' | 'org_id'>);
    }
  };

  const handleQuickRename = (agentId: string, newName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateAgent(agentId, { name: newName });
    setQuickRenameAgentId(null);
  };

  const handleSaveCustomInline = (agentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (customInlineName.trim()) {
      updateAgent(agentId, { name: customInlineName.trim() });
    }
    setQuickRenameAgentId(null);
    setCustomInlineName('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2dc] pb-6">
        <div>
          <div className="dd-section-tag text-black mb-1">
            02 / TEAM ROSTER & MODEL CONFIG
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-black font-sans">Autonomous Teammates</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 border border-[#e2e2dc] text-neutral-700">
              {agents.length} Configured Seats
            </span>
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            Select and customize Agent names, role mandates, model routing, and non-delegable authority tiers.
          </p>
        </div>

        <button
          id="btn-add-teammate"
          onClick={handleAddNewClick}
          className="px-4 py-2 rounded bg-black text-white font-mono font-bold text-xs hover:bg-neutral-800 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>ADD TEAMMATE →</span>
        </button>
      </div>

      {/* Grid of Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agents.map(agent => {
          const displayName = agent.name || (agent.kind === 'human' ? 'Derrick' : 'Autonomous Agent');
          const isRenaming = quickRenameAgentId === agent.id;

          return (
            <div
              key={agent.id}
              onClick={() => handleCardClick(agent)}
              className={`dd-card-interactive p-5 space-y-4 cursor-pointer relative ${
                agent.is_active ? '' : 'opacity-50'
              }`}
            >
              {/* Card Header: Name, Role & Kind */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-black font-sans truncate flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{displayName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickRenameAgentId(isRenaming ? null : agent.id);
                        setCustomInlineName(agent.name || '');
                      }}
                      className="p-1 rounded text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                      title="Quick rename agent"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-xs font-semibold text-neutral-700 font-sans truncate">
                    {agent.role_label}
                  </div>

                  {/* Monospace Model String */}
                  <div className="text-[11px] font-mono text-neutral-500 truncate flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-neutral-400" />
                    <span>{agent.model}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {agent.kind === 'ai' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#d4f000] text-black border border-black">
                      <Bot className="w-3 h-3" />
                      AI
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-900 text-white border border-black">
                      <User className="w-3 h-3 text-neutral-300" />
                      HUMAN
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Inline Renaming Selector */}
              {isRenaming && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="p-3 bg-[#f6f6f2] rounded border border-black space-y-2 text-xs animate-in fade-in"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase text-neutral-700">
                    <span>Select Name for Teammate:</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickRenameAgentId(null);
                      }}
                      className="text-neutral-400 hover:text-black"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => handleSaveCustomInline(agent.id, e)}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      placeholder="Type custom name..."
                      value={customInlineName}
                      onChange={(e) => setCustomInlineName(e.target.value)}
                      className="bg-white border border-[#e2e2dc] rounded px-2 py-1 text-xs text-black font-sans font-bold flex-1 focus:outline-hidden focus:border-black"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded bg-black text-white font-mono text-xs font-bold hover:bg-neutral-800"
                    >
                      Set
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {QUICK_NAMES_LIST.map((presetName) => (
                      <button
                        type="button"
                        key={presetName}
                        onClick={(e) => handleQuickRename(agent.id, presetName, e)}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                          agent.name === presetName
                            ? 'bg-black text-white border-black font-bold'
                            : 'bg-white text-neutral-700 border-[#e2e2dc] hover:border-black hover:text-black'
                        }`}
                      >
                        {presetName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* System Prompt Teaser */}
              <div className="p-2.5 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-[11px] font-mono text-neutral-700 line-clamp-2 leading-relaxed">
                {agent.system_prompt || 'No system prompt defined.'}
              </div>

              {/* Authority Ladder */}
              <div className="pt-2 border-t border-[#e2e2dc]">
                <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-1.5 font-semibold">
                  Authority Level
                </div>
                <AuthorityLadder level={agent.authority} showLabels={true} />
              </div>

              {/* Allowed Tools */}
              <div className="pt-3 border-t border-[#e2e2dc] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-neutral-600 font-mono text-[10px]">
                  <Wrench className="w-3 h-3" />
                  <span>
                    {(agent.allowed_tools || []).length} Tools Permitted
                  </span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 group-hover:text-black font-bold transition-colors">
                  Configure →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <EditAgentModal
        isOpen={isModalOpen}
        agent={editingAgent}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        onDelete={deleteAgent}
      />
    </div>
  );
};


