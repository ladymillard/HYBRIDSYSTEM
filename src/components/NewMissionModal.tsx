import React, { useState } from 'react';
import { useTeamOS } from '../context/TeamOSContext';
import { Layers, Sparkles, BookOpen, AlertCircle, Play, ChevronRight, CheckCircle2 } from 'lucide-react';

interface NewMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlaybookId?: string | null;
}

export const NewMissionModal: React.FC<NewMissionModalProps> = ({
  isOpen,
  onClose,
  initialPlaybookId = null
}) => {
  const { playbooks, startMission, agents } = useTeamOS();
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(initialPlaybookId || playbooks[0]?.id || null);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');

  if (!isOpen) return null;

  const currentPlaybook = playbooks.find(p => p.id === selectedPlaybookId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    const missionTitle = title.trim() || currentPlaybook?.name || 'Custom Goal Mission';
    startMission(selectedPlaybookId, missionTitle, goal.trim());
    onClose();
  };

  const handleSelectPlaybook = (id: string | null) => {
    setSelectedPlaybookId(id);
    const pb = playbooks.find(p => p.id === id);
    if (pb) {
      if (!title || playbooks.some(p => p.name === title)) {
        setTitle(pb.name);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-black rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-[#e2e2dc] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-black text-[#d4f000] flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-black font-sans">Launch New Mission</h3>
              <p className="text-xs text-neutral-600">
                Playbooks execute deterministic step graphs with strict authority enforcement.
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
          {/* Playbook Picker */}
          <div>
            <label className="block text-neutral-700 font-bold mb-2 flex items-center justify-between font-sans">
              <span>Select Playbook (Deterministic Sequence)</span>
              <span className="text-[11px] text-black font-mono font-bold">Frozen Sequence</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {playbooks.map(pb => (
                <button
                  type="button"
                  key={pb.id}
                  onClick={() => handleSelectPlaybook(pb.id)}
                  className={`p-3 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    selectedPlaybookId === pb.id
                      ? 'bg-[#fafaf8] border-black text-black shadow-xs ring-1 ring-black'
                      : 'bg-white border-[#e2e2dc] text-neutral-600 hover:border-black hover:text-black'
                  }`}
                >
                  <div>
                    <div className="font-bold text-black line-clamp-1 font-sans">{pb.name}</div>
                    <div className="text-[10px] text-neutral-500 line-clamp-2 mt-1">{pb.description}</div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-[#e2e2dc] flex items-center justify-between text-[10px] font-mono font-bold">
                    <span className="text-black">{pb.steps.length} steps</span>
                    <span className="text-neutral-500">~${((pb.estimated_cost_cents || 25) / 100).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mission Title */}
          <div>
            <label className="block text-neutral-700 font-bold mb-1 font-sans">Mission Title</label>
            <input
              type="text"
              placeholder={currentPlaybook?.name || "e.g. Launch Diana & Derek Advisory Platform"}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded px-3 py-2 text-black placeholder:text-neutral-400 focus:outline-hidden focus:border-black font-sans font-bold"
            />
          </div>

          {/* Mission Goal */}
          <div>
            <label className="block text-neutral-700 font-bold mb-1 flex items-center justify-between font-sans">
              <span>Goal & Context Variables (<code className="font-mono text-black font-normal">{"{{goal}}"}</code>)</span>
              <span className="text-[10px] text-neutral-500 font-mono">Injected into system prompts</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe the specific goal, constraints, target market, or operational parameters for the team to execute..."
              value={goal}
              onChange={e => setGoal(e.target.value)}
              className="w-full bg-[#f6f6f2] border border-[#e2e2dc] rounded px-3 py-2 text-black placeholder:text-neutral-400 focus:outline-hidden focus:border-black font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Playbook Step Preview */}
          {currentPlaybook && (
            <div className="rounded bg-[#fafaf8] border border-[#e2e2dc] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-600 pb-1.5 border-b border-[#e2e2dc] font-bold">
                <span>Playbook Step Sequence Preview ({currentPlaybook.steps.length} Steps)</span>
                <span>Job Queue Step 1 enqueues on launch</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {currentPlaybook.steps.map(step => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded bg-white border border-[#e2e2dc] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 h-4 rounded bg-black text-[#d4f000] font-mono text-[10px] font-bold flex items-center justify-center">
                        {step.seq}
                      </span>
                      <span className="text-black truncate font-bold font-sans">{step.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f6f6f2] text-black border border-[#e2e2dc]">
                        {step.role_label}
                      </span>
                      {step.requires_approval && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black text-[#d4f000] font-bold">
                          L4 Human Gate
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#e2e2dc]">
            <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-1.5">
              <span>Calls Postgres RPC <code className="font-mono text-black font-bold">start_mission()</code></span>
            </div>
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
                disabled={!goal.trim()}
                className="px-5 py-2 rounded bg-black text-white font-mono font-bold hover:bg-neutral-800 flex items-center gap-1.5 disabled:opacity-30 shadow-xs transition-all cursor-pointer text-xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Launch Mission</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
