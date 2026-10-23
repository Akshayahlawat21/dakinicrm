import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  initialLeads,
  initialAccounts,
  initialContacts,
  initialDeals,
  initialCampaigns,
  initialTasks,
  initialEmails,
  pendingApprovals,
  aiAgentsConfig,
  automationsList
} from '../data/mockData';

const CRMContext = createContext();

export function CRMProvider({ children }) {
  // Navigation & View State
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAgentDockOpen, setIsAgentDockOpen] = useState(false);
  const [quickPreviewLead, setQuickPreviewLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(initialLeads[0]); // default Aarav Patel

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState('lead');
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Entities Data State
  const [leads, setLeads] = useState(initialLeads);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [contacts, setContacts] = useState(initialContacts);
  const [deals, setDeals] = useState(initialDeals);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [tasks, setTasks] = useState(initialTasks);
  const [emails, setEmails] = useState(initialEmails);
  const [approvals, setApprovals] = useState(pendingApprovals);
  const [agents, setAgents] = useState(aiAgentsConfig);
  const [automations, setAutomations] = useState(automationsList);

  // AI Agent Chat State
  const [agentMessages, setAgentMessages] = useState([
    {
      id: "msg-1",
      sender: "dakini",
      text: "Aarav is already converted. His score of 128 comes mostly from the website demo request. Next step: book a discovery call with Marcus Vance.",
      time: "Just now"
    }
  ]);
  const [agentThinking, setAgentThinking] = useState(false);

  // Hash-based navigation listener
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '');
      if (hash) {
        if (hash === 'lead-detail') {
          setSelectedLead(initialLeads[0]);
        }
        setCurrentTab(hash);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Keyboard shortcut listener (Ctrl+K or / for search, C for create, G then L for Leads)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actions
  const navigateTo = (tab, payload = null) => {
    setCurrentTab(tab);
    if (payload && tab === 'lead-detail') {
      setSelectedLead(payload);
    }
  };

  const addLead = (newLead) => {
    const lead = {
      ...newLead,
      id: `lead-${Date.now()}`,
      status: newLead.status || 'New',
      score: newLead.score || 75,
      lastContact: 'Just now',
      scoreBreakdown: { websiteDemo: 70, emailEngagement: 60, companyFit: 80, sourceQuality: 75 },
      timeline: [
        {
          id: `t-${Date.now()}`,
          type: 'system',
          title: 'Lead created',
          description: `Created manually and assigned to ${newLead.owner || 'Marcus Vance'}`,
          time: 'Just now'
        }
      ]
    };
    setLeads([lead, ...leads]);
  };

  const addDeal = (newDeal) => {
    const deal = {
      ...newDeal,
      id: `deal-${Date.now()}`,
      daysInStage: 0,
      priority: newDeal.priority || 'Medium',
      probability: newDeal.probability || 50
    };
    setDeals([deal, ...deals]);
  };

  const updateDealStage = (dealId, nextStage) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: nextStage, daysInStage: 0 } : d))
    );
  };

  const addContact = (newContact) => {
    setContacts([{ ...newContact, id: `con-${Date.now()}`, lastContact: 'Just now' }, ...contacts]);
  };

  const addAccount = (newAccount) => {
    setAccounts([{ ...newAccount, id: `acc-${Date.now()}`, healthScore: 90, contactsCount: 1, dealsCount: 0 }, ...accounts]);
  };

  const addTask = (title, record = 'General', priority = 'Medium') => {
    const task = {
      id: `task-${Date.now()}`,
      title,
      time: '5:00 PM',
      dueDate: 'Today',
      record,
      owner: 'Elena Rostova',
      completed: false,
      priority,
      isAiGenerated: false
    };
    setTasks([task, ...tasks]);
  };

  const toggleTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const approveItem = (id) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  const convertLead = (lead, dealName, dealAmount) => {
    // 1. Mark lead as converted
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: 'Converted' } : l))
    );
    // 2. Create account if not present
    const accExists = accounts.some((a) => a.name.toLowerCase() === lead.company.toLowerCase());
    if (!accExists) {
      addAccount({
        name: lead.company,
        industry: lead.industry || 'Logistics',
        website: `${lead.company.toLowerCase().replace(/\s+/g, '')}.com`,
        status: 'Active',
        arr: `$${dealAmount ? Number(dealAmount).toLocaleString() : '50,000'}`,
        city: 'New Delhi, India'
      });
    }
    // 3. Create contact
    addContact({
      name: lead.name,
      account: lead.company,
      title: lead.title || 'Decision Maker',
      email: lead.email,
      phone: lead.phone,
      industry: lead.industry
    });
    // 4. Create deal
    addDeal({
      name: dealName || `${lead.company} - Expansion Deal`,
      company: lead.company,
      value: dealAmount ? Number(dealAmount) : 35000,
      stage: 'Qualified',
      owner: lead.owner || 'Elena Rostova',
      closeDate: '2026-11-30'
    });
    setIsConvertModalOpen(false);
  };

  const sendAgentMessage = (text) => {
    if (!text.trim()) return;
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      time: "Just now"
    };
    setAgentMessages((prev) => [...prev, userMsg]);
    setAgentThinking(true);

    setTimeout(() => {
      let replyText = "I've reviewed the parameters. Based on past enterprise win rates and ICP signals, I recommend advancing this to executive review and scheduling a follow-up outreach with tailored pricing.";
      const lower = text.toLowerCase();
      if (lower.includes('email') || lower.includes('draft')) {
        replyText = "I've drafted a follow-up email highlighting the 34% efficiency ROI. Would you like me to send it to the approvals queue or directly push to Gmail?";
      } else if (lower.includes('why') || lower.includes('score')) {
        replyText = "Score 128 is driven by: 1) Executive VP engagement (+40pts), 2) Rapid website form submission (+35pts), and 3) Perfect alignment with our enterprise logistics tier (+53pts).";
      } else if (lower.includes('call') || lower.includes('voice')) {
        replyText = "Dialing through Dakini AI Voice Agent... Connection established with Marcus Vance's calendar for tomorrow at 2:00 PM.";
      } else if (lower.includes('pipeline') || lower.includes('forecast')) {
        replyText = "Current Q4 pipeline stands at $123,000 with a 68% weighted close confidence. Anticipating $86,000 to close before month end.";
      }

      setAgentMessages((prev) => [
        ...prev,
        {
          id: `dakini-${Date.now()}`,
          sender: "dakini",
          text: replyText,
          time: "Just now"
        }
      ]);
      setAgentThinking(false);
    }, 700);
  };

  return (
    <CRMContext.Provider
      value={{
        currentTab,
        setCurrentTab,
        navigateTo,
        sidebarCollapsed,
        setSidebarCollapsed,
        isAgentDockOpen,
        setIsAgentDockOpen,
        quickPreviewLead,
        setQuickPreviewLead,
        selectedLead,
        setSelectedLead,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isQuickCreateOpen,
        setIsQuickCreateOpen,
        quickCreateType,
        setQuickCreateType,
        isConvertModalOpen,
        setIsConvertModalOpen,
        leadToConvert,
        setLeadToConvert,
        isNotificationsOpen,
        setIsNotificationsOpen,
        leads,
        setLeads,
        addLead,
        convertLead,
        accounts,
        addAccount,
        contacts,
        addContact,
        deals,
        addDeal,
        updateDealStage,
        campaigns,
        tasks,
        addTask,
        toggleTask,
        emails,
        approvals,
        approveItem,
        agents,
        automations,
        agentMessages,
        agentThinking,
        sendAgentMessage
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}
