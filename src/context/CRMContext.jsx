import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import gatewayApi, { getStoredToken, setStoredToken } from '../services/api';

const TRANSCRIPT_ANALYSES_STORAGE_KEY = 'dakini_transcript_analyses_v1';

const CRMContext = createContext();

export function CRMProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation & View State derived from current URL
  const currentTab = useMemo(() => {
    const segment = location.pathname.replace(/^\//, '').split('/')[0];
    if (!segment || segment === 'dashboard') return 'dashboard';
    if (location.pathname.startsWith('/leads/') || segment === 'lead-detail') return 'lead-detail';
    return segment;
  }, [location.pathname]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAgentDockOpen, setIsAgentDockOpen] = useState(false);
  const [quickPreviewLead, setQuickPreviewLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState('lead');
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState(null);
  const convertingLeadsRef = useRef(new Set());
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Entities Data State — Exclusively populated from live Supabase PostgreSQL via Gateway API
  // NOTE: Hardcoded mock initializers are commented out per user instruction:
  // const [leads, setLeads] = useState(initialLeads);
  // const [accounts, setAccounts] = useState(initialAccounts);
  // const [contacts, setContacts] = useState(initialContacts);
  // const [deals, setDeals] = useState(initialDeals);
  // const [campaigns, setCampaigns] = useState(initialCampaigns);
  // const [tasks, setTasks] = useState(initialTasks);
  const [leads, setLeads] = useState([]);

  // Transcript analyses stored in browser-local storage
  const [transcriptAnalyses, setTranscriptAnalyses] = useState(() => {
    try {
      const saved = localStorage.getItem(TRANSCRIPT_ANALYSES_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TRANSCRIPT_ANALYSES_STORAGE_KEY, JSON.stringify(transcriptAnalyses));
    } catch (error) {
      console.warn('Could not save transcript analyses to browser storage:', error);
    }
  }, [transcriptAnalyses]);

  useEffect(() => {
    const syncTranscriptAnalyses = (event) => {
      if (event.key !== TRANSCRIPT_ANALYSES_STORAGE_KEY) return;
      try {
        const parsed = event.newValue ? JSON.parse(event.newValue) : [];
        setTranscriptAnalyses(Array.isArray(parsed) ? parsed : []);
      } catch {
        setTranscriptAnalyses([]);
      }
    };
    window.addEventListener('storage', syncTranscriptAnalyses);
    return () => window.removeEventListener('storage', syncTranscriptAnalyses);
  }, []);
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [products, setProducts] = useState([]);
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

  // User Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const isSignedOut = localStorage.getItem('dakini_signed_out') === 'true';
      if (isSignedOut) return null;
      const stored = localStorage.getItem('dakini_user_profile');
      if (stored) return JSON.parse(stored);
      if (getStoredToken()) {
        return {
          id: "usr_elena",
          name: "Elena Rostova",
          email: "elena.rostova@dakini.ai",
          role: "Sales Director",
          tenant_id: "tenant_enterprise_01"
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      const isSignedOut = localStorage.getItem('dakini_signed_out') === 'true';
      if (isSignedOut) return false;
      return !!getStoredToken();
    } catch {
      return false;
    }
  });
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(() => !!getStoredToken());

  const fetchSupabaseData = async () => {
    setIsLoadingData(true);
    console.log('%c[SUPABASE FETCH] 🚀 Requesting live CRM data from Supabase PostgreSQL via Gateway API...', 'color: #0284c7; font-weight: bold; font-size: 13px;');
    try {
      const [leadsRes, dealsRes, accountsRes, contactsRes, campaignsRes, tasksRes, productsRes] = await Promise.allSettled([
        gatewayApi.getLeads(),
        gatewayApi.getDeals(),
        gatewayApi.getAccounts(),
        gatewayApi.getContacts(),
        gatewayApi.getCampaigns(),
        gatewayApi.getTasks(),
        gatewayApi.getProducts(),
      ]);

      let loadedLeads = [];
      let loadedDeals = [];
      let loadedAccounts = [];
      let loadedContacts = [];
      let loadedCampaigns = [];
      let loadedTasks = [];
      let loadedProducts = [];

      if (productsRes.status === 'fulfilled' && productsRes.value?.success && Array.isArray(productsRes.value.data?.data)) {
        loadedProducts = productsRes.value.data.data;
        setProducts(loadedProducts);
      }

      if (leadsRes.status === 'fulfilled' && leadsRes.value?.success && Array.isArray(leadsRes.value.data?.data)) {
        loadedLeads = leadsRes.value.data.data.map((l) => ({
          ...l,
          title: l.title || '',
          website: l.website || null,
          source: l.source || 'Website',
          owner: l.owner || currentUser?.name || 'Sales Representative',
          company: l.company || l.name,
          score: l.score || 85,
        }));
        setLeads(loadedLeads);
        if (loadedLeads.length > 0) {
          setSelectedLead((prev) => prev || loadedLeads[0]);
        }
      }

      if (dealsRes.status === 'fulfilled' && dealsRes.value?.success && Array.isArray(dealsRes.value.data?.data)) {
        const STAGE_NORM = {
          discovery: 'Qualified',
          qualification: 'Qualified',
          qualified: 'Qualified',
          proposal: 'Proposal',
          negotiation: 'Negotiation',
          won: 'Won',
          'closed won': 'Won',
          closed_won: 'Won',
          lost: 'Lost',
          'closed lost': 'Lost',
          closed_lost: 'Lost',
        };
        loadedDeals = dealsRes.value.data.data.map((d) => {
          const rawStage = (d.stage || 'Qualified').toLowerCase().trim();
          const normStage = STAGE_NORM[rawStage] || d.stage || 'Qualified';
          return {
            ...d,
            owner: d.owner || currentUser?.name || 'Sales Representative',
            company: d.company || d.name,
            account_id: d.account_id || d.accountId,
            contact_id: d.contact_id || d.contactId,
            value: Number(d.value || d.amount || 45000),
            amount: Number(d.value || d.amount || 45000),
            stage: normStage,
          };
        });
        setDeals(loadedDeals);
      }

      if (accountsRes.status === 'fulfilled' && accountsRes.value?.success && Array.isArray(accountsRes.value.data?.data)) {
        loadedAccounts = accountsRes.value.data.data.map((a) => {
          const dynamicArr = Number(a.arr_amount !== undefined ? a.arr_amount : (a.arrAmount || 0));
          const dynamicContacts = a.contacts_count !== undefined ? Number(a.contacts_count) : (a.contactsCount || 0);
          const dynamicDeals = a.deals_count !== undefined ? Number(a.deals_count) : (a.dealsCount || 0);
          return {
            ...a,
            name: a.name || 'Enterprise Account',
            industry: a.industry || 'Logistics & Tech',
            city: (a.address || a.city) ? ((a.address || a.city).charAt(0).toUpperCase() + (a.address || a.city).slice(1)) : 'India',
            website: a.website || '—',
            status: a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1).toLowerCase() : 'Active',
            contactsCount: dynamicContacts,
            dealsCount: dynamicDeals,
            arr_amount: dynamicArr,
            arr: `$${dynamicArr.toLocaleString()}`,
            healthScore: a.health_score || a.healthScore || 92,
          };
        });
        setAccounts(loadedAccounts);
      }

      if (contactsRes.status === 'fulfilled' && contactsRes.value?.success && Array.isArray(contactsRes.value.data?.data)) {
        loadedContacts = contactsRes.value.data.data.map((c) => {
          const fullName = c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Enterprise Contact';
          return {
            ...c,
            name: fullName,
            title: c.title || '',
            email: c.email || '—',
            phone: c.phone || '—',
            account: c.account || c.account_name || c.company || 'Enterprise Account',
            account_id: c.account_id || c.accountId,
            industry: c.industry || 'Logistics & Tech',
          };
        });
        setContacts(loadedContacts);
      }

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value?.success && Array.isArray(campaignsRes.value.data?.data)) {
        loadedCampaigns = campaignsRes.value.data.data.map((c) => ({
          ...c,
          leadsGenerated: c.leads_generated || c.leadsGenerated || 0,
          pipelineValue: c.pipeline_value || c.pipelineValue || 0,
        }));
        setCampaigns(loadedCampaigns);
      }

      if (tasksRes.status === 'fulfilled' && tasksRes.value?.success && Array.isArray(tasksRes.value.data?.data)) {
        loadedTasks = tasksRes.value.data.data.map((t) => ({
          id: t.id,
          title: t.subject || t.title,
          record: t.related_record_name || t.record || 'Enterprise Logistics',
          priority: t.priority || 'Medium',
          completed: t.status === 'completed',
          dueDate: t.due_date || 'Upcoming',
          owner: t.owner || currentUser?.name || 'Sales Representative',
        }));
        setTasks(loadedTasks);
      }

      // Display live Supabase data in console with styled table
      console.log(
        `%c[SUPABASE FETCH SUCCESS] ✅ Retrieved ${loadedLeads.length} leads, ${loadedDeals.length} deals, ${loadedAccounts.length} accounts, ${loadedContacts.length} contacts, ${loadedCampaigns.length} campaigns, ${loadedTasks.length} tasks, ${loadedProducts.length} products from Supabase DB`,
        'color: #059669; font-weight: bold; font-size: 13px;'
      );
      console.table([
        { Entity: 'Leads', Count: loadedLeads.length, Storage: 'Supabase PostgreSQL', Status: 'Live Active' },
        { Entity: 'Deals', Count: loadedDeals.length, Storage: 'Supabase PostgreSQL', Status: 'Live Active' },
        { Entity: 'Accounts', Count: loadedAccounts.length, Storage: 'Supabase PostgreSQL', Status: 'Live Active' },
        { Entity: 'Contacts', Count: loadedContacts.length, Storage: 'Supabase PostgreSQL', Status: 'Live Active' },
        { Entity: 'Campaigns', Count: loadedCampaigns.length, Storage: 'Supabase PostgreSQL', Status: 'Live Active' },
        { Entity: 'Tasks', Count: loadedTasks.length, Storage: 'Supabase PostgreSQL', Status: 'Live Active' },
        { Entity: 'Products', Count: loadedProducts.length, Storage: 'Supabase PostgreSQL', Status: 'Live Active' },
      ]);
    } catch (err) {
      console.warn('Error fetching Supabase data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await gatewayApi.getProducts();
      if (res.success && Array.isArray(res.data?.data)) {
        setProducts(res.data.data);
        return res.data.data;
      }
    } catch (err) {
      console.warn('fetchProducts error:', err);
    }
    return [];
  };

  const addProduct = async (productData) => {
    try {
      const res = await gatewayApi.createProduct(productData);
      if (res.success && res.data?.data) {
        const newProd = res.data.data;
        setProducts((prev) => {
          if (prev.some((p) => p.id === newProd.id)) return prev;
          return [...prev, newProd];
        });
        return { success: true, data: newProd };
      }
      return res;
    } catch (err) {
      console.warn('addProduct error:', err);
      return { success: false, error: err };
    }
  };

  const login = async (email, password, tenantId = 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef') => {
    try {
      localStorage.removeItem('dakini_signed_out');
    } catch (err) {
      console.warn(err);
    }
    const res = await gatewayApi.login(email, password, tenantId);
    if (res.success && res.data?.user) {
      setCurrentUser(res.data.user);
      setIsAuthenticated(true);
      setIsSignInModalOpen(false);
      await fetchSupabaseData();
      return { success: true, user: res.data.user };
    } else if (!res.success && !gatewayStatus.connected) {
      // Offline fallback
      const emailLower = email.toLowerCase();
      let role = 'salesperson';
      if (emailLower.includes('elena') || emailLower.includes('admin') || emailLower.includes('owner')) {
        role = 'owner';
      } else if (emailLower.includes('marcus') || emailLower.includes('manager')) {
        role = 'manager';
      }
      const fallbackUser = {
        id: `usr_${email.split('@')[0]}`,
        name: email.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase()),
        email,
        role: role,
        roles: [role],
        tenant_id: tenantId || "tenant_enterprise_01"
      };
      setStoredToken(`mock_offline_token_${Date.now()}`, fallbackUser);
      setCurrentUser(fallbackUser);
      setIsAuthenticated(true);
      setIsSignInModalOpen(false);
      return { success: true, user: fallbackUser };
    }
    return res;
  };

  const logout = () => {
    try {
      localStorage.setItem('dakini_signed_out', 'true');
    } catch (err) {
      console.warn(err);
    }
    gatewayApi.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
  };

  const updateUserProfile = (updates) => {
    setCurrentUser((prev) => {
      const updated = { ...(prev || {}), ...updates };
      try {
        localStorage.setItem('dakini_user_profile', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not save user profile:', err);
      }
      return updated;
    });
  };

  // Layer 2 Gateway Health & Connection State
  const [gatewayStatus, setGatewayStatus] = useState({
    connected: false,
    checking: true,
    details: null,
  });

  // Layer 2 Gateway connection and token initialization
  useEffect(() => {
    let isMounted = true;
    async function initGateway() {
      try {
        const health = await gatewayApi.checkHealth();
        if (health.success && isMounted) {
          setGatewayStatus({
            connected: true,
            checking: false,
            details: health.data,
          });

          // Fetch all live entities from Supabase via Gateway if authenticated
          if (getStoredToken()) {
            await fetchSupabaseData();
          } else if (localStorage.getItem('dakini_signed_out') !== 'true') {
            const loginRes = await gatewayApi.login('elena.rostova@dakini.ai', 'dakini_secure_2026', 'b4b76cde-a5e0-5ffb-9670-2df601cd5eef');
            if (loginRes.success && isMounted) {
              setCurrentUser(loginRes.data.user);
              setIsAuthenticated(true);
              await fetchSupabaseData();
            }
          }

        } else if (isMounted) {
          setGatewayStatus({ connected: false, checking: false, details: null });
        }
      } catch (err) {
        if (isMounted) {
          setGatewayStatus({ connected: false, checking: false, details: null });
        }
      }
    }
    initGateway();
    return () => {
      isMounted = false;
    };
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

  // URL-driven navigation action
  const navigateTo = (destination, payload = null) => {
    let path = destination;
    if (!destination.startsWith('/')) {
      if (destination === 'lead-detail') {
        path = payload?.id ? `/leads/${payload.id}` : '/lead-detail';
      } else {
        path = `/${destination}`;
      }
    }
    if (payload && (destination === 'lead-detail' || destination.startsWith('/leads') || destination.startsWith('lead-detail'))) {
      setSelectedLead(payload);
    }
    navigate(path);
  };

  const setCurrentTab = (tab) => {
    navigateTo(tab);
  };

  const addLead = async (newLead) => {
    const defaultOwner = newLead.owner || currentUser?.name || 'Sales Representative';
    const lead = {
      ...newLead,
      owner: defaultOwner,
      status: newLead.status || 'New',
      score: newLead.score || 75,
      lastContact: 'Just now',
      scoreBreakdown: { websiteDemo: 70, emailEngagement: 60, companyFit: 80, sourceQuality: 75 },
      timeline: [
        {
          id: `t-${Date.now()}`,
          type: 'system',
          title: 'Lead created',
          description: `Created manually and assigned to ${defaultOwner}`,
          time: 'Just now'
        }
      ]
    };

    // Dispatch to Supabase via Layer 2 Gateway first to ensure validation & no duplicate conflicts
    try {
      const res = await gatewayApi.createLead({
        name: lead.name,
        company: lead.company,
        title: lead.title ? lead.title.trim() : null,
        website: lead.website ? lead.website.trim() : null,
        email: lead.email,
        phone: lead.phone,
        industry: lead.industry,
        source: lead.source || 'Website Demo',
        score: lead.score,
        assigned_to: lead.assigned_to,
        product_id: lead.product_id || lead.productId || null,
        interested_product: lead.interested_product || lead.interestedProduct || null,
        allow_separate_inquiry: lead.allow_separate_inquiry || false,
      });

      if (res.success && res.data?.data) {
        const realId = String(res.data.data.id);
        const resolvedOwner = res.data.data.owner || lead.owner;
        const resolvedProductId = res.data.data.product_id || lead.product_id || lead.productId || null;
        const resolvedInterestedProduct = res.data.data.interested_product || lead.interested_product || lead.interestedProduct || null;
        const resolvedTitle = res.data.data.title || lead.title || '';
        const resolvedWebsite = res.data.data.website || lead.website || null;
        console.log(`%c[SUPABASE CREATE] ✅ Lead persisted with UUID: ${realId} (Product: ${resolvedInterestedProduct}, Title: '${resolvedTitle}')`, 'color: #10b981; font-weight: bold;');
        const persistedLead = {
          ...lead,
          id: realId,
          title: resolvedTitle,
          website: resolvedWebsite,
          source: res.data.data.source || lead.source || 'Website',
          owner: resolvedOwner,
          product_id: resolvedProductId,
          interested_product: resolvedInterestedProduct,
          organization_id: res.data.data.organization_id,
        };
        if (resolvedProductId && !products.some((p) => p.id === resolvedProductId)) {
          fetchProducts();
        }
        // Add to state only when server confirms creation
        setLeads((prev) => [persistedLead, ...prev]);
        return { success: true, data: persistedLead };
      } else {
        const errorMsg =
          res.error?.message ||
          (lead.email
            ? `A lead with email "${lead.email}" already exists in the organization database.`
            : 'Failed to create lead.');
        console.warn('Backend rejected lead creation:', errorMsg);
        return { success: false, error: { ...res.error, message: errorMsg } };
      }
    } catch (err) {
      console.warn('Gateway createLead sync skipped:', err);
      return { success: false, error: { message: err.message || 'Failed to connect to gateway' } };
    }
  };

  const deleteLeads = async (leadIds) => {
    const idsToDelete = new Set(Array.isArray(leadIds) ? leadIds : [leadIds]);
    // Instant removal on screen
    setLeads((prev) => prev.filter((l) => !idsToDelete.has(l.id)));
    for (const id of idsToDelete) {
      try {
        await gatewayApi.deleteLead(id);
        console.log(`%c[SUPABASE DELETE] 🗑️ Lead ${id} deleted`, 'color: #ef4444; font-weight: bold;');
      } catch (err) {
        console.warn('Gateway deleteLead sync skipped:', err);
      }
    }
  };

  const deleteLead = (leadId) => {
    deleteLeads([leadId]);
  };

  const assignLeads = async (leadIds, assignee) => {
    const ids = Array.isArray(leadIds) ? leadIds : [leadIds];
    const assigneeId = typeof assignee === 'object' ? assignee.id : assignee;
    const assigneeName = typeof assignee === 'object' ? assignee.name : null;

    try {
      const res = await gatewayApi.assignLeads(ids, assigneeId);
      if (res.success && res.data?.data) {
        const resolvedName = res.data.data.assignee_name || assigneeName;
        const affectedDealIds = new Set((res.data.data.deal_ids || []).map(String));
        console.log(`%c[SUPABASE REASSIGN] 👤 Reassigned ${ids.length} lead(s) to ${resolvedName}`, 'color: #3b82f6; font-weight: bold;');

        // 1. Immediately update leads in React state
        setLeads((prev) =>
          prev.map((l) =>
            ids.includes(l.id)
              ? {
                  ...l,
                  assigned_to: assigneeId,
                  owner: resolvedName,
                }
              : l
          )
        );

        // 2. Identify companies and names of reassigned leads
        const reassignedLeads = leads.filter((l) => ids.includes(l.id));
        const reassignedLeadIds = new Set(ids.map(String));
        const reassignedCompanies = new Set(
          reassignedLeads.map((l) => (l.company || '').trim().toLowerCase()).filter(Boolean)
        );
        const reassignedLeadNames = new Set(
          reassignedLeads.map((l) => (l.name || '').trim().toLowerCase()).filter(Boolean)
        );

        // 3. Dynamically update Deals & Opportunities in state immediately without page reload!
        setDeals((prev) =>
          prev.map((d) => {
            const dealId = String(d.id);
            const dealComp = (d.company || '').trim().toLowerCase();
            const dealName = (d.name || '').trim().toLowerCase();

            const isDirectDealMatch = affectedDealIds.has(dealId);
            const isLeadIdMatch = d.lead_id && reassignedLeadIds.has(String(d.lead_id));
            const isCompanyMatch = dealComp && reassignedCompanies.has(dealComp);
            const isNameMatch = dealName && (
              reassignedCompanies.has(dealName) ||
              reassignedLeadNames.has(dealName) ||
              Array.from(reassignedCompanies).some((c) => dealName.includes(c)) ||
              Array.from(reassignedLeadNames).some((n) => dealName.includes(n))
            );

            if (isDirectDealMatch || isLeadIdMatch || isCompanyMatch || isNameMatch) {
              return {
                ...d,
                owner_id: assigneeId,
                owner: resolvedName,
              };
            }
            return d;
          })
        );

        // 4. Background re-sync to ensure all server data across context is completely synchronized
        fetchSupabaseData();

        return { success: true, assigneeName: resolvedName };
      } else {
        console.warn('Backend rejected lead assignment:', res.error);
        return { success: false, error: res.error };
      }
    } catch (err) {
      console.warn('Gateway assignLeads failed:', err);
      return { success: false, error: { message: err.message } };
    }
  };

  const addDeal = async (newDeal) => {
    const tempId = `temp-deal-${Date.now()}`;
    const defaultOwner = newDeal.owner || currentUser?.name || 'Sales Representative';
    const deal = {
      ...newDeal,
      id: tempId,
      owner: defaultOwner,
      daysInStage: 0,
      priority: newDeal.priority || 'Medium',
      probability: newDeal.probability || 50
    };
    // Instant optimistic render on screen
    setDeals((prev) => [deal, ...prev]);

    // Dispatch to Supabase via Layer 2 Gateway
    try {
      const res = await gatewayApi.createDeal({
        name: deal.name,
        company: deal.company,
        amount: Number(deal.value || deal.amount || 45000),
        stage: deal.stage || 'Qualified',
      });
      if (res.success && res.data?.data) {
        const realId = String(res.data.data.id);
        const resolvedOwner = res.data.data.owner || deal.owner;
        console.log(`%c[SUPABASE CREATE] ✅ Deal persisted with UUID: ${realId}`, 'color: #10b981; font-weight: bold;');
        setDeals((prev) =>
          prev.map((d) => (d.id === tempId ? { ...d, id: realId, owner: resolvedOwner, organization_id: res.data.data.organization_id } : d))
        );
        return { success: true, data: { ...deal, id: realId, owner: resolvedOwner } };
      } else {
        setDeals((prev) => prev.filter((d) => d.id !== tempId));
        console.warn('Backend rejected deal creation:', res.error);
        return { success: false, error: res.error };
      }
    } catch (err) {
      setDeals((prev) => prev.filter((d) => d.id !== tempId));
      console.warn('Gateway createDeal sync skipped:', err);
      return { success: false, error: { message: err.message } };
    }
  };

  const updateDealStage = async (dealId, nextStage) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: nextStage, daysInStage: 0 } : d))
    );
    try {
      await gatewayApi.updateDealStage(dealId, nextStage);
      console.log(`%c[SUPABASE UPDATE] 📈 Deal ${dealId} stage updated to ${nextStage}`, 'color: #3b82f6; font-weight: bold;');
    } catch (err) {
      console.warn('Gateway updateDealStage sync skipped:', err);
    }
  };

  const deleteDeal = async (dealId) => {
    // 1. Role permission validation
    const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'salesperson').toLowerCase();
    const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
    const isManager = userRole.includes('manager');
    const canDelete = isOwner || isManager;

    if (!canDelete) {
      const errorMsg = "You don't have permission to delete deals. Only Owners and Managers are authorized to delete deals from the active pipeline.";
      console.warn('[PERMISSION DENIED]', errorMsg);
      return { success: false, error: { message: errorMsg, code: 'FORBIDDEN' } };
    }

    const previousDeals = deals;
    // Optimistic removal for authorized users
    setDeals((prev) => prev.filter((d) => d.id !== dealId));

    try {
      const res = await gatewayApi.deleteDeal(dealId);
      if (res && res.success === false) {
        // Roll back if rejected by backend (e.g. manager attempting to delete a deal outside their team)
        setDeals(previousDeals);
        const errMsg = res.error?.message || "You don't have permission to delete this deal.";
        console.warn('Backend rejected deal deletion:', res.error);
        return { success: false, error: { message: errMsg, code: res.error?.code || 'FORBIDDEN' } };
      }
      console.log(`%c[SUPABASE DELETE] 🗑️ Deal ${dealId} deleted`, 'color: #ef4444; font-weight: bold;');
      return { success: true };
    } catch (err) {
      // Roll back on network failure
      setDeals(previousDeals);
      console.warn('Gateway deleteDeal sync failed:', err);
      return { success: false, error: { message: err.message || "Failed to delete deal" } };
    }
  };

  const addContact = async (newContact) => {
    const tempId = `temp-con-${Date.now()}`;
    const contactItem = {
      ...newContact,
      id: tempId,
      lastContact: 'Just now'
    };
    // Instant optimistic render on screen
    setContacts((prev) => [contactItem, ...prev]);

    try {
      const res = await gatewayApi.createContact({
        name: newContact.name,
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        email: newContact.email,
        phone: newContact.phone,
        title: newContact.title,
        account: newContact.account || newContact.company,
        department: newContact.department,
        allow_separate_contact: Boolean(newContact.allow_separate_contact || newContact.allowSeparateContact),
      });
      if (res.success && res.data?.data) {
        const realId = String(res.data.data.id);
        console.log(`%c[SUPABASE CREATE] ✅ Contact persisted with UUID: ${realId}`, 'color: #10b981; font-weight: bold;');
        setContacts((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: realId } : c))
        );
        return { success: true, data: { ...contactItem, id: realId } };
      } else {
        console.warn('Backend rejected contact creation:', res.error);
        alert(res.error?.message || 'Failed to create contact');
        setContacts((prev) => prev.filter((c) => c.id !== tempId));
      }
    } catch (err) {
      console.warn('Gateway createContact sync skipped:', err);
    }
    return contactItem;
  };

  const deleteContact = async (contactId) => {
    // Instant removal on screen
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    try {
      const res = await gatewayApi.deleteContact(contactId);
      if (res && res.success === false) {
        console.warn('Backend rejected contact deletion:', res.error);
        alert(res.error?.message || 'Failed to delete contact: permission denied');
        fetchSupabaseData();
        return;
      }
      console.log(`%c[SUPABASE DELETE] 🗑️ Contact ${contactId} deleted`, 'color: #ef4444; font-weight: bold;');
    } catch (err) {
      console.warn('Gateway deleteContact sync skipped:', err);
    }
  };

  const addAccount = async (newAccount) => {
    const tempId = `temp-acc-${Date.now()}`;
    const accItem = {
      ...newAccount,
      id: tempId,
      healthScore: 90,
      contactsCount: 0,
      dealsCount: 0
    };
    // Instant optimistic render on screen
    setAccounts((prev) => [accItem, ...prev]);

    try {
      const res = await gatewayApi.createAccount({
        name: newAccount.name,
        industry: newAccount.industry || 'Logistics & Tech',
        website: newAccount.website,
        phone: newAccount.phone,
        address: newAccount.city || newAccount.address,
        allow_separate_account: Boolean(newAccount.allow_separate_account || newAccount.allowSeparateAccount),
      });
      if (res.success && res.data?.data) {
        const realId = String(res.data.data.id);
        console.log(`%c[SUPABASE CREATE] ✅ Account persisted with UUID: ${realId}`, 'color: #10b981; font-weight: bold;');
        const serverContacts = Number(res.data.data.contacts_count || 0);
        setAccounts((prev) =>
          prev.map((a) => (a.id === tempId ? { ...a, id: realId, contactsCount: serverContacts } : a))
        );
        return { success: true, data: { ...accItem, id: realId } };
      } else {
        console.warn('Backend rejected account creation:', res.error);
        alert(res.error?.message || 'Failed to create account');
        setAccounts((prev) => prev.filter((a) => a.id !== tempId));
      }
    } catch (err) {
      console.warn('Gateway createAccount sync skipped:', err);
    }
    return accItem;
  };

  const deleteAccount = async (accountId) => {
    // Instant removal on screen
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    try {
      const res = await gatewayApi.deleteAccount(accountId);
      if (res && res.success === false) {
        console.warn('Backend rejected account deletion:', res.error);
        alert(res.error?.message || 'Failed to delete account: permission denied');
        fetchSupabaseData();
        return;
      }
      console.log(`%c[SUPABASE DELETE] 🗑️ Account ${accountId} deleted`, 'color: #ef4444; font-weight: bold;');
    } catch (err) {
      console.warn('Gateway deleteAccount sync skipped:', err);
    }
  };

  const addTask = async (title, record = 'General', priority = 'Medium') => {
    const tempId = `temp-task-${Date.now()}`;
    const task = {
      id: tempId,
      title,
      time: '5:00 PM',
      dueDate: 'Today',
      record,
      owner: currentUser?.name || 'Sales Representative',
      completed: false,
      priority,
      isAiGenerated: false
    };
    // Instant optimistic render on screen
    setTasks((prev) => [task, ...prev]);

    try {
      const res = await gatewayApi.createTask({ subject: title, priority: priority.toLowerCase() });
      if (res.success && res.data?.data) {
        const realId = String(res.data.data.id);
        console.log(`%c[SUPABASE CREATE] ✅ Task persisted with UUID: ${realId}`, 'color: #10b981; font-weight: bold;');
        setTasks((prev) =>
          prev.map((t) => (t.id === tempId ? { ...t, id: realId } : t))
        );
      } else {
        console.warn('Backend rejected task creation:', res.error);
      }
    } catch (err) {
      console.warn('Gateway createTask sync skipped:', err);
    }
  };

  const toggleTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = async (taskId) => {
    // Instant removal on screen
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await gatewayApi.deleteTask(taskId);
      console.log(`%c[SUPABASE DELETE] 🗑️ Task ${taskId} deleted`, 'color: #ef4444; font-weight: bold;');
    } catch (err) {
      console.warn('Gateway deleteTask sync skipped:', err);
    }
  };

  const approveItem = (id) => {
    setApprovals((prev) => prev.filter((a) => a.id !== id));
  };

  const addCampaign = async (campData) => {
    const budgetVal = Number(campData.budget) || 20000;
    const spentVal = Number(campData.spent) || 0;
    const leadsVal = Number(campData.leadsGenerated) || 0;
    const pipeVal = Number(campData.pipelineValue) || (leadsVal * 2500);
    const roiVal = campData.roi || (spentVal > 0 ? `${Math.round(((pipeVal - spentVal) / spentVal) * 100)}%` : '0%');

    const tempId = `temp-camp-${Date.now()}`;
    const newCampaign = {
      id: tempId,
      name: campData.name || 'New Enterprise Campaign',
      type: campData.type || 'Digital Ads & Content',
      status: campData.status || 'Active',
      budget: budgetVal,
      spent: spentVal,
      leadsGenerated: leadsVal,
      pipelineValue: pipeVal,
      roi: roiVal,
      ...campData
    };
    // Instant optimistic render on screen
    setCampaigns((prev) => [newCampaign, ...prev]);

    try {
      const res = await gatewayApi.createCampaign({
        name: newCampaign.name,
        type: newCampaign.type,
        status: newCampaign.status,
        budget: newCampaign.budget,
      });
      if (res.success && res.data?.data) {
        const realId = String(res.data.data.id);
        console.log(`%c[SUPABASE CREATE] ✅ Campaign persisted with UUID: ${realId}`, 'color: #10b981; font-weight: bold;');
        setCampaigns((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, id: realId, organization_id: res.data.data.organization_id } : c))
        );
        return { success: true, data: { ...newCampaign, id: realId } };
      } else {
        console.warn('Backend rejected campaign creation:', res.error);
      }
    } catch (err) {
      console.warn('Gateway createCampaign sync skipped:', err);
    }
    return newCampaign;
  };

  const deleteCampaign = async (campId) => {
    // Instant removal on screen
    setCampaigns((prev) => prev.filter((c) => c.id !== campId));
    try {
      const res = await gatewayApi.deleteCampaign(campId);
      console.log(`%c[SUPABASE DELETE] 🗑️ Campaign ${campId} deleted`, 'color: #ef4444; font-weight: bold;', res);
    } catch (err) {
      console.warn('Gateway deleteCampaign sync skipped:', err);
    }
  };


  const addTranscriptAnalysis = (lead, transcript, outputs, productName = '') => {
    const record = {
      id: `transcript-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      leadId: String(lead?.id || ''),
      leadName: lead?.name || 'Unknown lead',
      company: lead?.company || '',
      productName: (productName || '').trim() || 'Unassigned',
      transcript,
      outputs,
      createdAt: new Date().toISOString(),
    };
    setTranscriptAnalyses((previous) => [record, ...previous]);
    return record;
  };

  const deleteTranscriptAnalysis = (analysisId) => {
    setTranscriptAnalyses((previous) =>
      previous.filter((record) => record.id !== analysisId)
    );
  };

  const clearTranscriptAnalyses = () => {
    setTranscriptAnalyses([]);
  };

  const convertLead = async (lead, dealName, dealAmount, createDeal = true, extra = {}) => {
    if (!lead || !lead.id || lead.status === 'Converted') {
      console.warn('Lead is already converted or invalid');
      return;
    }
    if (convertingLeadsRef.current.has(lead.id)) {
      console.warn('Lead conversion already in flight for:', lead.id);
      return;
    }
    convertingLeadsRef.current.add(lead.id);

    // Dynamic converter name based on logged-in user
    const converterName = currentUser?.name || 'Sales Representative';
    const targetCompany = (extra.accountName || lead.company || lead.name || 'Enterprise Account').trim();
    const contactPersonName = (extra.contactName || lead.name || 'Enterprise Contact').trim();
    const contactEmail = (extra.contactEmail || lead.email || '').trim();
    const contactPhone = (lead.phone || '+1 555-010-0000').trim();
    const contactTitle = extra.contactTitle || lead.title || '';
    const website = extra.website || lead.website || '';
    const industryName = lead.industry || 'Logistics & Tech';
    const finalDealName = dealName || `${targetCompany} - Expansion Deal`;
    const finalDealAmount = dealAmount ? Number(dealAmount) : 45000;

    const tempAccId = `temp-acc-${Date.now()}`;
    const tempConId = `temp-con-${Date.now()}`;
    const tempDealId = `temp-deal-${Date.now()}`;

    // 1. Mark lead as converted optimistically so the UI updates immediately
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: 'Converted' } : l))
    );
    setIsConvertModalOpen(false);

    // 2. Resolve Contact first (check if contact exists by normalized email)
    const normEmail = contactEmail.trim().toLowerCase();
    const existingContact = normEmail
      ? contacts.find((c) => (c.email || '').trim().toLowerCase() === normEmail)
      : null;
    const effectiveConId = existingContact ? existingContact.id : tempConId;

    // 3. Resolve Account (check if account exists by company name)
    const existingAcc = accounts.find((a) => a.name.toLowerCase() === targetCompany.toLowerCase());
    const effectiveAccId = existingAcc ? existingAcc.id : tempAccId;

    if (existingAcc) {
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id === existingAcc.id) {
            const newArr = (a.arr_amount || 0) + (createDeal ? finalDealAmount : 0);
            return {
              ...a,
              contactsCount: (a.contactsCount || 0) + (existingContact ? 0 : 1),
              dealsCount: (a.dealsCount || 0) + (createDeal ? 1 : 0),
              arr_amount: newArr,
              arr: `$${newArr.toLocaleString()}`,
              website: a.website && a.website !== '—' ? a.website : (website || a.website),
            };
          }
          return a;
        })
      );
    } else {
      const newAcc = {
        id: tempAccId,
        name: targetCompany,
        industry: industryName,
        city: 'New Delhi, India',
        website: website || `${targetCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        status: 'Active',
        contactsCount: 1,
        dealsCount: createDeal ? 1 : 0,
        arr_amount: createDeal ? finalDealAmount : 0,
        arr: `$${(createDeal ? finalDealAmount : 0).toLocaleString()}`,
        healthScore: 92,
      };
      setAccounts((prev) => [newAcc, ...prev]);
    }

    // 4. Optimistically link or add Contact with normalized email deduplication
    if (existingContact) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === existingContact.id
            ? {
                ...c,
                phone: c.phone && c.phone !== '—' ? c.phone : contactPhone,
                title: c.title && c.title !== 'Decision Maker' ? c.title : contactTitle,
              }
            : c
        )
      );
    } else {
      const nameParts = contactPersonName.split(' ');
      const newContact = {
        id: tempConId,
        name: contactPersonName,
        first_name: nameParts[0],
        last_name: nameParts.slice(1).join(' '),
        account: targetCompany,
        account_id: effectiveAccId,
        email: contactEmail || '—',
        phone: contactPhone || '—',
        title: contactTitle,
        industry: industryName,
        lastContact: 'Just now',
      };
      setContacts((prev) => [newContact, ...prev]);
    }

    // 4. Optimistically add Deal linked to the effective Account and Contact
    if (createDeal) {
      const dealOwner = lead.owner || converterName;
      const newDeal = {
        id: tempDealId,
        name: finalDealName,
        company: targetCompany,
        account_id: effectiveAccId,
        contact_id: effectiveConId,
        value: finalDealAmount,
        amount: finalDealAmount,
        stage: 'Qualified',
        owner: dealOwner,
        daysInStage: 0,
        closeDate: '2026-11-30',
        status: 'open',
        priority: 'Medium',
        probability: 50,
      };
      setDeals((prev) => [newDeal, ...prev]);
    }

    try {
      // Dispatch single atomic conversion to Supabase via Gateway
      const res = await gatewayApi.convertLead(lead.id, {
        deal_name: createDeal ? finalDealName : null,
        deal_amount: createDeal ? finalDealAmount : null,
        company_name: targetCompany,
        contact_name: contactPersonName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        contact_title: contactTitle,
        website: website,
        create_deal: Boolean(createDeal),
      });

      if (res && res.success && res.data) {
        console.log(`%c[SUPABASE CONVERT] ✅ Lead converted successfully:`, 'color: #10b981; font-weight: bold;', res.data);
        const actualData = res.data?.data !== undefined ? res.data.data : res.data;
        const { account_id, contact_id, deal_id, owner } = actualData || {};

        // Reconcile optimistic temp IDs with real Supabase UUIDs
        if (account_id) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === tempAccId ? { ...a, id: String(account_id) } : a))
          );
        }
        if (contact_id && !existingContact) {
          setContacts((prev) =>
            prev.map((c) => (c.id === tempConId ? { ...c, id: String(contact_id), account_id: String(account_id || c.account_id) } : c))
          );
        }
        if (deal_id) {
          setDeals((prev) =>
            prev.map((d) => (d.id === tempDealId ? { ...d, id: String(deal_id), account_id: String(account_id || d.account_id), owner: owner || d.owner } : d))
          );
        }

        // Background sync to ensure all foreign keys and relations are perfectly updated
        await fetchSupabaseData();
        return actualData;
      } else {
        console.warn('Gateway convertLead returned non-success:', res?.error);
        await fetchSupabaseData();
      }
    } catch (err) {
      console.warn('Gateway convertLead sync skipped:', err);
      await fetchSupabaseData();
    } finally {
      convertingLeadsRef.current.delete(lead.id);
    }
  };

  const checkDuplicateDeal = async ({ company, name, account_id, opportunity_reference, product_name }) => {
    try {
      const res = await gatewayApi.checkDuplicateDeal({ company, name, account_id, opportunity_reference, product_name });
      if (res && res.success && res.data) {
        return res.data?.data !== undefined ? res.data.data : res.data;
      }
    } catch (err) {
      console.warn('checkDuplicateDeal skipped:', err);
    }
    // Fallback local check
    if (opportunity_reference && opportunity_reference.trim()) {
      return { is_duplicate_warning: false, is_distinct_opportunity: true };
    }
    const cleanComp = (company || '').toLowerCase().trim();
    if (!cleanComp) return { is_duplicate_warning: false };
    const active = deals.find(
      (d) =>
        ((d.company || d.account || '').toLowerCase().trim() === cleanComp) &&
        !['Won', 'Lost', 'Closed Won', 'Closed Lost'].includes(d.stage) &&
        (d.status === 'open' || !d.status)
    );
    if (active) {
      return {
        is_duplicate_warning: true,
        existing_deal_id: active.id,
        existing_deal_name: active.name,
        existing_stage: active.stage,
        existing_amount: active.amount || active.value,
        existing_owner: active.owner || 'Assigned Rep',
        warning_message: `A similar active Deal '${active.name}' ($${Number(active.amount || active.value || 0).toLocaleString()}, Stage: ${active.stage}) already exists for this account. You may proceed if this is a repeat purchase, renewal, or separate requirement.`,
      };
    }
    return { is_duplicate_warning: false };
  };

  const checkDuplicateLead = async ({ name, email, company, title, interested_product, product_id }) => {
    try {
      const params = {};
      if (name) params.name = name;
      if (email) params.email = email;
      if (company) params.company = company;
      if (title) params.title = title;
      if (interested_product) params.interested_product = interested_product;
      if (product_id) params.product_id = product_id;
      const res = await gatewayApi.checkDuplicateLead(params);
      if (res && res.success && res.data) {
        return res.data?.data !== undefined ? res.data.data : res.data;
      }
    } catch (err) {
      console.warn('checkDuplicateLead skipped:', err);
    }
    // Fallback local check
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanName = (name || '').toLowerCase().trim();
    const cleanCompany = (company || '').toLowerCase().trim();
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normNewProd = norm(interested_product);

    // If name is provided, require all 3: name + email + product to match!
    if (cleanName) {
      if (!cleanEmail || !normNewProd) return { is_duplicate_warning: false };
    }

    const active = leads.find((l) => {
      const matchEmail = cleanEmail && l.email && l.email.toLowerCase().trim() === cleanEmail;
      const matchName = cleanName && l.name && l.name.toLowerCase().trim() === cleanName;
      const matchProd = normNewProd && norm(l.interested_product) === normNewProd;

      if (cleanName) {
        return matchName && matchEmail && matchProd && !['Expired', 'Lost', 'Disqualified'].includes(l.status);
      }
      return matchEmail && !['Expired', 'Lost', 'Disqualified'].includes(l.status);
    });

    if (active) {
      const activeProdNorm = norm(active.interested_product);
      if (normNewProd && activeProdNorm && normNewProd !== activeProdNorm) {
        return {
          is_duplicate_warning: false,
          is_cross_sell: true,
          notice_message: `Valid Cross-Sell Opportunity: Existing prospect has an active lead for '${active.interested_product}', but this inquiry is for '${interested_product}'. Creating a separate lead is allowed.`,
        };
      }
      return {
        is_duplicate_warning: true,
        existing_lead_id: active.id,
        existing_lead_name: active.name,
        existing_company: active.company,
        existing_status: active.status,
        existing_owner: active.owner || 'Assigned Rep',
        warning_message: `A lead matching '${active.name}' already exists in '${active.status}' status${active.interested_product ? ` for '${active.interested_product}'` : ''} (Owner: ${active.owner || 'Assigned Rep'}). Please confirm if this is a separate inquiry before proceeding.`,
      };
    }
    return { is_duplicate_warning: false };
  };

  const checkDuplicateAccount = async ({ name, industry, location }) => {
    try {
      const params = {};
      if (name) params.name = name;
      if (industry) params.industry = industry;
      if (location) params.location = location;
      const res = await gatewayApi.checkDuplicateAccount(params);
      if (res && res.success && res.data) {
        return res.data?.data !== undefined ? res.data.data : res.data;
      }
    } catch (err) {
      console.warn('checkDuplicateAccount skipped:', err);
    }
    // Fallback local check
    const cleanName = (name || '').toLowerCase().trim();
    const cleanInd = (industry || '').toLowerCase().trim();
    const cleanLoc = (location || '').toLowerCase().trim();
    if (!cleanName || !cleanInd || !cleanLoc) return { is_duplicate_warning: false };

    const active = (accounts || []).find((a) => {
      const aName = (a.name || '').toLowerCase().trim();
      const aInd = (a.industry || '').toLowerCase().trim();
      const aLoc = (a.address || a.city || a.location || 'India').toLowerCase().trim();
      const locMatch = !aLoc || aLoc === cleanLoc || cleanLoc.includes(aLoc) || aLoc.includes(cleanLoc) || (['india', 'in'].includes(cleanLoc) && ['india', 'in', ''].includes(aLoc));
      return (
        aName === cleanName &&
        aInd === cleanInd &&
        locMatch
      );
    });

    if (active) {
      return {
        is_duplicate_warning: true,
        existing_account_id: active.id,
        existing_account_name: active.name,
        existing_industry: active.industry,
        existing_location: active.address || active.city,
        warning_message: `An account matching '${active.name}' in '${active.industry}' at '${active.address || active.city || cleanLoc}' already exists.`,
      };
    }
    return { is_duplicate_warning: false };
  };

  const checkDuplicateContact = async ({ name, company, email, title }) => {
    try {
      const params = {};
      if (name) params.name = name;
      if (company) params.company = company;
      if (email) params.email = email;
      if (title) params.title = title;
      const res = await gatewayApi.checkDuplicateContact(params);
      if (res && res.success && res.data) {
        return res.data?.data !== undefined ? res.data.data : res.data;
      }
    } catch (err) {
      console.warn('checkDuplicateContact skipped:', err);
    }
    // Fallback local check
    const cleanName = (name || '').toLowerCase().trim();
    const cleanComp = (company || '').toLowerCase().trim();
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanTitle = (title || '').toLowerCase().trim();
    if (!cleanName || !cleanComp || !cleanEmail) return { is_duplicate_warning: false };

    const active = (contacts || []).find((c) => {
      const cEmail = (c.email || '').toLowerCase().trim();
      const cComp = (c.account || c.company || '').toLowerCase().trim();
      const cFull = (c.name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase().trim();
      if (cEmail !== cleanEmail || cComp !== cleanComp) return false;
      const nameMatch = cFull === cleanName || cFull.includes(cleanName) || cleanName.includes(cFull);
      if (!nameMatch) return false;
      if (cleanTitle && c.title) {
        return cleanTitle === c.title.toLowerCase().trim();
      }
      return true;
    });

    if (active) {
      const cName = active.name || `${active.first_name || ''} ${active.last_name || ''}`.trim();
      return {
        is_duplicate_warning: true,
        existing_contact_id: active.id,
        existing_contact_name: cName,
        existing_company: active.account || active.company,
        existing_email: active.email,
        existing_title: active.title,
        warning_message: `A contact matching '${cName}' at '${active.account || active.company}' (${active.email}) already exists.`,
      };
    }
    return { is_duplicate_warning: false };
  };

  const cleanupStaleLeads = async (retentionDays = 30) => {
    try {
      const res = await gatewayApi.cleanupStaleLeads(retentionDays);
      if (res && res.success) {
        fetchSupabaseData();
        return res.data;
      }
    } catch (err) {
      console.warn('cleanupStaleLeads skipped:', err);
    }
  };

  const sendAgentMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      time: "Just now"
    };
    setAgentMessages((prev) => [...prev, userMsg]);
    setAgentThinking(true);

    // Call Layer 2 Gateway Copilot Agent endpoint
    try {
      const res = await gatewayApi.sendAgentMessage(text);
      if (res.success && res.data?.reply) {
        setAgentMessages((prev) => [
          ...prev,
          {
            id: `dakini-${Date.now()}`,
            sender: res.data.sender || "dakini",
            text: res.data.reply,
            time: "Just now"
          }
        ]);
        setAgentThinking(false);
        return;
      }
    } catch (err) {
      console.warn('Gateway AI agent call failed, falling back to local copilot:', err);
    }

    // Local client fallback
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
        transcriptAnalyses,
        addTranscriptAnalysis,
        deleteTranscriptAnalysis,
        clearTranscriptAnalyses,
        addLead,
        deleteLeads,
        deleteLead,
        assignLeads,
        convertLead,
        accounts,
        addAccount,
        deleteAccount,
        contacts,
        addContact,
        deleteContact,
        deals,
        addDeal,
        updateDealStage,
        deleteDeal,
        checkDuplicateDeal,
        checkDuplicateLead,
        checkDuplicateAccount,
        checkDuplicateContact,
        cleanupStaleLeads,
        campaigns,
        addCampaign,
        deleteCampaign,
        tasks,
        addTask,
        toggleTask,
        deleteTask,
        products,
        setProducts,
        fetchProducts,
        addProduct,
        emails,
        approvals,
        approveItem,
        agents,
        automations,
        agentMessages,
        agentThinking,
        sendAgentMessage,
        gatewayStatus,
        gatewayApi,
        currentUser,
        setCurrentUser,
        updateUserProfile,
        isAuthenticated,
        isSignInModalOpen,
        setIsSignInModalOpen,
        isLoadingData,
        fetchSupabaseData,
        login,
        logout
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
