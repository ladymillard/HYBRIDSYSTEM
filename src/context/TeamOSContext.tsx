import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Org,
  OrgMember,
  Agent,
  Playbook,
  Mission,
  MissionStep,
  Approval,
  MemoryFact,
  Artifact,
  UsageEvent,
  Job,
  AuthorityLevel,
  MemoryFactKind
} from '../types';
import {
  INITIAL_ORGS,
  INITIAL_MEMBERS,
  INITIAL_AGENTS,
  INITIAL_PLAYBOOKS,
  INITIAL_MISSIONS,
  INITIAL_MISSION_STEPS,
  INITIAL_APPROVALS,
  INITIAL_MEMORY_FACTS,
  INITIAL_ARTIFACTS,
  INITIAL_USAGE_EVENTS,
  INITIAL_JOBS,
  AVAILABLE_MODELS,
  AVAILABLE_TOOLS
} from '../data/seedData';

interface TeamOSContextType {
  // Tenancy
  currentOrg: Org;
  orgs: Org[];
  members: OrgMember[];
  switchOrg: (orgId: string) => void;
  createOrg: (name: string, plan?: 'trial' | 'team' | 'enterprise') => Org;
  updateOrgCap: (capCents: number) => void;
  currentUser: OrgMember;
  
  // Agents & Roster
  agents: Agent[];
  addAgent: (agent: Omit<Agent, 'id' | 'org_id'>) => Agent;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;

  // Playbooks
  playbooks: Playbook[];
  addPlaybook: (playbook: Omit<Playbook, 'id'>) => Playbook;
  updatePlaybook: (id: string, updates: Partial<Playbook>) => void;

  // Missions & Steps
  missions: Mission[];
  missionSteps: MissionStep[];
  selectedMissionId: string | null;
  setSelectedMissionId: (id: string | null) => void;
  startMission: (playbookId: string | null, title: string, goal: string) => Mission;
  cancelMission: (missionId: string) => void;

  // Approvals (Human-in-the-loop)
  approvals: Approval[];
  decideApproval: (approvalId: string, decision: 'approved' | 'revised' | 'rejected', note?: string) => Promise<void>;

  // Memory (In Effect vs Proposed)
  memoryFacts: MemoryFact[];
  inEffectMemory: MemoryFact[];
  proposedMemory: MemoryFact[];
  approveMemoryFact: (id: string) => void;
  dismissMemoryFact: (id: string) => void;
  revokeMemoryFact: (id: string) => void;
  addMemoryFact: (fact: { kind: MemoryFactKind; body: string }) => void;

  // Artifacts & Metering
  artifacts: Artifact[];
  usageEvents: UsageEvent[];
  monthSpendCents: number;
  spendPercentage: number;
  isSpendCapped: boolean;

  // Queue & Worker Loop
  jobs: Job[];
  workerStatus: {
    isRunning: boolean;
    lastTick: string | null;
    currentJobId: number | null;
    autoWorkerEnabled: boolean;
  };
  toggleAutoWorker: () => void;
  tickWorker: () => Promise<boolean>;
  resetToSeedData: () => void;
  
  // Real AI or simulated execution
  isProcessingStep: boolean;
}

const STORAGE_KEY = 'teamos_v1_store';

const TeamOSContext = createContext<TeamOSContextType | undefined>(undefined);

export const TeamOSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from localStorage or initialize with seed data
  const [initialized, setInitialized] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_orgs`);
    return saved ? JSON.parse(saved) : INITIAL_ORGS;
  });
  
  const [currentOrgId, setCurrentOrgId] = useState<string>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_current_org_id`);
    return saved || INITIAL_ORGS[0].id;
  });

  const [members, setMembers] = useState<OrgMember[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_members`);
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });

  const [agents, setAgents] = useState<Agent[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_agents`);
    return saved ? JSON.parse(saved) : INITIAL_AGENTS;
  });

  const [playbooks, setPlaybooks] = useState<Playbook[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_playbooks`);
    return saved ? JSON.parse(saved) : INITIAL_PLAYBOOKS;
  });

  const [missions, setMissions] = useState<Mission[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_missions`);
    return saved ? JSON.parse(saved) : INITIAL_MISSIONS;
  });

  const [missionSteps, setMissionSteps] = useState<MissionStep[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_mission_steps`);
    return saved ? JSON.parse(saved) : INITIAL_MISSION_STEPS;
  });

  const [approvals, setApprovals] = useState<Approval[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_approvals`);
    return saved ? JSON.parse(saved) : INITIAL_APPROVALS;
  });

  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_memory_facts`);
    return saved ? JSON.parse(saved) : INITIAL_MEMORY_FACTS;
  });

  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_artifacts`);
    return saved ? JSON.parse(saved) : INITIAL_ARTIFACTS;
  });

  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_usage_events`);
    return saved ? JSON.parse(saved) : INITIAL_USAGE_EVENTS;
  });

  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_jobs`);
    return saved ? JSON.parse(saved) : INITIAL_JOBS;
  });

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(INITIAL_MISSIONS[0]?.id || null);

  const [workerStatus, setWorkerStatus] = useState({
    isRunning: false,
    lastTick: new Date().toISOString(),
    currentJobId: null as number | null,
    autoWorkerEnabled: true
  });

  const [isProcessingStep, setIsProcessingStep] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_orgs`, JSON.stringify(orgs));
    localStorage.setItem(`${STORAGE_KEY}_current_org_id`, currentOrgId);
    localStorage.setItem(`${STORAGE_KEY}_members`, JSON.stringify(members));
    localStorage.setItem(`${STORAGE_KEY}_agents`, JSON.stringify(agents));
    localStorage.setItem(`${STORAGE_KEY}_playbooks`, JSON.stringify(playbooks));
    localStorage.setItem(`${STORAGE_KEY}_missions`, JSON.stringify(missions));
    localStorage.setItem(`${STORAGE_KEY}_mission_steps`, JSON.stringify(missionSteps));
    localStorage.setItem(`${STORAGE_KEY}_approvals`, JSON.stringify(approvals));
    localStorage.setItem(`${STORAGE_KEY}_memory_facts`, JSON.stringify(memoryFacts));
    localStorage.setItem(`${STORAGE_KEY}_artifacts`, JSON.stringify(artifacts));
    localStorage.setItem(`${STORAGE_KEY}_usage_events`, JSON.stringify(usageEvents));
    localStorage.setItem(`${STORAGE_KEY}_jobs`, JSON.stringify(jobs));
  }, [orgs, currentOrgId, members, agents, playbooks, missions, missionSteps, approvals, memoryFacts, artifacts, usageEvents, jobs]);

  // Current Organization
  const currentOrg = useMemo(() => {
    return orgs.find(o => o.id === currentOrgId) || orgs[0] || INITIAL_ORGS[0];
  }, [orgs, currentOrgId]);

  // Current User
  const currentUser = useMemo(() => {
    return members.find(m => m.org_id === currentOrg.id) || {
      org_id: currentOrg.id,
      user_id: 'user-derek',
      name: 'Derek (Founder)',
      email: 'derek@dianaderek.com',
      role: 'owner' as const
    };
  }, [members, currentOrg.id]);

  // Filtered by current org
  const orgAgents = useMemo(() => agents.filter(a => a.org_id === currentOrg.id), [agents, currentOrg.id]);
  const orgMissions = useMemo(() => missions.filter(m => m.org_id === currentOrg.id), [missions, currentOrg.id]);
  const orgApprovals = useMemo(() => approvals.filter(a => a.org_id === currentOrg.id), [approvals, currentOrg.id]);
  const orgMemoryFacts = useMemo(() => memoryFacts.filter(m => m.org_id === currentOrg.id), [memoryFacts, currentOrg.id]);
  const orgArtifacts = useMemo(() => artifacts.filter(a => a.org_id === currentOrg.id), [artifacts, currentOrg.id]);
  const orgUsageEvents = useMemo(() => usageEvents.filter(u => u.org_id === currentOrg.id), [usageEvents, currentOrg.id]);
  const orgJobs = useMemo(() => jobs.filter(j => j.org_id === currentOrg.id), [jobs, currentOrg.id]);

  // Memory segments
  const inEffectMemory = useMemo(() => orgMemoryFacts.filter(m => m.approved_by !== null), [orgMemoryFacts]);
  const proposedMemory = useMemo(() => orgMemoryFacts.filter(m => m.approved_by === null), [orgMemoryFacts]);

  // Metering & Spend Calculation
  const monthSpendCents = useMemo(() => {
    return orgUsageEvents.reduce((acc, curr) => acc + (curr.cost_cents || 0), 0);
  }, [orgUsageEvents]);

  const spendPercentage = useMemo(() => {
    if (!currentOrg.monthly_cost_cap_cents || currentOrg.monthly_cost_cap_cents <= 0) return 0;
    return Math.min(100, Math.round((monthSpendCents / currentOrg.monthly_cost_cap_cents) * 100));
  }, [monthSpendCents, currentOrg.monthly_cost_cap_cents]);

  const isSpendCapped = monthSpendCents >= currentOrg.monthly_cost_cap_cents;

  // Org switching & creation
  const switchOrg = (orgId: string) => {
    setCurrentOrgId(orgId);
  };

  const createOrg = (name: string, plan: 'trial' | 'team' | 'enterprise' = 'trial') => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const caps = { trial: 2500, team: 10000, enterprise: 50000 };
    const newOrg: Org = {
      id: `org-${Date.now()}`,
      name,
      slug: slug || `org-${Date.now()}`,
      plan,
      monthly_cost_cap_cents: caps[plan],
      created_at: new Date().toISOString()
    };

    const newMember: OrgMember = {
      org_id: newOrg.id,
      user_id: `user-${Date.now()}`,
      name: 'Account Owner',
      email: 'owner@' + (slug ? `${slug}.com` : 'company.com'),
      role: 'owner'
    };

    // Seed default team roster for new org
    const defaultAgents: Agent[] = [
      {
        id: `agent-${Date.now()}-1`,
        org_id: newOrg.id,
        role_label: 'Strategy Lead',
        kind: 'ai',
        model: 'anthropic:claude-3-7-sonnet',
        system_prompt: 'You are the Strategy Lead on this executive team. Provide clear strategic frameworks with trade-offs.',
        authority: 'draft',
        allowed_tools: ['web_search', 'drive_read'],
        is_active: true,
        avatar_color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300'
      },
      {
        id: `agent-${Date.now()}-2`,
        org_id: newOrg.id,
        role_label: 'Critical Reviewer',
        kind: 'ai',
        model: 'anthropic:claude-3-5-haiku',
        system_prompt: 'Stress-test proposals with exactly 3 concrete objections. Do not cheer or flatter.',
        authority: 'suggest',
        allowed_tools: ['web_search'],
        is_active: true,
        avatar_color: 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-300'
      },
      {
        id: `agent-${Date.now()}-3`,
        org_id: newOrg.id,
        role_label: 'Operations Lead',
        kind: 'ai',
        model: 'google:gemini-2.5-flash',
        system_prompt: 'Coordinate deliverables, synthesize final artifacts, and verify requirements.',
        authority: 'operate',
        allowed_tools: ['slack_notify', 'draft_email'],
        is_active: true,
        avatar_color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300'
      }
    ];

    setOrgs(prev => [...prev, newOrg]);
    setMembers(prev => [...prev, newMember]);
    setAgents(prev => [...prev, ...defaultAgents]);
    setCurrentOrgId(newOrg.id);
    return newOrg;
  };

  const updateOrgCap = (capCents: number) => {
    setOrgs(prev => prev.map(o => o.id === currentOrg.id ? { ...o, monthly_cost_cap_cents: capCents } : o));
  };

  // Agent mutations
  const addAgent = (agentData: Omit<Agent, 'id' | 'org_id'>) => {
    const newAgent: Agent = {
      ...agentData,
      id: `agent-${Date.now()}`,
      org_id: currentOrg.id,
      avatar_color: agentData.avatar_color || 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-300'
    };
    setAgents(prev => [...prev, newAgent]);
    return newAgent;
  };

  const updateAgent = (id: string, updates: Partial<Agent>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAgent = (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  // Playbooks
  const addPlaybook = (playbookData: Omit<Playbook, 'id'>) => {
    const newPlaybook: Playbook = {
      ...playbookData,
      id: `pb-${Date.now()}`
    };
    setPlaybooks(prev => [...prev, newPlaybook]);
    return newPlaybook;
  };

  const updatePlaybook = (id: string, updates: Partial<Playbook>) => {
    setPlaybooks(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // Start Mission (Equivalent to Postgres RPC start_mission)
  const startMission = (playbookId: string | null, title: string, goal: string): Mission => {
    const missionId = `mission-${Date.now()}`;
    const selectedPlaybook = playbooks.find(p => p.id === playbookId);

    const newMission: Mission = {
      id: missionId,
      org_id: currentOrg.id,
      playbook_id: playbookId,
      playbook_name: selectedPlaybook?.name || 'Custom Mission',
      title: title || (selectedPlaybook ? selectedPlaybook.name : 'Untitled Mission'),
      goal,
      status: 'running',
      created_by: currentUser.name,
      created_at: new Date().toISOString(),
      total_tokens: 0,
      total_cost_cents: 0
    };

    let newSteps: MissionStep[] = [];

    if (selectedPlaybook && selectedPlaybook.steps.length > 0) {
      newSteps = selectedPlaybook.steps.map((pStep, index) => {
        // Resolve role_label to agent in org
        const matchedAgent = orgAgents.find(a => a.role_label.toLowerCase() === pStep.role_label.toLowerCase() && a.is_active)
          || orgAgents[index % orgAgents.length]
          || orgAgents[0];

        return {
          id: `ms-${missionId}-${pStep.seq}`,
          mission_id: missionId,
          seq: pStep.seq,
          title: pStep.title,
          agent_id: matchedAgent?.id,
          role_label: pStep.role_label,
          status: index === 0 ? 'running' : 'pending',
          input: pStep.instruction,
          requires_approval: pStep.requires_approval,
          tools_called: matchedAgent?.allowed_tools || []
        };
      });
    } else {
      // Single custom step
      const defaultAgent = orgAgents[0];
      newSteps = [
        {
          id: `ms-${missionId}-1`,
          mission_id: missionId,
          seq: 1,
          title: 'Execute Goal',
          agent_id: defaultAgent?.id,
          role_label: defaultAgent?.role_label || 'Strategy Lead',
          status: 'running',
          input: goal,
          requires_approval: false,
          tools_called: defaultAgent?.allowed_tools || []
        }
      ];
    }

    // Add Job for Step 1
    const firstStep = newSteps[0];
    const newJob: Job = {
      id: Date.now(),
      org_id: currentOrg.id,
      mission_step_id: firstStep.id,
      mission_id: missionId,
      status: 'queued',
      attempts: 0,
      created_at: new Date().toISOString()
    };

    setMissions(prev => [newMission, ...prev]);
    setMissionSteps(prev => [...prev, ...newSteps]);
    setJobs(prev => [...prev, newJob]);
    setSelectedMissionId(missionId);

    return newMission;
  };

  const cancelMission = (missionId: string) => {
    setMissions(prev => prev.map(m => m.id === missionId ? { ...m, status: 'failed' } : m));
    setMissionSteps(prev => prev.map(s => s.mission_id === missionId && (s.status === 'pending' || s.status === 'running' || s.status === 'awaiting_approval') ? { ...s, status: 'skipped' } : s));
    setJobs(prev => prev.filter(j => j.mission_id !== missionId));
  };

  // Memory approvals
  const approveMemoryFact = (id: string) => {
    setMemoryFacts(prev => prev.map(m => m.id === id ? {
      ...m,
      approved_by: currentUser.name,
      approved_at: new Date().toISOString()
    } : m));
  };

  const dismissMemoryFact = (id: string) => {
    setMemoryFacts(prev => prev.filter(m => m.id !== id));
  };

  const revokeMemoryFact = (id: string) => {
    setMemoryFacts(prev => prev.map(m => m.id === id ? {
      ...m,
      approved_by: null,
      approved_at: null
    } : m));
  };

  const addMemoryFact = (fact: { kind: MemoryFactKind; body: string }) => {
    const newFact: MemoryFact = {
      id: `mem-${Date.now()}`,
      org_id: currentOrg.id,
      kind: fact.kind,
      body: fact.body,
      approved_by: currentUser.name,
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    setMemoryFacts(prev => [newFact, ...prev]);
  };

  // Human Approval Decision
  const decideApproval = async (approvalId: string, decision: 'approved' | 'revised' | 'rejected', note?: string) => {
    const approval = approvals.find(a => a.id === approvalId);
    if (!approval) return;

    const now = new Date().toISOString();

    setApprovals(prev => prev.map(a => a.id === approvalId ? {
      ...a,
      decision,
      note: note || a.note,
      decided_by: currentUser.name,
      decided_at: now
    } : a));

    const step = missionSteps.find(s => s.id === approval.mission_step_id);
    if (!step) return;

    if (decision === 'approved' || decision === 'revised') {
      // Mark step done and enqueue next step
      const stepOutput = decision === 'revised'
        ? `${step.output || ''}\n\n> **Human Revision Approved by ${currentUser.name}**: ${note || 'Proceed with updated guidance.'}`
        : step.output;

      setMissionSteps(prev => prev.map(s => s.id === step.id ? {
        ...s,
        status: 'done',
        output: stepOutput,
        finished_at: now
      } : s));

      // Find next step in mission
      const currentMissionSteps = missionSteps.filter(s => s.mission_id === step.mission_id).sort((a, b) => a.seq - b.seq);
      const nextStep = currentMissionSteps.find(s => s.seq === step.seq + 1);

      if (nextStep) {
        setMissionSteps(prev => prev.map(s => s.id === nextStep.id ? { ...s, status: 'running', started_at: now } : s));
        const nextJob: Job = {
          id: Date.now(),
          org_id: currentOrg.id,
          mission_step_id: nextStep.id,
          mission_id: step.mission_id,
          status: 'queued',
          attempts: 0,
          created_at: now
        };
        setJobs(prev => [...prev, nextJob]);
      } else {
        // Mission complete!
        setMissions(prev => prev.map(m => m.id === step.mission_id ? {
          ...m,
          status: 'done',
          finished_at: now
        } : m));
      }
    } else if (decision === 'rejected') {
      // Mark step failed and mission blocked
      setMissionSteps(prev => prev.map(s => s.id === step.id ? {
        ...s,
        status: 'failed',
        error: `Rejected by human authority (${currentUser.name}): ${note || 'No reason specified'}`,
        finished_at: now
      } : s));

      setMissions(prev => prev.map(m => m.id === step.mission_id ? {
        ...m,
        status: 'blocked'
      } : m));
    }
  };

  // ----------------------------------------------------
  // THE ORCHESTRATOR WORKER LOOP (Section 05 of Blueprint)
  // ----------------------------------------------------
  const tickWorker = useCallback(async (): Promise<boolean> => {
    // 1 - LEASE one queued or timed-out job
    const now = new Date();
    const activeJobs = jobs.filter(j => j.org_id === currentOrg.id);
    const candidateJob = activeJobs.find(j => j.status === 'queued');

    if (!candidateJob) {
      setWorkerStatus(prev => ({ ...prev, lastTick: new Date().toISOString(), currentJobId: null }));
      return false;
    }

    // 2 - CAP Check: Refuse before spending, not after
    if (isSpendCapped) {
      setJobs(prev => prev.map(j => j.id === candidateJob.id ? {
        ...j,
        status: 'failed',
        last_error: 'Monthly cost cap reached for organization. Upgrade plan or raise limit.'
      } : j));

      setMissionSteps(prev => prev.map(s => s.id === candidateJob.mission_step_id ? {
        ...s,
        status: 'failed',
        error: 'Mission halted: Monthly tenant cost cap reached.'
      } : s));

      setMissions(prev => prev.map(m => m.id === candidateJob.mission_id ? {
        ...m,
        status: 'blocked'
      } : m));

      return false;
    }

    // Set job to leased
    setJobs(prev => prev.map(j => j.id === candidateJob.id ? {
      ...j,
      status: 'leased',
      attempts: j.attempts + 1,
      lease_until: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    } : j));

    setWorkerStatus(prev => ({
      ...prev,
      isRunning: true,
      lastTick: new Date().toISOString(),
      currentJobId: candidateJob.id
    }));

    setIsProcessingStep(true);

    try {
      // 3 - ASSEMBLE context
      const step = missionSteps.find(s => s.id === candidateJob.mission_step_id);
      if (!step) {
        setJobs(prev => prev.filter(j => j.id !== candidateJob.id));
        setIsProcessingStep(false);
        return false;
      }

      const mission = missions.find(m => m.id === step.mission_id);
      if (!mission) {
        setIsProcessingStep(false);
        return false;
      }

      const agent = agents.find(a => a.id === step.agent_id) || agents.find(a => a.role_label === step.role_label) || agents[0];
      
      // Approved Memory Only (Fix 05 in blueprint)
      const approvedFacts = inEffectMemory.map(m => `- [${m.kind.toUpperCase()}] ${m.body}`).join('\n');

      // Prior step outputs
      const priorSteps = missionSteps
        .filter(s => s.mission_id === mission.id && s.seq < step.seq && s.output)
        .sort((a, b) => a.seq - b.seq);

      let renderedInput = step.input.replace(/\{\{goal\}\}/g, mission.goal);
      priorSteps.forEach(p => {
        const regex = new RegExp(`\\{\\{step_${p.seq}_output\\}\\}`, 'g');
        renderedInput = renderedInput.replace(regex, p.output || '');
      });
      renderedInput = renderedInput.replace(/\{\{prior_output\}\}/g, priorSteps[priorSteps.length - 1]?.output || '');

      // Mark step running
      setMissionSteps(prev => prev.map(s => s.id === step.id ? {
        ...s,
        status: 'running',
        started_at: new Date().toISOString()
      } : s));

      // 4 - EXECUTE / GENERATE Model output
      // Simulate realistic execution with slight delay or generate rich contextual output
      await new Promise(resolve => setTimeout(resolve, 1400));

      const generatedResult = generateStepExecutionResult(agent, step, mission, approvedFacts, renderedInput, priorSteps);

      // 5 - METER: Log usage event
      const modelConfig = AVAILABLE_MODELS.find(m => m.id === agent.model) || AVAILABLE_MODELS[0];
      const costCents = (generatedResult.tokensIn / 1000 * modelConfig.cost_per_1k_in_cents) +
                        (generatedResult.tokensOut / 1000 * modelConfig.cost_per_1k_out_cents);

      const usageEvent: UsageEvent = {
        id: Date.now(),
        org_id: currentOrg.id,
        mission_step_id: step.id,
        model: agent.model,
        tokens_in: generatedResult.tokensIn,
        tokens_out: generatedResult.tokensOut,
        cost_cents: parseFloat(costCents.toFixed(4)),
        occurred_at: new Date().toISOString()
      };

      setUsageEvents(prev => [...prev, usageEvent]);

      // 6 - AUTHORITY GATE (Fix 06)
      const tierMap: Record<AuthorityLevel, number> = {
        suggest: 0,
        draft: 1,
        execute: 2,
        operate: 3,
        human_only: 4
      };

      const agentTier = tierMap[agent.authority];
      const needsHuman = step.requires_approval ||
                         agent.authority === 'human_only' ||
                         (generatedResult.requestedToolTier > agentTier);

      if (needsHuman) {
        // Pauses in awaiting_approval and creates an approval item
        const approvalRecord: Approval = {
          id: `appr-${Date.now()}`,
          org_id: currentOrg.id,
          mission_step_id: step.id,
          mission_id: mission.id,
          mission_title: mission.title,
          step_title: step.title,
          question: generatedResult.approvalQuestion || `Human sign-off required for ${step.title} (${agent.role_label})`,
          proposal: generatedResult.text,
          decision: null,
          created_at: new Date().toISOString()
        };

        setApprovals(prev => [approvalRecord, ...prev]);

        setMissionSteps(prev => prev.map(s => s.id === step.id ? {
          ...s,
          status: 'awaiting_approval',
          output: generatedResult.text,
          tokens_in: generatedResult.tokensIn,
          tokens_out: generatedResult.tokensOut,
          cost_cents: parseFloat(costCents.toFixed(2))
        } : s));

        // Close job
        setJobs(prev => prev.map(j => j.id === candidateJob.id ? { ...j, status: 'done' } : j));
      } else {
        // Step complete! Advance to next step
        setMissionSteps(prev => prev.map(s => s.id === step.id ? {
          ...s,
          status: 'done',
          output: generatedResult.text,
          tokens_in: generatedResult.tokensIn,
          tokens_out: generatedResult.tokensOut,
          cost_cents: parseFloat(costCents.toFixed(2)),
          finished_at: new Date().toISOString()
        } : s));

        // Create artifacts if generated
        if (generatedResult.artifact) {
          const newArtifact: Artifact = {
            id: `art-${Date.now()}`,
            org_id: currentOrg.id,
            mission_id: mission.id,
            title: generatedResult.artifact.title,
            kind: generatedResult.artifact.kind,
            body: generatedResult.artifact.body,
            created_at: new Date().toISOString()
          };
          setArtifacts(prev => [newArtifact, ...prev]);
        }

        // Propose memory lesson if extracted (Fix 05: proposed, not yet approved)
        if (generatedResult.proposedMemoryLesson) {
          const proposedFact: MemoryFact = {
            id: `mem-prop-${Date.now()}`,
            org_id: currentOrg.id,
            kind: generatedResult.proposedMemoryLesson.kind,
            body: generatedResult.proposedMemoryLesson.body,
            source_mission_id: mission.id,
            source_mission_title: mission.title,
            approved_by: null, // Proposed!
            created_at: new Date().toISOString(),
            suggested_by_role: agent.role_label
          };
          setMemoryFacts(prev => [proposedFact, ...prev]);
        }

        // Enqueue next step
        const allStepsInMission = missionSteps
          .filter(s => s.mission_id === mission.id)
          .sort((a, b) => a.seq - b.seq);
        
        const nextStep = allStepsInMission.find(s => s.seq === step.seq + 1);

        if (nextStep) {
          setMissionSteps(prev => prev.map(s => s.id === nextStep.id ? {
            ...s,
            status: 'running',
            started_at: new Date().toISOString()
          } : s));

          const nextJob: Job = {
            id: Date.now() + 1,
            org_id: currentOrg.id,
            mission_step_id: nextStep.id,
            mission_id: mission.id,
            status: 'queued',
            attempts: 0,
            created_at: new Date().toISOString()
          };
          setJobs(prev => [...prev.filter(j => j.id !== candidateJob.id), nextJob]);
        } else {
          // Entire Mission is Done!
          setMissions(prev => prev.map(m => m.id === mission.id ? {
            ...m,
            status: 'done',
            finished_at: new Date().toISOString()
          } : m));
          setJobs(prev => prev.map(j => j.id === candidateJob.id ? { ...j, status: 'done' } : j));
        }
      }

      return true;
    } catch (err: any) {
      console.error('Worker Step Execution Error:', err);
      setJobs(prev => prev.map(j => j.id === candidateJob.id ? {
        ...j,
        status: 'failed',
        last_error: err?.message || 'Execution error'
      } : j));
      return false;
    } finally {
      setIsProcessingStep(false);
      setWorkerStatus(prev => ({
        ...prev,
        isRunning: false,
        lastTick: new Date().toISOString(),
        currentJobId: null
      }));
    }
  }, [jobs, currentOrg.id, isSpendCapped, missionSteps, missions, agents, inEffectMemory]);

  // Automatic Queue Polling (10s interval as specified in Blueprint)
  useEffect(() => {
    if (!workerStatus.autoWorkerEnabled) return;

    const interval = setInterval(() => {
      const pendingJobs = jobs.filter(j => j.org_id === currentOrg.id && j.status === 'queued');
      if (pendingJobs.length > 0 && !isProcessingStep) {
        tickWorker();
      } else {
        setWorkerStatus(prev => ({ ...prev, lastTick: new Date().toISOString() }));
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [workerStatus.autoWorkerEnabled, jobs, currentOrg.id, isProcessingStep, tickWorker]);

  const toggleAutoWorker = () => {
    setWorkerStatus(prev => ({ ...prev, autoWorkerEnabled: !prev.autoWorkerEnabled }));
  };

  const resetToSeedData = () => {
    setOrgs(INITIAL_ORGS);
    setCurrentOrgId(INITIAL_ORGS[0].id);
    setMembers(INITIAL_MEMBERS);
    setAgents(INITIAL_AGENTS);
    setPlaybooks(INITIAL_PLAYBOOKS);
    setMissions(INITIAL_MISSIONS);
    setMissionSteps(INITIAL_MISSION_STEPS);
    setApprovals(INITIAL_APPROVALS);
    setMemoryFacts(INITIAL_MEMORY_FACTS);
    setArtifacts(INITIAL_ARTIFACTS);
    setUsageEvents(INITIAL_USAGE_EVENTS);
    setJobs(INITIAL_JOBS);
    setSelectedMissionId(INITIAL_MISSIONS[0]?.id || null);
    localStorage.clear();
  };

  return (
    <TeamOSContext.Provider
      value={{
        currentOrg,
        orgs,
        members,
        switchOrg,
        createOrg,
        updateOrgCap,
        currentUser,
        agents: orgAgents,
        addAgent,
        updateAgent,
        deleteAgent,
        playbooks,
        addPlaybook,
        updatePlaybook,
        missions: orgMissions,
        missionSteps,
        selectedMissionId,
        setSelectedMissionId,
        startMission,
        cancelMission,
        approvals: orgApprovals,
        decideApproval,
        memoryFacts: orgMemoryFacts,
        inEffectMemory,
        proposedMemory,
        approveMemoryFact,
        dismissMemoryFact,
        revokeMemoryFact,
        addMemoryFact,
        artifacts: orgArtifacts,
        usageEvents: orgUsageEvents,
        monthSpendCents,
        spendPercentage,
        isSpendCapped,
        jobs: orgJobs,
        workerStatus,
        toggleAutoWorker,
        tickWorker,
        resetToSeedData,
        isProcessingStep
      }}
    >
      {children}
    </TeamOSContext.Provider>
  );
};

export const useTeamOS = () => {
  const context = useContext(TeamOSContext);
  if (!context) {
    throw new Error('useTeamOS must be used within a TeamOSProvider');
  }
  return context;
};

// Helper: Generates realistic high-density outputs adhering strictly to blueprint rules (e.g. Critic rules)
function generateStepExecutionResult(
  agent: Agent,
  step: MissionStep,
  mission: Mission,
  approvedMemory: string,
  renderedInput: string,
  priorSteps: MissionStep[]
): {
  text: string;
  tokensIn: number;
  tokensOut: number;
  requestedToolTier: number;
  approvalQuestion?: string;
  artifact?: { title: string; kind: 'doc' | 'image' | 'link' | 'file' | 'code'; body: string };
  proposedMemoryLesson?: { kind: MemoryFactKind; body: string };
} {
  const role = agent.role_label.toLowerCase();
  const stepTitle = step.title.toLowerCase();

  // Tokens calculation
  const baseTokensIn = 800 + Math.floor(renderedInput.length / 3) + (approvedMemory.length > 0 ? 300 : 0);
  const baseTokensOut = 1100 + Math.floor(Math.random() * 600);

  if (role.includes('critical') || role.includes('reviewer') || stepTitle.includes('adversarial') || stepTitle.includes('stress')) {
    // Red-team Critic Rule: Fix 10 - must provide concrete objections, no praise!
    return {
      text: `### Adversarial Red-Team Audit Report
*Reviewer: ${agent.role_label} (${agent.model})*

**Proposal Moat Resilience Score: 7.2 / 10** | **Execution Risk: HIGH**

#### 1. Unit Economic Ceiling & Margin Fragility
- **Failure Mode:** Under multi-turn reasoning loops, token cost per mission can spike past budgeted $0.35 threshold if review cycles loop >3 times.
- **Remediation:** Enforce hard recursion ceilings in the queue dispatcher and pass summarized handoff blocks rather than raw message histories.

#### 2. Enterprise Data Boundary Vulnerability
- **Failure Mode:** Compliance teams will block unvetted webhook endpoints that transmit client mission prompts through third-party SaaS workflow tools.
- **Remediation:** Strict reliance on self-hosted n8n instances isolated within customer VPCs or direct Supabase Edge Functions.

#### 3. Organizational Adoption Resistance
- **Failure Mode:** Stakeholders bypass the approval queue if notification latency exceeds 5 minutes.
- **Remediation:** Instant Slack webhooks with one-click interactive approval buttons linked directly to the Team OS queue.`,
      tokensIn: baseTokensIn,
      tokensOut: baseTokensOut,
      requestedToolTier: 0,
      proposedMemoryLesson: {
        kind: 'lesson',
        body: 'Cap autonomous review loops to a maximum of 3 iterations before escalating to a human sponsor.'
      }
    };
  }

  if (role.includes('strategy') || stepTitle.includes('strategy') || stepTitle.includes('thesis')) {
    return {
      text: `### Strategic Framework & Positioning Wedge
*Author: ${agent.role_label}*

#### 1. Core Strategic Thesis
To solve **"${mission.goal}"**, the system establishes a deterministic operational loop combining repeatable playbooks with strict authority constraints.

- **Primary Wedge:** "The Team as a Persistent Database Entity" — replacing ad-hoc generative prompts with auditable role rows and row-level tenant security.
- **Target Value Realization:** 80% reduction in research & GTM coordination lag with 100% human sign-off on strategic commitments.

#### 2. Key Execution Pillars
1. **Playbook Determinism:** Every mission executes a predictable, typed sequence with strict variable interpolation.
2. **Hardened Human Gate:** Commercial terms, contracts, and payouts are non-delegable L4 actions.
3. **Approved Memory Flywheel:** AI suggestions only enter active context upon human approval.`,
      tokensIn: baseTokensIn,
      tokensOut: baseTokensOut,
      requestedToolTier: 1,
      artifact: {
        title: `${mission.title.replace(/[^a-zA-Z0-9]/g, '_')}_Strategy_Brief.md`,
        kind: 'doc',
        body: `# Strategy Brief: ${mission.title}\n\nGoal: ${mission.goal}\n\nGenerated by ${agent.role_label} on ${new Date().toLocaleDateString()}`
      }
    };
  }

  if (role.includes('growth') || role.includes('gtm') || role.includes('marketing') || stepTitle.includes('distribution')) {
    return {
      text: `### Go-To-Market & Distribution Pipeline
*Lead: ${agent.role_label}*

#### 1. Target Account Definition & Segmentation
- **Cohort Alpha (First 20 Accounts):** Series A-C SaaS firms with 25-100 employees undergoing rapid GTM expansion.
- **High-Intent Signal:** Open job requisitions for Senior Strategic Analysts or Fractional Ops Leads.

#### 2. Multi-Touch Outbound Angle
- **Subject:** Replacing 3 analyst hires with an auditable Team OS
- **Core Value Proposition:** 30-Day fixed pilot ($7,500 - $15,000) delivering 5 verified strategy playbooks with human authority verification.
- **Call-to-Action:** 15-minute live architecture & playbook walkthrough.`,
      tokensIn: baseTokensIn,
      tokensOut: baseTokensOut,
      requestedToolTier: 2,
      artifact: {
        title: `Outbound_Campaign_Matrix.json`,
        kind: 'code',
        body: `{\n  "campaign": "Team OS Pilot Launch",\n  "target_cohort": 20,\n  "pricing_tier": "Pilot $7.5k / Team $15k",\n  "status": "Ready for Review"\n}`
      }
    };
  }

  if (role.includes('human') || step.requires_approval || agent.authority === 'human_only') {
    return {
      text: `### Executive Sign-off & Commercial Commitment Request
*Requiring Human Authority (${agent.role_label})*

The upstream team (Strategy, Reviewer, GTM) has generated the complete operational package.

**Sign-off Parameters:**
- **Mission Goal:** ${mission.goal}
- **Tool Tier Required:** L4 (Human Authority)
- **Included Scope:** Commercial pricing confirmation, target account dispatch, and production memory commitment.

Please review the prior step artifacts and select **Approve** to authorize final synthesis and delivery, **Revise** to inject custom notes, or **Reject** to abort.`,
      tokensIn: baseTokensIn,
      tokensOut: baseTokensOut,
      requestedToolTier: 4,
      approvalQuestion: `Authorize commercial launch and outreach dispatch for "${mission.title}"?`
    };
  }

  // Operations / Synthesis Lead
  return {
    text: `### Final Mission Deliverable & Memory Extraction
*Synthesizer: ${agent.role_label}*

#### 1. Mission Synthesis Summary
All upstream milestones for **"${mission.title}"** have completed with verified authority compliance.

- **Status:** Complete & Verified
- **Total Workflow Steps:** ${priorSteps.length + 1}
- **Artifacts Generated:** Strategy Brief, Risk Audit, GTM Outreach Matrix

#### 2. Extracted Organizational Knowledge
1. **Preference:** Ensure all future launch playbooks include an explicit 4-point adversarial stress test prior to GTM scripting.
2. **Decision:** Enforce non-delegable L4 human authorization for any customer-facing outbound sequence.`,
    tokensIn: baseTokensIn,
    tokensOut: baseTokensOut,
    requestedToolTier: 1,
    proposedMemoryLesson: {
      kind: 'preference',
      body: `Enforce non-delegable L4 human authorization for any external dispatch campaign associated with "${mission.title}".`
    },
    artifact: {
      title: `${mission.title.replace(/[^a-zA-Z0-9]/g, '_')}_Final_Deliverable.md`,
      kind: 'doc',
      body: `# Final Mission Deliverable: ${mission.title}\n\nCompleted successfully on ${new Date().toISOString()}`
    }
  };
}
