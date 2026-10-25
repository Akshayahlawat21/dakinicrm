// ==========================================================================
// DAKINI SALES CRM — LIVE SUPABASE DATABASE CONFIGURATION
//
// NOTE: Hardcoded mock entities (leads, accounts, contacts, deals, campaigns,
// tasks) are commented out per user request. The CRM now strictly queries
// and persists to the live Supabase PostgreSQL database via Layer 2 Gateway.
// ==========================================================================

export const initialLeads = [];
export const initialAccounts = [];
export const initialContacts = [];
export const initialDeals = [];
export const initialCampaigns = [];
export const initialTasks = [];

/*
-- COMMENTED OUT HARDCODED MOCK DATA (Replaced by live Supabase PostgreSQL DB) --
export const _legacyInitialLeads = [
  {
    id: "lead-001",
    name: "Aarav Patel",
    company: "Aarav Patel Enterprises",
    title: "Head of Logistics & Supply Operations",
    industry: "Logistics",
    status: "Converted",
    score: 128,
    owner: "Marcus Vance",
    email: "aarav@swiggydelivery.in",
    phone: "+91 97112 33445",
    source: "Website Demo",
    lastContact: "Just now",
    notes: "Aarav requested a live demo for freight telematics and route optimization.",
    scoreBreakdown: {
      websiteDemo: 95,
      emailEngagement: 80,
      companyFit: 90,
      sourceQuality: 85
    },
    timeline: [
      {
        id: "t-1",
        type: "ai",
        title: "Dakini: Why this lead scored 128",
        description: "The website demo request is the strongest signal. High company employee growth and match with our core tier-1 logistics ICP.",
        time: "10 mins ago"
      },
      {
        id: "t-2",
        type: "status",
        title: "Lead converted",
        description: "Account Aarav Patel Enterprises created and linked to deals pipeline.",
        time: "2 hours ago"
      },
      {
        id: "t-3",
        type: "system",
        title: "Lead created",
        description: "Source: Website Demo form, automatically assigned to Marcus Vance.",
        time: "Yesterday, 4:15 PM"
      }
    ]
  },
  {
    id: "lead-002",
    name: "Priya Sharma",
    company: "Acme Corp",
    title: "VP of Enterprise Supply Chain",
    industry: "Manufacturing",
    status: "New",
    score: 86,
    owner: "Asha Nair",
    email: "priya@acme.io",
    phone: "+1 (555) 234-8901",
    source: "Partner Referral",
    lastContact: "2h ago",
    notes: "Evaluating replacements for legacy Salesforce deployment with AI co-pilot.",
    scoreBreakdown: {
      websiteDemo: 60,
      emailEngagement: 92,
      companyFit: 88,
      sourceQuality: 78
    },
    timeline: [
      {
        id: "t-4",
        type: "email",
        title: "Email opened by Priya",
        description: "Opened Q4 Enterprise Capability Deck and clicked pricing calculator.",
        time: "2 hours ago"
      },
      {
        id: "t-5",
        type: "call",
        title: "Discovery call logged — 14 mins",
        description: "Confirmed budget cycle opens next month. Wants security whitepaper.",
        time: "Yesterday, 2:30 PM"
      }
    ]
  },
  {
    id: "lead-003",
    name: "Rahul Khanna",
    company: "Zenith Dynamics",
    title: "Chief Technology Officer",
    industry: "Financial Services",
    status: "Contacted",
    score: 64,
    owner: "Dev Singhania",
    email: "rahul@zenith.com",
    phone: "+91 98104 77211",
    source: "Webinar",
    lastContact: "1d ago",
    notes: "Attended webinar on Autonomous Sales Agents. Interested in custom API connectors.",
    scoreBreakdown: {
      websiteDemo: 40,
      emailEngagement: 70,
      companyFit: 75,
      sourceQuality: 65
    },
    timeline: [
      {
        id: "t-6",
        type: "webinar",
        title: "Attended AI Sales Webinar",
        description: "Stayed for 48 mins, asked 2 questions during live Q&A.",
        time: "1 day ago"
      }
    ]
  },
  {
    id: "lead-004",
    name: "Neha Singhania",
    company: "Neha Singhania Enterprises",
    title: "Founder & Managing Director",
    industry: "Retail",
    status: "Qualified",
    score: 94,
    owner: "Marcus Vance",
    email: "neha@singhaniagroup.in",
    phone: "+91 99882 11002",
    source: "Outbound SDR",
    lastContact: "3h ago",
    notes: "High intent retail chain looking to integrate omnichannel WhatsApp CRM.",
    scoreBreakdown: {
      websiteDemo: 75,
      emailEngagement: 98,
      companyFit: 94,
      sourceQuality: 88
    },
    timeline: [
      {
        id: "t-7",
        type: "ai",
        title: "Dakini: Follow-up draft ready",
        description: "Dakini generated personalized omnichannel demo pitch based on retail store count.",
        time: "3 hours ago"
      }
    ]
  },
  {
    id: "lead-005",
    name: "Rajesh Venkatesh",
    company: "TVS Mobility Solutions",
    title: "VP of Digital Transformation",
    industry: "Automotive",
    status: "Qualified",
    score: 112,
    owner: "Elena Rostova",
    email: "rajesh.v@tvsmobility.com",
    phone: "+91 98401 22334",
    source: "Direct Inbound",
    lastContact: "4h ago",
    notes: "Looking to deploy 500 sales rep seats for connected commercial vehicle division.",
    scoreBreakdown: {
      websiteDemo: 90,
      emailEngagement: 85,
      companyFit: 98,
      sourceQuality: 92
    },
    timeline: [
      {
        id: "t-8",
        type: "call",
        title: "Intro call completed",
        description: "Scheduled executive architecture review with technical solutions team.",
        time: "4 hours ago"
      }
    ]
  },
  {
    id: "lead-006",
    name: "Vikram Mehta",
    company: "Titan Eyewear Omni",
    title: "Head of Omnichannel Experience",
    industry: "Retail",
    status: "New",
    score: 72,
    owner: "Asha Nair",
    email: "vikram@titan.co.in",
    phone: "+91 98765 43210",
    source: "Website Demo",
    lastContact: "2d ago",
    notes: "Needs multi-store inventory sync with real-time customer messaging.",
    scoreBreakdown: {
      websiteDemo: 80,
      emailEngagement: 60,
      companyFit: 70,
      sourceQuality: 75
    },
    timeline: [
      {
        id: "t-9",
        type: "system",
        title: "Website Demo Form",
        description: "Requested consultation on omni-channel customer loyalty tracking.",
        time: "2 days ago"
      }
    ]
  }
];

export const initialAccounts = [
  {
    id: "acc-001",
    name: "Neha Singhania Enterprises",
    industry: "Retail",
    website: "singhaniagroup.in",
    status: "Active",
    contactsCount: 2,
    dealsCount: 1,
    arr: "$45,000",
    city: "Mumbai, India",
    healthScore: 92
  },
  {
    id: "acc-002",
    name: "Aarav Patel Enterprises",
    industry: "Logistics",
    website: "swiggydelivery.in",
    status: "Active",
    contactsCount: 1,
    dealsCount: 1,
    arr: "$85,000",
    city: "Bengaluru, India",
    healthScore: 96
  },
  {
    id: "acc-003",
    name: "Accenture Digital",
    industry: "Technology",
    website: "accenture.com",
    status: "Active",
    contactsCount: 3,
    dealsCount: 1,
    arr: "$120,000",
    city: "New York, USA",
    healthScore: 88
  },
  {
    id: "acc-004",
    name: "Karan Nair Enterprises",
    industry: "Financial Services",
    website: "nairholdings.com",
    status: "Active",
    contactsCount: 1,
    dealsCount: 0,
    arr: "$60,000",
    city: "Singapore",
    healthScore: 84
  },
  {
    id: "acc-005",
    name: "TVS Mobility Solutions",
    industry: "Automotive",
    website: "tvsmobility.com",
    status: "Active",
    contactsCount: 2,
    dealsCount: 1,
    arr: "$150,000",
    city: "Chennai, India",
    healthScore: 95
  },
  {
    id: "acc-006",
    name: "Titan Eyewear Omni",
    industry: "Retail",
    website: "titan.co.in",
    status: "Prospect",
    contactsCount: 1,
    dealsCount: 1,
    arr: "$30,000",
    city: "Bengaluru, India",
    healthScore: 70
  },
  {
    id: "acc-007",
    name: "HDFC Securities Digital",
    industry: "Financial Services",
    website: "hdfcsec.com",
    status: "Active",
    contactsCount: 4,
    dealsCount: 1,
    arr: "$210,000",
    city: "Mumbai, India",
    healthScore: 98
  },
  {
    id: "acc-008",
    name: "Zomato HyperPure Ltd",
    industry: "Logistics & Food",
    website: "hyperpure.com",
    status: "Active",
    contactsCount: 2,
    dealsCount: 1,
    arr: "$180,000",
    city: "Gurugram, India",
    healthScore: 94
  }
];

export const initialContacts = [
  {
    id: "con-001",
    name: "Rajesh Venkatesh",
    account: "TVS Mobility Solutions",
    title: "VP of Digital Transformation",
    email: "rajesh.v@tvsmobility.com",
    phone: "+91 98401 22334",
    industry: "Technology",
    lastContact: "4h ago"
  },
  {
    id: "con-002",
    name: "Aarav Patel",
    account: "Aarav Patel Enterprises",
    title: "Head of Logistics & Supply",
    email: "aarav@swiggydelivery.in",
    phone: "+91 97112 33445",
    industry: "Logistics",
    lastContact: "Just now"
  },
  {
    id: "con-003",
    name: "Priya Sharma",
    account: "Acme Corp",
    title: "VP of Enterprise Supply Chain",
    email: "priya@acme.io",
    phone: "+1 (555) 234-8901",
    industry: "Manufacturing",
    lastContact: "2h ago"
  },
  {
    id: "con-004",
    name: "Neha Singhania",
    account: "Neha Singhania Enterprises",
    title: "Founder & CEO",
    email: "neha@singhaniagroup.in",
    phone: "+91 99882 11002",
    industry: "Retail",
    lastContact: "3h ago"
  },
  {
    id: "con-005",
    name: "Rahul Khanna",
    account: "Zenith Dynamics",
    title: "Chief Technology Officer",
    email: "rahul@zenith.com",
    phone: "+91 98104 77211",
    industry: "Financial Services",
    lastContact: "1d ago"
  }
];

export const initialDeals = [
  {
    id: "deal-001",
    name: "Acme Global Cloud Migration",
    company: "Acme Corp",
    value: 25500,
    stage: "Won",
    probability: 100,
    owner: "Elena Rostova",
    daysInStage: 2,
    closeDate: "2026-10-08",
    priority: "High"
  },
  {
    id: "deal-002",
    name: "HyperPure Fleet Route AI",
    company: "Zomato HyperPure Ltd",
    value: 48000,
    stage: "Proposal",
    probability: 65,
    owner: "Alex Rivera",
    daysInStage: 3,
    closeDate: "2026-11-15",
    priority: "High"
  },
  {
    id: "deal-003",
    name: "TVS Connected Dealer Portal",
    company: "TVS Mobility Solutions",
    value: 38000,
    stage: "Negotiation",
    probability: 80,
    owner: "Marcus Vance",
    daysInStage: 5,
    closeDate: "2026-10-30",
    priority: "High"
  },
  {
    id: "deal-004",
    name: "Zenith Core Financial Automation",
    company: "Zenith Dynamics",
    value: 22000,
    stage: "Qualified",
    probability: 40,
    owner: "Dev Singhania",
    daysInStage: 7, // triggers amber stuck warning
    closeDate: "2026-11-20",
    priority: "Medium"
  },
  {
    id: "deal-005",
    name: "Titan Omnichannel Store CRM",
    company: "Titan Eyewear Omni",
    value: 15000,
    stage: "Qualified",
    probability: 35,
    owner: "Elena Rostova",
    daysInStage: 4,
    closeDate: "2026-12-05",
    priority: "Medium"
  }
];

export const initialCampaigns = [
  {
    id: "camp-001",
    name: "Q4 Enterprise Logistics Roadshow",
    type: "Roadshow & In-Person",
    status: "Active",
    budget: 25000,
    spent: 18400,
    leadsGenerated: 84,
    pipelineValue: 160000,
    roi: "340%"
  },
  {
    id: "camp-002",
    name: "Autonomous Sales Agents Webinar Series",
    type: "Webinar",
    status: "Completed",
    budget: 12000,
    spent: 12000,
    leadsGenerated: 164,
    pipelineValue: 240000,
    roi: "490%"
  },
  {
    id: "camp-003",
    name: "FinTech Omnichannel Inbound 2026",
    type: "Digital Ads & Content",
    status: "Active",
    budget: 18000,
    spent: 9200,
    leadsGenerated: 52,
    pipelineValue: 95000,
    roi: "280%"
  }
];

export const initialTasks = [
  {
    id: "task-001",
    title: "Call Rahul K. regarding security compliance quote",
    time: "10:00 AM",
    dueDate: "Today",
    record: "Zenith Dynamics",
    owner: "Dev Singhania",
    completed: false,
    priority: "High",
    isAiGenerated: true
  },
  {
    id: "task-002",
    title: "Send final quote & Master Services Agreement to Aarav Patel",
    time: "12:30 PM",
    dueDate: "Today",
    record: "Aarav Patel Enterprises",
    owner: "Marcus Vance",
    completed: true,
    priority: "High",
    isAiGenerated: false
  },
  {
    id: "task-003",
    title: "Follow up with TVS Mobility on legal procurement review",
    time: "3:00 PM",
    dueDate: "Tomorrow",
    record: "TVS Mobility Solutions",
    owner: "Elena Rostova",
    completed: false,
    priority: "Medium",
    isAiGenerated: false
  },
  {
    id: "task-004",
    title: "Review NDA & SOC2 vendor assessment for HDFC Securities",
    time: "Overdue",
    dueDate: "Yesterday",
    record: "HDFC Securities Digital",
    owner: "Elena Rostova",
    completed: false,
    priority: "Urgent",
    isAiGenerated: false
  }
];
*/

export const initialEmails = [
  {
    id: "email-001",
    from: "Priya Sharma <priya@acme.io>",
    subject: "Re: Acme Enterprise Cloud Migration Proposal & Terms",
    date: "11:42 AM",
    snippet: "Hi Elena, our procurement team reviewed the revised SaaS agreement. We are ready to sign...",
    folder: "inbox",
    unread: true,
    linkedRecord: { type: "Lead", name: "Priya Sharma", company: "Acme Corp" },
    body: `Hi Elena,

Our leadership committee reviewed the revised Dakini AI CRM agreement yesterday afternoon.
We are impressed by the autonomous lead scoring engine and the seamless integration with our warehouse ERP.

Could you provide the final signature package on DocuSign by tomorrow? We intend to kick off implementation in early November.

Best regards,
Priya Sharma
VP of Enterprise Supply Chain | Acme Corp`
  },
  {
    id: "email-002",
    from: "Rajesh Venkatesh <rajesh.v@tvsmobility.com>",
    subject: "Security architecture clarification regarding on-prem connectors",
    date: "Yesterday",
    snippet: "Hello Marcus, our infosec team needs confirmation on end-to-end data residency...",
    folder: "inbox",
    unread: false,
    linkedRecord: { type: "Contact", name: "Rajesh Venkatesh", company: "TVS Mobility Solutions" },
    body: `Marcus,

Our security director reviewed your SOC2 Type II compliance pack.
Can we confirm if telemetry logs stay within India AWS regions? If yes, we can approve the pilot scope this week.

Regards,
Rajesh`
  },
  {
    id: "email-003",
    from: "Rahul Khanna <rahul@zenith.com>",
    subject: "Webinar follow-up & API sandbox credentials",
    date: "Oct 9",
    snippet: "Thanks for hosting the autonomous agents session. I would love to test the sandbox...",
    folder: "inbox",
    unread: false,
    linkedRecord: { type: "Lead", name: "Rahul Khanna", company: "Zenith Dynamics" },
    body: `Hi Dev,

Great session on Tuesday. Please forward sandbox API keys so my team can run a test on our webhook endpoints.

Thanks,
Rahul`
  }
];

export const teamPerformance = [
  {
    id: "rep-1",
    name: "Alex Rivera",
    target: 30000,
    won: 3,
    pipeline: 48000,
    progress: 45
  },
  {
    id: "rep-2",
    name: "Elena Rostova",
    target: 75000,
    won: 5,
    pipeline: 75000,
    progress: 78
  },
  {
    id: "rep-3",
    name: "Marcus Vance",
    target: 45000,
    won: 4,
    pipeline: 38000,
    progress: 62
  }
];

export const pendingApprovals = [
  {
    id: "appr-1",
    title: "Follow-up draft ready",
    entity: "Zomato HyperPure Ltd",
    entityType: "Account",
    email: "rohit@hyperpure.com",
    preview: "Hi Rohit, following up on your fleet routing telematics inquiry with the updated price matrix...",
    agent: "Outreach Copilot"
  },
  {
    id: "appr-2",
    title: "Lead scored & enriched",
    entity: "Neha Singhania",
    entityType: "Lead",
    email: "neha@singhaniagroup.in",
    preview: "AI assigned score 94 (+28pts) based on retail footfall data and multi-city store expansion.",
    agent: "Lead Qualifier Agent"
  }
];

export const aiAgentsConfig = [
  {
    id: "agent-1",
    name: "Lead Qualifier Agent",
    status: "Active",
    tasksThisWeek: 142,
    approvalMode: "Autonomous",
    role: "Evaluates inbound demo requests, enriches company headcount, and calculates ICP score.",
    lastAction: "Scored Aarav Patel (128 pts) via Web Form telemetry"
  },
  {
    id: "agent-2",
    name: "Follow-up Outreach Writer",
    status: "Active",
    tasksThisWeek: 89,
    approvalMode: "Requires Approval",
    role: "Drafts tailored executive emails following discovery calls, quoting relevant ROI metrics.",
    lastAction: "Prepared draft for Zomato HyperPure Ltd (Waiting for approval)"
  },
  {
    id: "agent-3",
    name: "Data Enricher",
    status: "Active",
    tasksThisWeek: 88,
    approvalMode: "Autonomous",
    role: "Monitors LinkedIn, filings, and tech stacks to keep account intelligence up to date.",
    lastAction: "Enriched TVS Mobility Solutions tech stack (Added Kafka, SAP ERP)"
  },
  {
    id: "agent-4",
    name: "Pipeline Chaser & Meeting Prep",
    status: "Paused",
    tasksThisWeek: 31,
    approvalMode: "Requires Approval",
    role: "Flags deals stuck in stage for >5 days and suggests deal acceleration sequences.",
    lastAction: "Alerted on Zenith Dynamics deal stuck for 7 days"
  }
];

export const automationsList = [
  {
    id: "auto-1",
    name: "Autonomous High-Intent Lead Routing",
    trigger: "When a lead score is calculated > 80",
    condition: "Company size > 50 employees OR Industry is Logistics",
    action: "Assign to Senior Enterprise AE + Notify Slack #sales-wins",
    status: true,
    runsCount: 428,
    lastRun: "12 mins ago"
  },
  {
    id: "auto-2",
    name: "Stuck Pipeline Deal Escrow Alert",
    trigger: "When deal remains in stage for > 5 business days",
    condition: "Deal value > $20,000",
    action: "Send Dakini acceleration brief to Deal Owner + Flag amber on board",
    status: true,
    runsCount: 96,
    lastRun: "2 hours ago"
  },
  {
    id: "auto-3",
    name: "Webinar Attendee AI Nurture Sequence",
    trigger: "New registrant completed webinar",
    condition: "Attended time > 30 minutes",
    action: "Generate personalized summary recap & invite to 1:1 workshop",
    status: false,
    runsCount: 164,
    lastRun: "3 days ago"
  }
];
