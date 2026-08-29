import { Org, OrgMember, Agent, Playbook, Mission, MissionStep, Approval, MemoryFact, Artifact, UsageEvent, Job, ModelOption, ToolDefinition } from '../types';

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'google:gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    cost_per_1k_in_cents: 0.015,
    cost_per_1k_out_cents: 0.06,
    context_window: '1M tokens',
    description: 'Ultra-fast sub-second latency, ideal for high-volume steps and real-time execution.'
  },
  {
    id: 'google:gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    cost_per_1k_in_cents: 0.125,
    cost_per_1k_out_cents: 0.50,
    context_window: '2M tokens',
    description: 'Advanced reasoning, deep synthesis, complex code architecture, and multi-modal analysis.'
  },
  {
    id: 'anthropic:claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    cost_per_1k_in_cents: 0.30,
    cost_per_1k_out_cents: 1.50,
    context_window: '200K tokens',
    description: 'Top-tier nuanced strategic writing, balanced tone, and self-reflective critique.'
  },
  {
    id: 'anthropic:claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    cost_per_1k_in_cents: 0.08,
    cost_per_1k_out_cents: 0.40,
    context_window: '200K tokens',
    description: 'Rapid critical analysis, verification loops, and concise summarization.'
  },
  {
    id: 'openai:gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    cost_per_1k_in_cents: 0.25,
    cost_per_1k_out_cents: 1.00,
    context_window: '128K tokens',
    description: 'General purpose orchestrator benchmark with robust structured JSON handling.'
  },
  {
    id: 'openai:o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    cost_per_1k_in_cents: 0.11,
    cost_per_1k_out_cents: 0.44,
    context_window: '128K tokens',
    description: 'Math, code reasoning, and logic verification.'
  }
];

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    id: 'web_search',
    name: 'Web Intelligence Search',
    tier: 2,
    tierLabel: 'execute',
    icon: 'Globe',
    description: 'Query live web engines, scrape public docs, and summarize search results.'
  },
  {
    id: 'drive_read',
    name: 'Google Drive Reader',
    tier: 2,
    tierLabel: 'execute',
    icon: 'FolderGit2',
    description: 'Fetch internal briefs, PDFs, spreadsheets, and shared company documents.'
  },
  {
    id: 'draft_email',
    name: 'Gmail Draft Creator',
    tier: 2,
    tierLabel: 'execute',
    icon: 'Mail',
    description: 'Create draft outbound emails in Gmail (never sends automatically).'
  },
  {
    id: 'slack_notify',
    name: 'Slack Channel Dispatch',
    tier: 3,
    tierLabel: 'operate',
    icon: 'MessageSquare',
    description: 'Post structured updates and notification cards into designated Slack channels.'
  },
  {
    id: 'crm_lookup',
    name: 'HubSpot / Salesforce CRM',
    tier: 2,
    tierLabel: 'execute',
    icon: 'Database',
    description: 'Query customer records, pipeline deals, and contact interaction logs.'
  },
  {
    id: 'github_read',
    name: 'GitHub Repository Inspect',
    tier: 2,
    tierLabel: 'execute',
    icon: 'GitBranch',
    description: 'Read issues, pull requests, commits, and source code files.'
  },
  {
    id: 'jira_update',
    name: 'Jira / Linear Issue Manager',
    tier: 3,
    tierLabel: 'operate',
    icon: 'CheckSquare',
    description: 'Create, assign, and update task statuses in sprint management tools.'
  },
  {
    id: 'stripe_payout',
    name: 'Stripe Payment Transfer',
    tier: 4,
    tierLabel: 'human_only',
    icon: 'CreditCard',
    description: 'Transfer funds, issue refunds, or modify subscription billing tiers (requires Human Approval).'
  },
  {
    id: 'production_deploy',
    name: 'Production Cloud Deployment',
    tier: 4,
    tierLabel: 'human_only',
    icon: 'Server',
    description: 'Trigger production release pipelines and DNS modifications (requires Human Approval).'
  },
  {
    id: 'contract_sign',
    name: 'DocuSign Contract Authority',
    tier: 4,
    tierLabel: 'human_only',
    icon: 'FileCheck',
    description: 'Execute binding legal agreements, NDAs, or partner terms (requires Human Approval).'
  }
];

export const INITIAL_ORGS: Org[] = [
  {
    id: 'org-dnd',
    name: 'Diana & Derrick Advisory',
    slug: 'diana-derrick',
    plan: 'team',
    monthly_cost_cap_cents: 10000, // $100.00 cap
    created_at: '2026-08-01T10:00:00Z'
  },
  {
    id: 'org-venture',
    name: 'Venture Velocity Labs',
    slug: 'venture-velocity',
    plan: 'enterprise',
    monthly_cost_cap_cents: 50000, // $500.00 cap
    created_at: '2026-08-10T14:30:00Z'
  },
  {
    id: 'org-acme',
    name: 'Acme Robotics Corp',
    slug: 'acme-robotics',
    plan: 'trial',
    monthly_cost_cap_cents: 2500, // $25.00 cap
    created_at: '2026-08-20T09:15:00Z'
  }
];

export const INITIAL_MEMBERS: OrgMember[] = [
  {
    org_id: 'org-dnd',
    user_id: 'user-derrick',
    name: 'Derrick (Founder)',
    email: 'derrick@dianaderrick.com',
    role: 'owner'
  },
  {
    org_id: 'org-dnd',
    user_id: 'user-diana',
    name: 'Diana (Managing Partner)',
    email: 'diana@dianaderrick.com',
    role: 'admin'
  }
];

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-strat-1',
    org_id: 'org-dnd',
    name: 'Diana',
    role_label: 'Strategy Lead',
    kind: 'ai',
    model: 'anthropic:claude-3-7-sonnet',
    system_prompt: `You are Diana, the Strategy Lead on this executive team.
Your responsibility:
- Formulate high-leverage business hypotheses and actionable frameworks.
- Ground recommendations in competitive defensibility and realistic go-to-market mechanics.
- Produce structured executive memos with clear hypotheses, trade-offs, and decisive steps.
Never include fluffy marketing hype. Use crisp, high-density business logic.`,
    authority: 'draft',
    allowed_tools: ['web_search', 'drive_read', 'crm_lookup'],
    is_active: true,
    avatar_color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300'
  },
  {
    id: 'agent-crit-1',
    org_id: 'org-dnd',
    name: 'Athena',
    role_label: 'Critical Reviewer',
    kind: 'ai',
    model: 'anthropic:claude-3-5-haiku',
    system_prompt: `You are Athena, the Critical Reviewer. Your sole mandate is stress-testing and fault discovery.
MANDATORY RULES:
1. You are strictly forbidden from flattering, cheering, or restating the proposal.
2. You must provide exactly 3 to 5 concrete, actionable objections or failure modes.
3. Quantify blind spots: unit economic fragility, distribution bottlenecks, customer inertia, or regulatory pushback.
4. Score the proposal (1-10) on Execution Risk and Moat Durability.`,
    authority: 'suggest',
    allowed_tools: ['web_search'],
    is_active: true,
    avatar_color: 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-300'
  },
  {
    id: 'agent-gtm-1',
    org_id: 'org-dnd',
    name: 'Aria',
    role_label: 'Growth & GTM Specialist',
    kind: 'ai',
    model: 'google:gemini-2.5-flash',
    system_prompt: `You are Aria, the Growth & GTM Specialist.
Your responsibility:
- Translate high-level strategy into customer acquisition loops, outreach scripts, and pricing models.
- Create ready-to-use launch drafts, positioning pitches, and channel tests.
- Formulate measurable conversion milestones.`,
    authority: 'execute',
    allowed_tools: ['web_search', 'draft_email', 'slack_notify', 'crm_lookup'],
    is_active: true,
    avatar_color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300'
  },
  {
    id: 'agent-tech-1',
    org_id: 'org-dnd',
    name: 'Cipher',
    role_label: 'Technical Architect',
    kind: 'ai',
    model: 'google:gemini-2.5-pro',
    system_prompt: `You are Cipher, the Technical Architect.
Your responsibility:
- Design robust, minimal software architectures, database schemas, and API pipelines.
- Verify security isolation, tenant boundary enforcement, and operational reliability.
- Eliminate unnecessary complexity in favor of proven, maintainable systems.`,
    authority: 'draft',
    allowed_tools: ['github_read', 'web_search'],
    is_active: true,
    avatar_color: 'from-sky-500/20 to-blue-500/20 border-sky-500/30 text-sky-300'
  },
  {
    id: 'agent-ops-1',
    org_id: 'org-dnd',
    name: 'Nexus',
    role_label: 'Operations Lead',
    kind: 'ai',
    model: 'openai:gpt-4o',
    system_prompt: `You are Nexus, the Operations Lead.
Your responsibility:
- Oversee workflow sequencing, task accountability, and cross-team dependencies.
- Assemble final deliverables, check approval conditions, and synthesize mission artifacts.`,
    authority: 'operate',
    allowed_tools: ['slack_notify', 'draft_email', 'jira_update'],
    is_active: true,
    avatar_color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-300'
  },
  {
    id: 'agent-human-derrick',
    org_id: 'org-dnd',
    name: 'Derrick',
    role_label: 'Derrick (Founder Sign-off)',
    kind: 'human',
    human_user_id: 'user-derrick',
    model: 'human:derrick-verified',
    system_prompt: `Human executive reviewer with final decision authority over contracts, money, external publishing, and strategic commitments.`,
    authority: 'human_only',
    allowed_tools: ['stripe_payout', 'production_deploy', 'contract_sign'],
    is_active: true,
    avatar_color: 'from-amber-400/20 to-yellow-400/20 border-amber-400/30 text-amber-200'
  }
];

export const INITIAL_PLAYBOOKS: Playbook[] = [
  {
    id: 'pb-launch-dnd',
    org_id: null, // Shipped template
    name: 'Launch D&D — Strategic & GTM Rollout',
    description: 'End-to-end strategy formulation, red-team adversarial review, GTM positioning, draft customer collateral, and human authority sign-off.',
    category: 'Strategy & GTM',
    estimated_tokens: 18500,
    estimated_cost_cents: 34,
    steps: [
      {
        id: 'pbs-1',
        playbook_id: 'pb-launch-dnd',
        seq: 1,
        title: 'Formulate Core Strategy & Positioning Thesis',
        role_label: 'Strategy Lead',
        instruction: `Analyze the core goal: "{{goal}}". Formulate a 3-pillar positioning strategy, define target ICP boundaries, core value proposition, and the non-obvious wedge into the market.`,
        requires_approval: false
      },
      {
        id: 'pbs-2',
        playbook_id: 'pb-launch-dnd',
        seq: 2,
        title: 'Adversarial Red-Team & Moat Stress Test',
        role_label: 'Critical Reviewer',
        instruction: `Critique the Strategy Lead's thesis:\n{{step_1_output}}\nIdentify exactly 4 points of failure: distribution bottlenecks, buyer skepticism, pricing friction, and operational fragility. Do not praise the proposal.`,
        requires_approval: false
      },
      {
        id: 'pbs-3',
        playbook_id: 'pb-launch-dnd',
        seq: 3,
        title: 'GTM Distribution Play & Outbound Scripting',
        role_label: 'Growth & GTM Specialist',
        instruction: `Refining the thesis from Step 1 while addressing the objections in Step 2:\nBuild the pilot rollout plan: define the first 20 target accounts criteria, draft the personalized outreach sequence, and define success metrics.`,
        requires_approval: false
      },
      {
        id: 'pbs-4',
        playbook_id: 'pb-launch-dnd',
        seq: 4,
        title: 'Executive Sign-off & Commercial Commitment Gate',
        role_label: 'Derrick (Founder Sign-off)',
        instruction: `Review the GTM rollout and outbound campaign before live dispatch. Confirm pilot pricing, commercial liability terms, and target launch window.`,
        requires_approval: true,
        required_tool_tier: 4
      },
      {
        id: 'pbs-5',
        playbook_id: 'pb-launch-dnd',
        seq: 5,
        title: 'Synthesize Launch Artifacts & Propose Team Memory Facts',
        role_label: 'Operations Lead',
        instruction: `Compile the approved launch brief into a finalized executive memo. Extract 2 high-leverage strategic rules to propose as permanent Team Memory facts for human review.`,
        requires_approval: false
      }
    ]
  },
  {
    id: 'pb-competitor-audit',
    org_id: null,
    name: 'Competitor Deep Dive & Moat Audit',
    description: 'Systematic intelligence gathering, pricing structure comparison, vulnerability discovery, and counter-positioning tactics.',
    category: 'Strategy & GTM',
    estimated_tokens: 14200,
    estimated_cost_cents: 22,
    steps: [
      {
        id: 'pb-ca-1',
        playbook_id: 'pb-competitor-audit',
        seq: 1,
        title: 'Market Landscape & Competitor Mapping',
        role_label: 'Growth & GTM Specialist',
        instruction: `For the target market specified in "{{goal}}", identify top 3 direct competitors and 2 indirect substitutes. Map out their pricing tiers, core feature claims, and customer reviews.`,
        requires_approval: false
      },
      {
        id: 'pb-ca-2',
        playbook_id: 'pb-competitor-audit',
        seq: 2,
        title: 'Feature & Pricing Vulnerability Matrix',
        role_label: 'Strategy Lead',
        instruction: `Using the competitor map:\n{{step_1_output}}\nBuild a comparative matrix contrasting our product against competitors across setup velocity, total cost of ownership, lock-in risk, and enterprise compliance.`,
        requires_approval: false
      },
      {
        id: 'pb-ca-3',
        playbook_id: 'pb-competitor-audit',
        seq: 3,
        title: 'Stress-test Our Defensive Moats',
        role_label: 'Critical Reviewer',
        instruction: `Audit our proposed differentiation against competitor counter-attacks. What happens if Competitor A drops prices by 50% or copies our primary feature? Provide 3 blunt defensive realities.`,
        requires_approval: false
      },
      {
        id: 'pb-ca-4',
        playbook_id: 'pb-competitor-audit',
        seq: 4,
        title: 'Formulate Battlecard & Sales Counter-Arguments',
        role_label: 'Growth & GTM Specialist',
        instruction: `Synthesize a 1-page sales battlecard with killer questions for sales calls to disarm competitors.`,
        requires_approval: false
      }
    ]
  },
  {
    id: 'pb-tech-spec',
    org_id: null,
    name: 'Feature PRD to Production Architecture Spec',
    description: 'Transforms customer feature requests into rigorous data schemas, edge function orchestrations, security threat models, and implementation tasks.',
    category: 'Product & Engineering',
    estimated_tokens: 19000,
    estimated_cost_cents: 38,
    steps: [
      {
        id: 'pb-ts-1',
        playbook_id: 'pb-tech-spec',
        seq: 1,
        title: 'Draft Product Requirements Document (PRD)',
        role_label: 'Strategy Lead',
        instruction: `Convert goal "{{goal}}" into a crisp PRD: user problem, out-of-scope boundaries, acceptance criteria, and UX workflow sequence.`,
        requires_approval: false
      },
      {
        id: 'pb-ts-2',
        playbook_id: 'pb-tech-spec',
        seq: 2,
        title: 'Technical Schema & Edge Function Architecture',
        role_label: 'Technical Architect',
        instruction: `Based on the PRD:\n{{step_1_output}}\nDefine the Postgres SQL schema (tables, foreign keys, RLS policies) and edge worker execution flow. Ensure idempotency and zero PII leaks.`,
        requires_approval: false
      },
      {
        id: 'pb-ts-3',
        playbook_id: 'pb-tech-spec',
        seq: 3,
        title: 'Security, Rate Limits & Edge Case Audit',
        role_label: 'Critical Reviewer',
        instruction: `Audit the technical architecture:\n{{step_2_output}}\nFind 3 security risks, concurrency race conditions, or quota exhaustion vulnerabilities.`,
        requires_approval: false
      },
      {
        id: 'pb-ts-4',
        playbook_id: 'pb-tech-spec',
        seq: 4,
        title: 'Implementation Task Breakdown & Sprint Plan',
        role_label: 'Operations Lead',
        instruction: `Break down the verified technical spec into atomic development tasks with estimated dev days and dependencies.`,
        requires_approval: false
      }
    ]
  }
];

export const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'mission-001',
    org_id: 'org-dnd',
    playbook_id: 'pb-launch-dnd',
    playbook_name: 'Launch D&D — Strategic & GTM Rollout',
    title: 'Launch Diana & Derrick Advisory Platform',
    goal: 'Launch Diana & Derrick as a premium AI Team Operating System advisory for high-growth tech firms, pricing at $15k/mo pilot engagements.',
    status: 'running',
    created_by: 'user-derrick',
    created_at: '2026-08-28T18:00:00Z',
    total_tokens: 12450,
    total_cost_cents: 24.8
  },
  {
    id: 'mission-002',
    org_id: 'org-dnd',
    playbook_id: 'pb-competitor-audit',
    playbook_name: 'Competitor Deep Dive & Moat Audit',
    title: 'Q3 Enterprise Multi-Model Agent Audit',
    goal: 'Analyze open-source LangGraph and CrewAI solutions versus Team OS playbook-based queue architecture for mid-market security compliance.',
    status: 'done',
    created_by: 'user-derrick',
    created_at: '2026-08-27T12:00:00Z',
    finished_at: '2026-08-27T12:14:00Z',
    total_tokens: 14800,
    total_cost_cents: 28.5
  }
];

export const INITIAL_MISSION_STEPS: MissionStep[] = [
  {
    id: 'ms-001-1',
    mission_id: 'mission-001',
    seq: 1,
    title: 'Formulate Core Strategy & Positioning Thesis',
    agent_id: 'agent-strat-1',
    role_label: 'Strategy Lead',
    status: 'done',
    input: 'Analyze the core goal: "Launch Diana & Derrick as a premium AI Team Operating System advisory for high-growth tech firms, pricing at $15k/mo pilot engagements." Formulate a 3-pillar positioning strategy, define target ICP boundaries, core value proposition, and the non-obvious wedge into the market.',
    output: `### Diana & Derrick Strategic Thesis & Wedge Positioning

#### 1. The Core Wedge: "The Team as a Persistent Database Entity"
Instead of selling "another chatbot wrapper" or "prompt libraries", D&D positions the autonomous team as an operational asset with auditable authority tiers (L0–L4) and human-approved organizational memory.

- **ICP Profile:** Series A-C SaaS firms (25–150 employees) with high managerial overhead in GTM, product research, and competitive intelligence.
- **Economic Value:** Replaces $45,000/mo in fractional agency and contract labor with a deterministic $15,000/mo 30-day piloted playbook OS.

#### 2. Three Strategic Pillars
1. **Deterministic Playbooks over Stochastic Planners:** Enterprise buyers reject unpredictable agent swarms. We ship hardened, reproducible step sequences.
2. **Hard-coded Authority Enforcing (L0-L4):** Commercial decisions, payouts, external messages are non-delegable (L4).
3. **Approved Memory Flywheel:** AI suggestions only enter active context upon human sign-off, eliminating hallucinations from compounding over time.`,
    tokens_in: 920,
    tokens_out: 1450,
    cost_cents: 4.8,
    started_at: '2026-08-28T18:00:10Z',
    finished_at: '2026-08-28T18:01:15Z',
    tools_called: ['drive_read', 'web_search']
  },
  {
    id: 'ms-001-2',
    mission_id: 'mission-001',
    seq: 2,
    title: 'Adversarial Red-Team & Moat Stress Test',
    agent_id: 'agent-crit-1',
    role_label: 'Critical Reviewer',
    status: 'done',
    input: `Critique the Strategy Lead's thesis. Identify exactly 4 points of failure: distribution bottlenecks, buyer skepticism, pricing friction, and operational fragility. Do not praise the proposal.`,
    output: `### Adversarial Red-Team Audit

**Proposal Stress Score: 6.8 / 10** (Moat Durability: Medium-High | Execution Risk: High)

#### Point 1: Pilot Pricing Friction ($15k Anchor Shock)
- **Vulnerability:** If pitched to Head of Operations or VP of Product, $15k requires CFO approval and formal vendor onboarding.
- **Counter-Fix:** Frame as a "14-Day Strategic Pilot at $7,500" with full crediting toward the $15k/mo quarterly commitment upon milestone delivery.

#### Point 2: Buyer Skepticism on Context Ingestion
- **Vulnerability:** CTOs will worry their proprietary Slack / Google Workspace context is fed into open model training.
- **Counter-Fix:** Emphasize Supabase RLS tenant isolation and self-hosted n8n tool gateways where no third-party automation tool touches raw payloads.

#### Point 3: Playbook Staleness
- **Vulnerability:** Static playbooks become obsolete if customer workflows change.
- **Counter-Fix:** The system must allow one-click cloning and prompt tuning inside the playbook step editor.

#### Point 4: Reliance on Single Champion
- **Vulnerability:** If the internal sponsor leaves, team usage drops to zero.
- **Counter-Fix:** Multi-user approval queues ensure at least 2 stakeholders participate in weekly decision approvals.`,
    tokens_in: 1850,
    tokens_out: 1120,
    cost_cents: 3.2,
    started_at: '2026-08-28T18:01:20Z',
    finished_at: '2026-08-28T18:02:10Z',
    tools_called: ['web_search']
  },
  {
    id: 'ms-001-3',
    mission_id: 'mission-001',
    seq: 3,
    title: 'GTM Distribution Play & Outbound Scripting',
    agent_id: 'agent-gtm-1',
    role_label: 'Growth & GTM Specialist',
    status: 'done',
    input: `Refining the thesis from Step 1 while addressing the objections in Step 2: Build the pilot rollout plan: define the first 20 target accounts criteria, draft the personalized outreach sequence, and define success metrics.`,
    output: `### GTM Distribution Campaign & Pilot Scripting

#### 1. Target Account Filter (First 20 Pilot Accounts)
- Raised Series A/B in past 18 months in B2B SaaS / FinTech.
- Tech Stack: Supabase/Postgres or modern web stack.
- Pain Signal: Hiring 3+ product managers or research analysts simultaneously.

#### 2. Cold Outreach Script (Founders / COOs)
**Subject:** Autonomous Team OS vs. hiring 3 more analysts
**Body:**
> *Hi {{first_name}}, noticed you are scaling your product and GTM research pipeline.*
> *Most teams are burning $35k/mo on fractional consultants or wrestling with fragile AI chat swarms that hallucinate context.*
> *We built Team OS — a multi-agent system running deterministic playbooks, tiered authority gates (L0–L4), and human-approved organizational memory.*
> *We are onboarding 3 design partners for a 30-day piloted deployment. Open to reviewing our 7-step GTM rollout demo?*

#### 3. Measurable Pilot Success Milestone
- Deliver 3 complete strategy missions with 100% human sign-off on outputs within first 14 days.`,
    tokens_in: 2100,
    tokens_out: 1680,
    cost_cents: 4.6,
    started_at: '2026-08-28T18:02:15Z',
    finished_at: '2026-08-28T18:03:30Z',
    tools_called: ['draft_email', 'crm_lookup']
  },
  {
    id: 'ms-001-4',
    mission_id: 'mission-001',
    seq: 4,
    title: 'Executive Sign-off & Commercial Commitment Gate',
    agent_id: 'agent-human-derrick',
    role_label: 'Derrick (Founder Sign-off)',
    status: 'awaiting_approval',
    input: 'Review the GTM rollout and outbound campaign before live dispatch. Confirm pilot pricing, commercial liability terms, and target launch window.',
    output: `Proposal submitted for Derrick's Human Authority L4 Review:
1. Target pricing confirmed at $7,500 initial 14-day sprint or $15,000/mo pilot.
2. Direct outreach to first batch of 20 target Series A founders.
3. Requires manual confirmation before scheduling outbound email pipeline dispatch.`,
    requires_approval: true,
    started_at: '2026-08-28T18:03:35Z'
  },
  {
    id: 'ms-001-5',
    mission_id: 'mission-001',
    seq: 5,
    title: 'Synthesize Launch Artifacts & Propose Team Memory Facts',
    agent_id: 'agent-ops-1',
    role_label: 'Operations Lead',
    status: 'pending',
    input: 'Compile the approved launch brief into a finalized executive memo. Extract 2 high-leverage strategic rules to propose as permanent Team Memory facts for human review.',
    requires_approval: false
  }
];

export const INITIAL_APPROVALS: Approval[] = [
  {
    id: 'appr-001',
    org_id: 'org-dnd',
    mission_step_id: 'ms-001-4',
    mission_id: 'mission-001',
    mission_title: 'Launch Diana & Derrick Advisory Platform',
    step_title: 'Executive Sign-off & Commercial Commitment Gate',
    question: 'Authorize launch of the 20-account founder outreach pilot and confirm $7.5k / $15k pricing tier with L4 Human Authority?',
    proposal: `The Growth & Strategy leads have assembled the 20 target ICP account criteria and cold outbound sequence.

Commercial Parameters for Sign-off:
- **Offer Structure:** 14-Day Pilot at $7,500 creditable to $15,000/mo quarterly retainer.
- **Dispatch Channels:** Gmail draft dispatch via n8n integration.
- **Risk Guarantee:** L4 Human Only requirement active — no email leaves without individual review.

Please select Approve to unlock Step 5 (Launch Memo Synthesis & Team Memory extraction), Revise to modify pricing/copy notes, or Reject to halt.`,
    decision: null,
    created_at: '2026-08-28T18:03:35Z'
  }
];

export const INITIAL_MEMORY_FACTS: MemoryFact[] = [
  {
    id: 'mem-1',
    org_id: 'org-dnd',
    kind: 'preference',
    body: 'Format all strategic memorandums with an explicit 3-bullet Executive Summary followed by downside failure analysis.',
    source_mission_id: 'mission-002',
    source_mission_title: 'Q3 Enterprise Multi-Model Agent Audit',
    approved_by: 'Derrick (Founder)',
    approved_at: '2026-08-27T12:30:00Z',
    created_at: '2026-08-27T12:15:00Z'
  },
  {
    id: 'mem-2',
    org_id: 'org-dnd',
    kind: 'decision',
    body: 'Standardize on Supabase Edge Functions + self-hosted n8n for enterprise tool integration; zero raw customer PII touches unvetted third-party connectors.',
    source_mission_id: 'mission-002',
    source_mission_title: 'Q3 Enterprise Multi-Model Agent Audit',
    approved_by: 'Derrick (Founder)',
    approved_at: '2026-08-27T13:00:00Z',
    created_at: '2026-08-27T12:20:00Z'
  },
  {
    id: 'mem-3',
    org_id: 'org-dnd',
    kind: 'lesson',
    body: 'When quoting pilot pricing to prospective clients, always anchor against senior contractor monthly wages ($15k-$25k), never SaaS software subscription benchmarks.',
    source_mission_id: 'mission-001',
    source_mission_title: 'Launch Diana & Derrick Advisory Platform',
    approved_by: 'Diana (Managing Partner)',
    approved_at: '2026-08-28T15:00:00Z',
    created_at: '2026-08-28T14:45:00Z'
  },
  {
    id: 'mem-4',
    org_id: 'org-dnd',
    kind: 'fact',
    body: 'D&D primary target ICP is B2B Series A-C software companies (25-150 employees) with high research and GTM coordination overhead.',
    source_mission_id: null,
    approved_by: 'Derrick (Founder)',
    approved_at: '2026-08-26T10:00:00Z',
    created_at: '2026-08-26T09:30:00Z'
  },
  {
    id: 'mem-prop-1',
    org_id: 'org-dnd',
    kind: 'lesson',
    body: 'Limit autonomous review loops to a strict ceiling of 3 iterations before forcibly escalating to a human sponsor to prevent circular debate.',
    source_mission_id: 'mission-001',
    source_mission_title: 'Launch Diana & Derrick Advisory Platform',
    approved_by: null, // Proposed!
    created_at: '2026-08-28T18:02:10Z',
    suggested_by_role: 'Critical Reviewer'
  },
  {
    id: 'mem-prop-2',
    org_id: 'org-dnd',
    kind: 'decision',
    body: 'Require dual-factor human approval for any automated CRM deal stage progression exceeding $50k ACV.',
    source_mission_id: 'mission-001',
    source_mission_title: 'Launch Diana & Derrick Advisory Platform',
    approved_by: null, // Proposed!
    created_at: '2026-08-28T18:03:00Z',
    suggested_by_role: 'Growth & GTM Specialist'
  }
];

export const INITIAL_ARTIFACTS: Artifact[] = [
  {
    id: 'art-1',
    org_id: 'org-dnd',
    mission_id: 'mission-001',
    title: 'Diana & Derrick GTM Wedge Strategy Memo.md',
    kind: 'doc',
    body: `# Diana & Derrick Advisory — Launch Strategy & Wedge Memo

## Executive Summary
1. The Team OS positions autonomous AI teams as persistent database entities rather than transient chat sessions.
2. The wedge is deterministic 7-step playbooks with non-delegable L4 human authority sign-offs.
3. Pilots are structured at $7,500 (14-day sprint) or $15,000/mo (30-day comprehensive deployment).`,
    created_at: '2026-08-28T18:01:15Z'
  },
  {
    id: 'art-2',
    org_id: 'org-dnd',
    mission_id: 'mission-001',
    title: 'Founder Outbound Script & 20 ICP Targets.json',
    kind: 'code',
    body: `{\n  "target_icp": "Series A/B SaaS with >$2M ARR",\n  "pilot_price": 7500,\n  "monthly_retainer": 15000,\n  "first_cohort_size": 20\n}`,
    created_at: '2026-08-28T18:03:30Z'
  }
];

export const INITIAL_USAGE_EVENTS: UsageEvent[] = [
  {
    id: 1,
    org_id: 'org-dnd',
    mission_step_id: 'ms-001-1',
    model: 'anthropic:claude-3-7-sonnet',
    tokens_in: 920,
    tokens_out: 1450,
    cost_cents: 4.80,
    occurred_at: '2026-08-28T18:01:15Z'
  },
  {
    id: 2,
    org_id: 'org-dnd',
    mission_step_id: 'ms-001-2',
    model: 'anthropic:claude-3-5-haiku',
    tokens_in: 1850,
    tokens_out: 1120,
    cost_cents: 3.20,
    occurred_at: '2026-08-28T18:02:10Z'
  },
  {
    id: 3,
    org_id: 'org-dnd',
    mission_step_id: 'ms-001-3',
    model: 'google:gemini-2.5-flash',
    tokens_in: 2100,
    tokens_out: 1680,
    cost_cents: 4.60,
    occurred_at: '2026-08-28T18:03:30Z'
  },
  {
    id: 4,
    org_id: 'org-dnd',
    mission_step_id: null,
    model: 'google:gemini-2.5-pro',
    tokens_in: 4500,
    tokens_out: 3200,
    cost_cents: 28.50,
    occurred_at: '2026-08-27T12:14:00Z'
  }
];

export const INITIAL_JOBS: Job[] = [
  {
    id: 101,
    org_id: 'org-dnd',
    mission_step_id: 'ms-001-4',
    mission_id: 'mission-001',
    status: 'leased',
    attempts: 1,
    lease_until: '2026-08-28T18:08:35Z',
    created_at: '2026-08-28T18:03:35Z'
  }
];
