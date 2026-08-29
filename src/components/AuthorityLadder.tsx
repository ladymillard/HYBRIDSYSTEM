import React from 'react';
import { AuthorityLevel } from '../types';
import { Shield, Lock, Wrench, Edit3, MessageSquare } from 'lucide-react';

interface AuthorityLadderProps {
  level: AuthorityLevel;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}

const LEVELS: { key: AuthorityLevel; label: string; short: string; tier: number; desc: string }[] = [
  { key: 'suggest', label: 'Suggest', short: 'L0', tier: 0, desc: 'Recommendations only. Nothing leaves app.' },
  { key: 'draft', label: 'Draft', short: 'L1', tier: 1, desc: 'Writes internal docs, plans, and copy.' },
  { key: 'execute', label: 'Execute', short: 'L2', tier: 2, desc: 'Reversible actions (web search, drive read, draft email).' },
  { key: 'operate', label: 'Operate', short: 'L3', tier: 3, desc: 'Runs workflow within defined boundaries (Slack notify, Jira).' },
  { key: 'human_only', label: 'Human Only', short: 'L4', tier: 4, desc: 'Money, publishing, contracts, deletion. Never delegable.' }
];

export const AuthorityLadder: React.FC<AuthorityLadderProps> = ({
  level,
  size = 'md',
  showLabels = false
}) => {
  const currentIdx = LEVELS.findIndex(l => l.key === level);
  const current = LEVELS[currentIdx] || LEVELS[1];

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-mono font-bold text-black">
          {level === 'human_only' && <Lock className="w-3 h-3 text-rose-600" />}
          <span className="text-neutral-400 font-normal">{current.short}</span>
          <span className="text-black uppercase">{current.label}</span>
        </span>
        {showLabels && (
          <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline truncate max-w-[180px]">
            {current.desc}
          </span>
        )}
      </div>

      {/* 5-segment horizontal ladder */}
      <div className="grid grid-cols-5 gap-1.5 w-full">
        {LEVELS.map((item, idx) => {
          const isFilled = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          
          return (
            <div
              key={item.key}
              title={`${item.short} ${item.label}: ${item.desc}`}
              className={`h-2 rounded-xs transition-all duration-150 border ${
                isCurrent
                  ? 'bg-[#d4f000] border-black shadow-xs'
                  : isFilled
                    ? 'bg-black border-black'
                    : 'bg-neutral-100 border-[#e2e2dc]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

