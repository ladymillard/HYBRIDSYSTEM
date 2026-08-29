import React, { useState } from 'react';
import {
  FileCode2,
  Copy,
  Check,
  Shield,
  Layers,
  Zap,
  DollarSign,
  AlertTriangle,
  Lock,
  Cpu,
  Database,
  Terminal,
  Workflow,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export const BlueprintView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('01');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Unit Economics Simulator State
  const [missionsPerMonth, setMissionsPerMonth] = useState<number>(30);
  const [avgStepsPerMission, setAvgStepsPerMission] = useState<number>(5);
  const [seatPrice, setSeatPrice] = useState<number>(15000); // $15,000 pilot / monthly
  const [avgTokensPerStep, setAvgTokensPerStep] = useState<number>(2500);

  const totalTokens = missionsPerMonth * avgStepsPerMission * avgTokensPerStep;
  const estimatedTokenCost = (totalTokens / 1000) * 0.045; // in dollars
  const infrastructureCost = 45; // Supabase Pro + VPS n8n
  const totalCogs = estimatedTokenCost + infrastructureCost;
  const grossProfit = seatPrice - totalCogs;
  const grossMargin = ((grossProfit / seatPrice) * 100).toFixed(1);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const sections = [
    { id: '01', title: '01 · The Stack, Decided' },
    { id: '02', title: '02 · Five Corrections' },
    { id: '03', title: '03 · Tool Matrix' },
    { id: '04', title: '04 · The Database & RLS' },
    { id: '05', title: '05 · The Orchestrator Loop' },
    { id: '06', title: '06 · Tiered Authority (L0-L4)' },
    { id: '07', title: '07 · Eight Weeks, Four Phases' },
    { id: '08', title: '08 · Builder Prompts' },
    { id: '09', title: '09 · Unit Economics Calculator' },
    { id: '10', title: '10 · What Will Go Wrong' }
  ];

  const SCHEMA_SQL = `-- ============ TENANCY ============
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'trial',
  monthly_cost_cap_cents int not null default 5000,
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references orgs on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member',   -- owner | admin | member
  primary key (org_id, user_id)
);

-- ============ THE TEAM ============
create type authority as enum ('suggest','draft','execute','operate','human_only');

create table agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  role_label text not null,              -- 'Strategy Lead', 'Critical Reviewer'
  kind text not null default 'ai',       -- ai | human
  human_user_id uuid references auth.users,
  model text,                            -- provider:model, e.g. 'anthropic:claude-opus-5'
  system_prompt text,
  authority authority not null default 'draft',
  allowed_tools text[] default '{}',
  is_active boolean default true
);

-- ============ WORK ============
create table playbooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs on delete cascade,  -- null = template shipped by you
  name text not null,
  description text
);

create table playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks on delete cascade,
  seq int not null,
  title text not null,
  role_label text not null,              -- resolved to an agent at run time
  instruction text not null,             -- supports {{goal}} {{step_3_output}}
  requires_approval boolean default false,
  unique (playbook_id, seq)
);

create table missions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  playbook_id uuid references playbooks,
  title text not null,
  goal text not null,
  status text not null default 'draft',  -- draft|running|blocked|done|failed
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

create table mission_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions on delete cascade,
  seq int not null,
  title text not null,
  agent_id uuid references agents,
  status text not null default 'pending', -- pending|running|awaiting_approval|done|failed|skipped
  input text,
  output text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  unique (mission_id, seq)
);

-- ============ HUMAN CONTROL ============
create table approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  mission_step_id uuid references mission_steps on delete cascade,
  question text not null,
  proposal text,
  decision text,                          -- approved | revised | rejected
  note text,
  decided_by uuid references auth.users,
  decided_at timestamptz
);

-- ============ MEMORY ============
create table memory_facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  kind text not null,                     -- preference | decision | lesson | fact
  body text not null,
  source_mission_id uuid references missions,
  approved_by uuid references auth.users, -- null = proposed, not yet in context
  approved_at timestamptz,
  created_at timestamptz default now()
);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs on delete cascade,
  mission_id uuid references missions on delete cascade,
  title text not null,
  kind text not null,                     -- doc | image | link | file
  body text,
  storage_path text,
  created_at timestamptz default now()
);

-- ============ METERING ============
create table usage_events (
  id bigserial primary key,
  org_id uuid not null references orgs on delete cascade,
  mission_step_id uuid references mission_steps on delete set null,
  model text,
  tokens_in int default 0,
  tokens_out int default 0,
  cost_cents numeric(10,4) default 0,
  occurred_at timestamptz default now()
);
create index on usage_events (org_id, occurred_at desc);

-- ============ QUEUE ============
create table jobs (
  id bigserial primary key,
  org_id uuid not null references orgs on delete cascade,
  mission_step_id uuid references mission_steps on delete cascade,
  status text not null default 'queued',  -- queued|leased|done|failed
  attempts int default 0,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz default now()
);
create index on jobs (status, created_at);`;

  const RLS_SQL = `-- one cached function, used by every policy
create or replace function public.my_org_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select org_id from org_members where user_id = (select auth.uid())
$$;

create index on org_members (user_id);

-- apply to every tenant table
do $$
declare t text;
begin
  foreach t in array array[
    'agents','playbooks','missions','approvals',
    'memory_facts','artifacts','usage_events','jobs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format($f$
      create policy tenant_read on %I for select to authenticated
      using (org_id in (select public.my_org_ids()))
    $f$, t);
    execute format($f$
      create policy tenant_write on %I for all to authenticated
      using (org_id in (select public.my_org_ids()))
      with check (org_id in (select public.my_org_ids()))
    $f$, t);
    execute format('create index if not exists %I on %I (org_id)', t||'_org_idx', t);
  end loop;
end $$;

-- child tables inherit isolation through their parent
alter table mission_steps enable row level security;
create policy tenant_steps on mission_steps for all to authenticated
using (mission_id in (select id from missions))
with check (mission_id in (select id from missions));

alter table playbook_steps enable row level security;
create policy tenant_pbsteps on playbook_steps for all to authenticated
using (playbook_id in (select id from playbooks))
with check (playbook_id in (select id from playbooks));

alter table orgs enable row level security;
create policy org_read on orgs for select to authenticated
using (id in (select public.my_org_ids()));

-- playbooks you ship have org_id = null, so the loop above hides them.
-- widen the read policy to let every tenant see the shared templates.
drop policy tenant_read on playbooks;
create policy tenant_read on playbooks for select to authenticated
using (org_id is null or org_id in (select public.my_org_ids()));

-- and let their steps through too
drop policy tenant_pbsteps on playbook_steps;
create policy pbsteps_read on playbook_steps for select to authenticated
using (playbook_id in (select id from playbooks));
create policy pbsteps_write on playbook_steps for all to authenticated
using (playbook_id in (select id from playbooks where org_id is not null))
with check (playbook_id in (select id from playbooks where org_id is not null));`;

  const ORCHESTRATOR_CODE = `// supabase/functions/run-step/index.ts
// invoked by pg_cron every 10s; service role key, bypasses RLS —
// so every query below MUST filter org_id explicitly.

// 1 — LEASE one job atomically (no double-execution across workers)
const job = await sql\`
  update jobs set status='leased', attempts=attempts+1,
                  lease_until = now() + interval '5 minutes'
  where id = (
    select id from jobs
    where status='queued' or (status='leased' and lease_until < now())
    order by created_at limit 1
    for update skip locked
  ) returning *\`;
if (!job) return ok();

// 2 — CAP: refuse before spending, not after
const spend = await monthToDateCents(job.org_id);
const cap   = await orgCap(job.org_id);
if (spend >= cap) return block(job, 'monthly_cost_cap_reached');

// 3 — ASSEMBLE context. This is the whole product.
const step    = await getStep(job.mission_step_id);
const agent   = await getAgent(step.agent_id);
const mission = await getMission(step.mission_id);
const memory  = await approvedMemory(job.org_id);   // approved_by is not null
const prior   = await priorStepOutputs(step.mission_id, step.seq);

const messages = [
  { role:'system', content: [
      agent.system_prompt,
      \`You are the \${agent.role_label} on this team.\`,
      \`TEAM MEMORY:\\n\${memory.map(m => '- ' + m.body).join('\\n')}\`,
      \`MISSION: \${mission.title}\\nGOAL: \${mission.goal}\`,
      \`AUTHORITY: \${agent.authority}. Never exceed it.\`
    ].join('\\n\\n') },
  { role:'user', content: render(step.input, { goal: mission.goal, ...prior }) }
];

// 4 — ROUTE by the agent row, never by a hardcoded vendor
const [provider, model] = agent.model.split(':');
const res = await callModel(provider, model, messages, agent.allowed_tools);

// 5 — METER, always, even on failure
await logUsage(job.org_id, step.id, agent.model, res.tokens_in, res.tokens_out);

// 6 — AUTHORITY GATE, then advance or stop for a human
const needsHuman = step.requires_approval
  || agent.authority === 'human_only'
  || res.requested_tool_tier > tierOf(agent.authority);

if (needsHuman) {
  await setStatus(step.id, 'awaiting_approval');
  await createApproval(job.org_id, step.id, step.title, res.text);
  await notify(job.org_id, mission.id);
} else {
  await setStatus(step.id, 'done', res.text);
  await enqueueNextStep(mission.id, step.seq + 1);   // null seq → mission done
}
await closeJob(job.id);`;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 w-full">
      {/* Blueprint Header */}
      <div className="border-b border-[#e2e2dc] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="dd-section-tag text-black mb-1">
              SYSTEM ARCHITECTURE SPECIFICATION
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-black font-sans mt-1">
              Autonomous Team Operating System Blueprint
            </h1>
          </div>
          <div className="text-xs font-mono text-neutral-800 bg-neutral-100 border border-[#e2e2dc] px-3 py-1 rounded flex items-center gap-2 w-fit">
            <span className="w-2 h-2 rounded-full bg-[#d4f000] border border-black"></span>
            <span>Target: Multi-tenant SaaS (Production)</span>
          </div>
        </div>
        <p className="text-xs text-neutral-600 mt-2 max-w-3xl leading-relaxed">
          The architecture is sound. Five specific failure points occur during real-world scaling, solved by this low-code stack and PostgreSQL row-level security.
        </p>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs font-mono">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 rounded whitespace-nowrap transition-all border cursor-pointer ${
              activeSection === s.id
                ? 'bg-black text-white font-bold border-black shadow-xs'
                : 'bg-white text-neutral-600 hover:text-black border-[#e2e2dc] hover:border-black'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div className="space-y-6">
        {/* 01: THE STACK, DECIDED */}
        {activeSection === '01' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-black font-sans">
                01 · The stack, decided
              </h2>
              <p className="text-neutral-600 leading-relaxed">
                For a product you intend to sell to enterprise customers, three specialized tools work in concert.
              </p>
            </div>

            {/* Architecture Pipeline diagram */}
            <div className="p-5 rounded bg-[#fafaf8] border border-[#e2e2dc] flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-center">
              <div className="p-3.5 rounded bg-white border border-[#e2e2dc] flex-1 w-full shadow-xs">
                <div className="text-xs font-bold text-black">React Frontend</div>
                <div className="text-[10px] text-neutral-500 mt-1">Realtime UI & Mission Dashboard</div>
              </div>
              <div className="text-neutral-400 font-bold hidden md:block">→</div>
              <div className="p-3.5 rounded bg-white border border-[#e2e2dc] flex-1 w-full shadow-xs">
                <div className="text-xs font-bold text-black">Supabase Engine</div>
                <div className="text-[10px] text-neutral-500 mt-1">Postgres + RLS + Edge Functions</div>
              </div>
              <div className="text-neutral-400 font-bold hidden md:block">→</div>
              <div className="p-3.5 rounded bg-white border border-[#e2e2dc] flex-1 w-full shadow-xs">
                <div className="text-xs font-bold text-black">n8n Gateway</div>
                <div className="text-[10px] text-neutral-500 mt-1">Tools (Gmail, Drive, Slack, Jira)</div>
              </div>
              <div className="text-neutral-400 font-bold hidden md:block">→</div>
              <div className="p-3.5 rounded bg-white border border-black flex-1 w-full shadow-xs">
                <div className="text-xs font-bold text-black">Model Router</div>
                <div className="text-[10px] text-neutral-500 mt-1">Dynamic provider:model dispatch</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded bg-[#f6f6f2] border border-[#e2e2dc] space-y-1.5">
                <div className="font-bold text-black font-sans">Why not all-in-one Bubble?</div>
                <p className="text-neutral-600 leading-relaxed font-sans">
                  All-in-one locks you into proprietary hosting with high execution latency on multi-step agent runs.
                </p>
              </div>
              <div className="p-4 rounded bg-[#f6f6f2] border border-[#e2e2dc] space-y-1.5">
                <div className="font-bold text-black font-sans">Why n8n over Zapier?</div>
                <p className="text-neutral-600 leading-relaxed font-sans">
                  n8n can be self-hosted on your private VPC, guaranteeing enterprise customer data never transits third-party workflow brokers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 02: FIVE CORRECTIONS */}
        {activeSection === '02' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-black font-sans">
                02 · Five corrections before you build
              </h2>
              <p className="text-neutral-600">
                These are five critical architectural pivots from generic agent demos to enterprise production products.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  id: 'FIX 01',
                  title: 'Freeze the orchestrator into playbooks',
                  problem: 'Autonomous LLM planners create stochastic, drifting step sequences.',
                  solution: 'Execute deterministic DAG step graphs with explicit inputs, outputs, and role bindings.'
                },
                {
                  id: 'FIX 02',
                  title: 'Roles are rows. Models are a config field.',
                  problem: 'Hardcoding ChatGPT as Strategist and Claude as Reviewer.',
                  solution: 'Store provider:model in database rows. Swap, test, and upgrade models without rebuilding code.'
                },
                {
                  id: 'FIX 03',
                  title: 'The job queue is the product',
                  problem: 'Long HTTP request timeouts during multi-step executions.',
                  solution: 'Worker leases one job using FOR UPDATE SKIP LOCKED, executes one step, and enqueues next.'
                },
                {
                  id: 'FIX 04',
                  title: 'Meter every token against a tenant',
                  problem: 'Uncapped API spend causing surprise bills.',
                  solution: 'Log tokens_in, tokens_out, and cost_cents per step. Check org budget cap before leasing.'
                },
                {
                  id: 'FIX 05',
                  title: 'A human hand on every lesson',
                  problem: 'Automatic vector learning compounds hallucinations across runs.',
                  solution: 'Agents propose candidate memories; they only enter active context when a human approves.'
                }
              ].map(fix => (
                <div key={fix.id} className="p-4 rounded bg-[#fafaf8] border border-[#e2e2dc] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-black font-bold bg-[#d4f000] px-1.5 py-0.5 rounded text-[10px] border border-black">{fix.id}</span>
                    <span className="text-black font-bold font-sans">{fix.title}</span>
                  </div>
                  <div className="text-neutral-500 font-mono text-[11px]">Problem: {fix.problem}</div>
                  <div className="text-neutral-800 leading-relaxed font-sans">{fix.solution}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 03: TOOL MATRIX */}
        {activeSection === '03' && (
          <div className="dd-card p-6 space-y-4 text-xs">
            <h2 className="text-base font-bold text-black font-sans">
              03 · What each tool actually does
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e2dc] bg-[#f6f6f2] font-mono text-[10px] text-neutral-600 uppercase">
                    <th className="py-2.5 px-3">Layer</th>
                    <th className="py-2.5 px-3">Tool</th>
                    <th className="py-2.5 px-3">What it owns</th>
                    <th className="py-2.5 px-3 text-rose-600">Do not let it</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e2dc]">
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">Interface</td>
                    <td className="py-2.5 px-3 font-bold text-black">React Frontend</td>
                    <td className="py-2.5 px-3 text-neutral-700">React screens, realtime subscriptions, approval UI</td>
                    <td className="py-2.5 px-3 text-rose-700 font-medium">Design schema or hold business logic</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">Data + Auth</td>
                    <td className="py-2.5 px-3 font-bold text-black">Supabase</td>
                    <td className="py-2.5 px-3 text-neutral-700">Postgres, RLS tenant isolation, auth, realtime</td>
                    <td className="py-2.5 px-3 text-neutral-400">—</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">Orchestrator</td>
                    <td className="py-2.5 px-3 font-bold text-black">Edge Function</td>
                    <td className="py-2.5 px-3 text-neutral-700">Step execution, model calls, authority checks, metering</td>
                    <td className="py-2.5 px-3 text-rose-700 font-medium">Run more than one step per invocation</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">Queue</td>
                    <td className="py-2.5 px-3 font-bold text-black">Postgres + pg_cron</td>
                    <td className="py-2.5 px-3 text-neutral-700">Job rows, retries, worker wake-up every 10s</td>
                    <td className="py-2.5 px-3 text-neutral-400">—</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">Tools</td>
                    <td className="py-2.5 px-3 font-bold text-black">n8n Gateway</td>
                    <td className="py-2.5 px-3 text-neutral-700">Gmail, Drive, Slack, GitHub, CRM, search</td>
                    <td className="py-2.5 px-3 text-rose-700 font-medium">Own mission state — always call back to DB</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 04: THE DATABASE & RLS */}
        {activeSection === '04' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-black font-sans">
                04 · The database — schema & RLS
              </h2>
              <span className="text-xs font-mono text-black font-bold">PostgreSQL + RLS</span>
            </div>
            <p className="text-neutral-600">
              Run these scripts in your Supabase SQL editor. Every tenant is strictly isolated by row-level security.
            </p>

            {/* Schema SQL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>01_schema.sql</span>
                <button
                  onClick={() => handleCopy(SCHEMA_SQL, 'schema')}
                  className="px-3 py-1 rounded bg-black text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedKey === 'schema' ? <Check className="w-3 h-3 text-[#d4f000]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'schema' ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>
              <pre className="p-4 rounded bg-[#111111] text-[#fafafa] font-mono text-[11px] overflow-x-auto max-h-72 border border-black">
                {SCHEMA_SQL}
              </pre>
            </div>

            {/* RLS SQL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>02_rls.sql</span>
                <button
                  onClick={() => handleCopy(RLS_SQL, 'rls')}
                  className="px-3 py-1 rounded bg-black text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedKey === 'rls' ? <Check className="w-3 h-3 text-[#d4f000]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'rls' ? 'Copied' : 'Copy RLS'}</span>
                </button>
              </div>
              <pre className="p-4 rounded bg-[#111111] text-[#fafafa] font-mono text-[11px] overflow-x-auto max-h-72 border border-black">
                {RLS_SQL}
              </pre>
            </div>
          </div>
        )}

        {/* 05: ORCHESTRATOR LOOP */}
        {activeSection === '05' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-black font-sans">
                05 · The orchestrator loop (Edge Function)
              </h2>
              <button
                onClick={() => handleCopy(ORCHESTRATOR_CODE, 'orch')}
                className="px-3 py-1.5 rounded bg-black text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {copiedKey === 'orch' ? <Check className="w-3 h-3 text-[#d4f000]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'orch' ? 'Copied' : 'Copy TypeScript'}</span>
              </button>
            </div>
            <p className="text-neutral-600">
              One Edge Function. It wakes on a cron, leases a single job, runs exactly one step, and enqueues the next.
            </p>

            <pre className="p-4 rounded bg-[#111111] text-[#d4f000] font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed border border-black">
              {ORCHESTRATOR_CODE}
            </pre>
          </div>
        )}

        {/* 06: AUTHORITY LADDER */}
        {activeSection === '06' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-black font-sans">
                06 · Tiered Authority (L0–L4)
              </h2>
              <p className="text-neutral-600">
                Five discrete tiers mapped to an enum. Anything exceeding an agent's tier halts the pipeline for human sign-off.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                { tier: 'L0', name: 'Suggest', desc: 'Recommendations only. Nothing leaves the application.' },
                { tier: 'L1', name: 'Draft', desc: 'Writes internal docs, plans, and copy into mission state.' },
                { tier: 'L2', name: 'Execute', desc: 'Reversible actions: web search, drive read, draft email.' },
                { tier: 'L3', name: 'Operate', desc: 'Runs within defined boundary: Slack notify, Jira tickets.' },
                { tier: 'L4', name: 'Human Only', desc: 'Money, publishing, contracts, deletion. Never delegable.' }
              ].map(l => (
                <div key={l.tier} className="p-4 rounded bg-[#fafaf8] border border-[#e2e2dc] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-black">{l.tier}</span>
                    {l.tier === 'L4' && <Lock className="w-3.5 h-3.5 text-rose-600" />}
                  </div>
                  <div className="font-bold text-black text-xs font-sans">{l.name}</div>
                  <p className="text-[11px] text-neutral-600 leading-relaxed font-sans">{l.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 07: TIMELINE PHASES */}
        {activeSection === '07' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <h2 className="text-base font-bold text-black font-sans">
              07 · Eight weeks, four phases
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { phase: 'P0', time: 'Week 1', title: 'Headless Core', desc: 'Schema, RLS, queue, worker, one hand-written playbook in SQL. Verify step progression.' },
                { phase: 'P1', time: 'Weeks 2–3', title: 'Interactive Dashboard', desc: 'Realtime UI streaming mission progress and interactive L4 human approval card.' },
                { phase: 'P2', time: 'Weeks 4–5', title: 'Multi-Tenancy', desc: 'Organizations, team invites, role switcher, RLS verification, token usage metering.' },
                { phase: 'P3', time: 'Weeks 6–8', title: 'Integrations & Memory', desc: 'n8n tools connected, memory proposal flow, custom playbook editor, Stripe billing.' }
              ].map(p => (
                <div key={p.phase} className="p-4 rounded bg-[#fafaf8] border border-[#e2e2dc] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-black bg-[#d4f000] px-1.5 py-0.5 rounded text-[10px] border border-black">{p.phase}</span>
                    <span className="text-neutral-500">{p.time}</span>
                  </div>
                  <div className="font-bold text-black font-sans">{p.title}</div>
                  <p className="text-neutral-600 leading-relaxed text-[11px] font-sans">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 08: BUILDER PROMPTS */}
        {activeSection === '08' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-black font-sans">
                08 · Builder Prompts
              </h2>
              <p className="text-neutral-600">
                Guiding system prompts to initialize new autonomous agent instances.
              </p>
            </div>

            <div className="p-4 rounded bg-[#f6f6f2] border border-[#e2e2dc] space-y-2 font-mono text-[11px] text-neutral-800">
              <div className="text-black font-bold">Preamble Constraint:</div>
              <p className="text-neutral-700 leading-relaxed font-sans">
                1. The Supabase database already exists. NEVER create, alter, or drop tables without explicit permission.<br/>
                2. Never call an AI model directly from the client front end.<br/>
                3. Subscribed views update via Supabase Realtime.<br/>
                4. RLS handles tenant isolation automatically.
              </p>
            </div>
          </div>
        )}

        {/* 09: UNIT ECONOMICS CALCULATOR */}
        {activeSection === '09' && (
          <div className="dd-card p-6 space-y-6 text-xs">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-black font-sans">
                09 · Unit Economics Simulator
              </h2>
              <p className="text-neutral-600">
                Playbooks make costs predictable — evaluate token margins against monthly retainer pricing.
              </p>
            </div>

            {/* Interactive Calculator Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded bg-[#fafaf8] border border-[#e2e2dc]">
              <div>
                <label className="text-neutral-700 block mb-1 font-mono text-[11px]">Missions / Mo</label>
                <input
                  type="number"
                  value={missionsPerMonth}
                  onChange={e => setMissionsPerMonth(Number(e.target.value))}
                  className="w-full bg-white border border-[#e2e2dc] rounded p-2 text-black font-mono focus:outline-hidden focus:border-black"
                />
              </div>
              <div>
                <label className="text-neutral-700 block mb-1 font-mono text-[11px]">Avg Steps / Mission</label>
                <input
                  type="number"
                  value={avgStepsPerMission}
                  onChange={e => setAvgStepsPerMission(Number(e.target.value))}
                  className="w-full bg-white border border-[#e2e2dc] rounded p-2 text-black font-mono focus:outline-hidden focus:border-black"
                />
              </div>
              <div>
                <label className="text-neutral-700 block mb-1 font-mono text-[11px]">Avg Tokens / Step</label>
                <input
                  type="number"
                  value={avgTokensPerStep}
                  onChange={e => setAvgTokensPerStep(Number(e.target.value))}
                  className="w-full bg-white border border-[#e2e2dc] rounded p-2 text-black font-mono focus:outline-hidden focus:border-black"
                />
              </div>
              <div>
                <label className="text-neutral-700 block mb-1 font-mono text-[11px]">Monthly Retainer ($)</label>
                <input
                  type="number"
                  value={seatPrice}
                  onChange={e => setSeatPrice(Number(e.target.value))}
                  className="w-full bg-white border border-black rounded p-2 text-black font-mono font-bold focus:outline-hidden"
                />
              </div>
            </div>

            {/* Metrics Output */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-center">
                <div className="text-neutral-500 text-[11px] font-mono">Monthly Tokens</div>
                <div className="text-base font-bold text-black font-mono mt-1">
                  {(totalTokens / 1000).toLocaleString()}k
                </div>
              </div>
              <div className="p-4 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-center">
                <div className="text-neutral-500 text-[11px] font-mono">Model Cost (COGS)</div>
                <div className="text-base font-bold text-black font-mono mt-1">
                  ${estimatedTokenCost.toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded bg-[#f6f6f2] border border-[#e2e2dc] text-center">
                <div className="text-neutral-500 text-[11px] font-mono">Total COGS (Tokens+Infra)</div>
                <div className="text-base font-bold text-black font-mono mt-1">
                  ${totalCogs.toFixed(2)}
                </div>
              </div>
              <div className="p-4 rounded bg-black text-white text-center shadow-xs">
                <div className="text-[#d4f000] text-[11px] font-mono font-bold">Gross Margin</div>
                <div className="text-xl font-extrabold text-white font-mono mt-1">
                  {grossMargin}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 10: WHAT WILL GO WRONG */}
        {activeSection === '10' && (
          <div className="dd-card p-6 space-y-4 text-xs">
            <h2 className="text-base font-bold text-black font-sans">
              10 · Defensive failure mode safeguards
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded bg-[#fafaf8] border border-[#e2e2dc] space-y-1.5">
                <div className="font-bold text-black font-sans">Context Window Overflow</div>
                <p className="text-neutral-600 leading-relaxed font-sans">
                  Summarize prior step outputs into high-density brief artifacts instead of appending raw full strings.
                </p>
              </div>
              <div className="p-4 rounded bg-[#fafaf8] border border-[#e2e2dc] space-y-1.5">
                <div className="font-bold text-black font-sans">Reviewer Complacency</div>
                <p className="text-neutral-600 leading-relaxed font-sans">
                  Mandate at least 3 concrete counterarguments and reject generic validation in critic system prompts.
                </p>
              </div>
              <div className="p-4 rounded bg-[#fafaf8] border border-[#e2e2dc] space-y-1.5">
                <div className="font-bold text-black font-sans">Queue Staleness</div>
                <p className="text-neutral-600 leading-relaxed font-sans">
                  Include automated heartbeat telemetry to detect and recycle orphaned leased jobs after 5-minute leases.
                </p>
              </div>
              <div className="p-4 rounded bg-[#fafaf8] border border-[#e2e2dc] space-y-1.5">
                <div className="font-bold text-black font-sans">Tenant Boundary Leaks</div>
                <p className="text-neutral-600 leading-relaxed font-sans">
                  Postgres Row-Level Security handles tenant boundary enforcement natively at the database kernel.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
