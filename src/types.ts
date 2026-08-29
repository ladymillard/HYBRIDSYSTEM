export type AuthorityLevel = 'suggest' | 'draft' | 'execute' | 'operate' | 'human_only';

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'team' | 'enterprise';
  monthly_cost_cap_cents: number;
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
}

export interface Agent {
  id: string;
  org_id: string;
  name?: string; // Human-selected custom name for the Agent (e.g. 'Derrick', 'Atlas', 'Diana', 'Sage')
  role_label: string;
  kind: 'ai' | 'human';
  human_user_id?: string | null;
  model: string; // e.g. 'google:gemini-2.5-flash', 'anthropic:claude-3-7-sonnet', 'openai:gpt-4o'
  system_prompt: string;
  authority: AuthorityLevel;
  allowed_tools: string[];
  is_active: boolean;
  avatar_color?: string;
}

export interface PlaybookStep {
  id: string;
  playbook_id: string;
  seq: number;
  title: string;
  role_label: string;
  instruction: string;
  requires_approval: boolean;
  required_tool_tier?: number; // 0: suggest, 1: draft, 2: execute, 3: operate, 4: human_only
}

export interface Playbook {
  id: string;
  org_id: string | null; // null = global template shipped by Team OS
  name: string;
  description: string;
  category: 'Strategy & GTM' | 'Product & Engineering' | 'Growth & Marketing' | 'Operations & Legal';
  steps: PlaybookStep[];
  estimated_tokens?: number;
  estimated_cost_cents?: number;
}

export type MissionStatus = 'draft' | 'running' | 'blocked' | 'done' | 'failed';
export type MissionStepStatus = 'pending' | 'running' | 'awaiting_approval' | 'done' | 'failed' | 'skipped';

export interface Mission {
  id: string;
  org_id: string;
  playbook_id: string | null;
  playbook_name?: string;
  title: string;
  goal: string;
  status: MissionStatus;
  created_by: string;
  created_at: string;
  finished_at?: string | null;
  total_tokens?: number;
  total_cost_cents?: number;
}

export interface MissionStep {
  id: string;
  mission_id: string;
  seq: number;
  title: string;
  agent_id?: string;
  role_label?: string;
  status: MissionStepStatus;
  input: string;
  output?: string;
  error?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_cents?: number;
  started_at?: string | null;
  finished_at?: string | null;
  tools_called?: string[];
  requires_approval?: boolean;
}

export interface Approval {
  id: string;
  org_id: string;
  mission_step_id: string;
  mission_id: string;
  mission_title?: string;
  step_title?: string;
  question: string;
  proposal: string;
  decision?: 'approved' | 'revised' | 'rejected' | null;
  note?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export type MemoryFactKind = 'preference' | 'decision' | 'lesson' | 'fact';

export interface MemoryFact {
  id: string;
  org_id: string;
  kind: MemoryFactKind;
  body: string;
  source_mission_id?: string | null;
  source_mission_title?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  suggested_by_role?: string;
}

export interface Artifact {
  id: string;
  org_id: string;
  mission_id: string;
  title: string;
  kind: 'doc' | 'image' | 'link' | 'file' | 'code';
  body?: string;
  storage_path?: string;
  created_at: string;
}

export interface UsageEvent {
  id: number;
  org_id: string;
  mission_step_id?: string | null;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_cents: number;
  occurred_at: string;
}

export interface Job {
  id: number;
  org_id: string;
  mission_step_id: string;
  mission_id: string;
  status: 'queued' | 'leased' | 'done' | 'failed';
  attempts: number;
  lease_until?: string | null;
  last_error?: string | null;
  created_at: string;
}

export interface ModelOption {
  id: string;
  name: string;
  provider: 'google' | 'anthropic' | 'openai' | 'meta' | 'deepseek';
  cost_per_1k_in_cents: number;
  cost_per_1k_out_cents: number;
  context_window: string;
  description: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  tier: number; // 0-4
  tierLabel: AuthorityLevel;
  icon: string;
  description: string;
}
