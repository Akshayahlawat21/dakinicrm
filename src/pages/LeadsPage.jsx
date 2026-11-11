import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { gatewayApi } from '../services/api';
import LoadingSymbol from '../components/common/LoadingSymbol';
import AssignOwnerModal from '../components/modals/AssignOwnerModal';
import { matchesLeadFilters } from '../utils/dealAnalyticsFilters';
import { fetchAllPaginatedLeads } from '../utils/fetchAllPaginatedLeads';
import {
  Plus,
  Filter,
  Download,
  Upload,
  Search,
  List,
  Kanban,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Check,
  Trash2,
  Mail,
  UserPlus,
  Eye,
  ArrowRight
} from 'lucide-react';

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function downloadAuditCsv(audit) {
  if (!audit || !audit.error_sample) return;
  const headers = ['Row Number', 'Lead Name', 'Email / Contact', 'Category', 'Diagnostic Reason'];
  const rows = audit.error_sample.map((item) => {
    const isDup = item.is_duplicate || (item.error || '').toLowerCase().includes('duplicate');
    const category = item.allowed ? 'Allowed Duplicate (Imported)' : isDup ? 'Skipped Duplicate' : 'Validation Error';
    const contact = item.email || item.phone || '';
    const cleanReason = `"${(item.error || '').replace(/"/g, '""')}"`;
    const cleanName = `"${(item.name || '').replace(/"/g, '""')}"`;
    return [item.row || '', cleanName, contact, category, cleanReason].join(',');
  });
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `import_diagnostics_${audit.file_name || 'leads'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function LeadsPage() {
  const {
    leads,
    campaigns,
    products,
    setLeads,
    totalLeadsCount,
    fetchLeadsPage,
    deleteLeads,
    navigateTo,
    setSelectedLead,
    setLeadToConvert,
    setIsConvertModalOpen,
    setIsQuickCreateOpen,
    setQuickCreateType,
    quickPreviewLead,
    setQuickPreviewLead,
    isLoadingData,
    currentUser,
    isAgentDockOpen,
    fetchSupabaseData,
  } = useCRM();

  const [dashboardFilterContext, setDashboardFilterContext] = useState(() => {
    try {
      const raw = sessionStorage.getItem('dakini_dashboard_lead_filter');
      if (!raw) return null;
      sessionStorage.removeItem('dakini_dashboard_lead_filter');
      return JSON.parse(raw);
    } catch { return null; }
  });
  const [dashboardLeads, setDashboardLeads] = useState(null);
  const [dashboardLeadLoading, setDashboardLeadLoading] = useState(false);
  const [dashboardLeadError, setDashboardLeadError] = useState('');
  const [leadPage, setLeadPage] = useState(0);
  const LEADS_PAGE_SIZE = 100;

  useEffect(() => {
    if (!dashboardFilterContext) return undefined;
    let cancelled = false;
    const loadDashboardLeads = async () => {
      setDashboardLeads([]);
      setDashboardLeadLoading(true);
      setDashboardLeadError('');
      try {
        // Fetch all current-user-visible DB rows in bounded parallel pages.
        const allRows = await fetchAllPaginatedLeads((params) => gatewayApi.getLeads(params), { pageSize: 100, concurrency: 4 });
        const normalized = allRows.map((lead) => ({
          ...lead,
          title: lead.title || '',
          website: lead.website || null,
          source: lead.source || 'Website',
          owner: lead.owner || currentUser?.name || 'Sales Representative',
          company: lead.company || lead.name || '',
          score: Number(lead.score) || 0
        }));
        const selected = normalized.filter((lead) => matchesLeadFilters(lead, {
          campaignId: dashboardFilterContext.campaignId || 'all',
          productId: dashboardFilterContext.productId || 'all',
          dateRange: dashboardFilterContext.dateRange || 'month',
          campaigns: campaigns || [],
          products: products || []
        }));
        if (!cancelled) {
          setDashboardLeads(selected);
          setLeadPage(0);
        }
      } catch (error) {
        if (!cancelled) setDashboardLeadError(error instanceof Error ? error.message : 'Unable to load dashboard leads.');
      } finally {
        if (!cancelled) setDashboardLeadLoading(false);
      }
    };
    loadDashboardLeads();
    return () => { cancelled = true; };
  }, [dashboardFilterContext, campaigns, products, currentUser?.name]);

  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [isAssignOwnerOpen, setIsAssignOwnerOpen] = useState(false);
  const [leadIdToAssign, setLeadIdToAssign] = useState(null);
  const [importNotification, setImportNotification] = useState(null);
  const [importAuditReport, setImportAuditReport] = useState(null);
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [auditFilterTab, setAuditFilterTab] = useState('all'); // 'all' | 'duplicates' | 'errors'
  const [visibleIssuesCount, setVisibleIssuesCount] = useState(100);
  const [importHistory, setImportHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [drawerMode, setDrawerMode] = useState('details'); // 'details' | 'history'
  const [selectedDuplicateRows, setSelectedDuplicateRows] = useState(() => new Set());
  const [isAllowingDuplicates, setIsAllowingDuplicates] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const fileInputRef = useRef(null);

  // Fetch paginated leads whenever page, pageSize, statusFilter or searchQuery changes (with 250ms debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof fetchLeadsPage === 'function') {
        const apiStatus = statusFilter !== 'All' ? statusFilter : null;
        fetchLeadsPage(page, pageSize, apiStatus, searchQuery);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [page, pageSize, statusFilter, searchQuery]);

  const totalEffectiveCount = totalLeadsCount || leads.length;
  const totalPages = Math.ceil(totalEffectiveCount / pageSize) || 1;

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'salesperson').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');

  const fetchImportHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await gatewayApi.getLeadImportHistory();
      if (res.success && res.data?.data) {
        setImportHistory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load import history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchImportHistory();
  }, [currentUser]);

  const pendingDuplicateItems = useMemo(() => {
    if (!importAuditReport?.error_sample) return [];
    return importAuditReport.error_sample.filter((item) => {
      const isDup = item.is_duplicate || (item.error || '').toLowerCase().includes('duplicate');
      return isDup && !item.allowed && item.lead_data;
    });
  }, [importAuditReport]);

  const handleToggleDuplicateRow = (rowNum) => {
    setSelectedDuplicateRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) {
        next.delete(rowNum);
      } else {
        next.add(rowNum);
      }
      return next;
    });
  };

  const handleSelectAllDuplicates = (checked) => {
    if (checked) {
      setSelectedDuplicateRows(new Set(pendingDuplicateItems.map((d) => d.row)));
    } else {
      setSelectedDuplicateRows(new Set());
    }
  };

  const handleAllowSelectedDuplicates = async () => {
    if (!importAuditReport?.batch_id || selectedDuplicateRows.size === 0 || isAllowingDuplicates) return;
    setIsAllowingDuplicates(true);
    try {
      const allowAll = selectedDuplicateRows.size === pendingDuplicateItems.length;
      const rowNumbers = allowAll ? [] : Array.from(selectedDuplicateRows);
      const res = await gatewayApi.allowImportDuplicates(importAuditReport.batch_id, {
        rowNumbers,
        allowAll,
      });

      if (res.success && res.data?.data) {
        const updatedBatch = res.data.data;
        setImportAuditReport(updatedBatch);
        const addedCount = updatedBatch.newly_inserted || selectedDuplicateRows.size;
        setSelectedDuplicateRows(new Set());
        setImportNotification({
          type: 'success',
          message: `Successfully allowed & imported ${addedCount.toLocaleString()} duplicate lead(s) into CRM.`,
          hasDiagnostics: true,
        });
        fetchImportHistory();
        if (typeof fetchSupabaseData === 'function') {
          await fetchSupabaseData();
        }
        if (typeof fetchLeadsPage === 'function') {
          const apiStatus = statusFilter !== 'All' ? statusFilter : null;
          await fetchLeadsPage(page, pageSize, apiStatus, searchQuery);
        }
      } else {
        const errorMsg = res.error?.message || res.data?.message || 'Failed to allow selected duplicates';
        setImportNotification({
          type: 'error',
          message: `Duplicate override error: ${errorMsg}`,
          hasDiagnostics: true,
        });
      }
    } catch (err) {
      setImportNotification({
        type: 'error',
        message: `Duplicate override error: ${err.message}`,
        hasDiagnostics: true,
      });
    } finally {
      setIsAllowingDuplicates(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so user can pick same file name if needed
    e.target.value = '';

    setImportNotification({
      type: 'loading',
      message: `⏳ Processing bulk import for ${file.name}...`,
      hasDiagnostics: false,
    });

    try {
      const res = await gatewayApi.bulkImportLeads(file);
      if (res.success && res.data?.data) {
        const d = res.data.data;
        setImportAuditReport(d);
        setSelectedDuplicateRows(new Set());
        setDrawerMode('details');
        const hasDiagnostics = (d.duplicate_count > 0 || d.error_count > 0 || (d.error_sample && d.error_sample.length > 0));
        setImportNotification({
          type: 'success',
          message: `Successfully imported ${d.inserted_count} leads (${d.duplicate_count} duplicates skipped, ${d.error_count} errors logged)`,
          hasDiagnostics,
        });

        // Automatically open the diagnostics drawer so user sees what succeeded, skipped, and errored!
        setIsImportDrawerOpen(true);
        fetchImportHistory();

        // Instantly reload leads from live Supabase DB
        if (typeof fetchSupabaseData === 'function') {
          await fetchSupabaseData();
        }
      } else {
        const errorMsg = res.error?.message || res.data?.message || 'Bulk import failed';
        setImportNotification({
          type: 'error',
          message: `Import error: ${errorMsg}`,
          hasDiagnostics: false,
        });
      }
    } catch (err) {
      setImportNotification({
        type: 'error',
        message: `Import error: ${err.message}`,
        hasDiagnostics: false,
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedLeadIds.length === 0) return;
    deleteLeads(selectedLeadIds);
    setSelectedLeadIds([]);
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    const sourceLeads = dashboardLeads || leads;
    return sourceLeads.filter((l) => {
      const matchSearch =
        (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.owner || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'All' ? true : l.status === statusFilter;

      if (activeTab === 'My leads') {
        const myName = (currentUser?.name || '').toLowerCase();
        const myFirst = myName.split(' ')[0] || '';
        const ownerLower = (l.owner || '').toLowerCase();
        const isMine = myName ? (ownerLower.includes(myName) || (myFirst && ownerLower.includes(myFirst))) : true;
        return matchSearch && matchStatus && isMine;
      }
      if (activeTab === 'New') return matchSearch && matchStatus && l.status === 'New';
      if (activeTab === 'Hot') return matchSearch && matchStatus && l.score >= 90;
      if (activeTab === 'Converted') return matchSearch && matchStatus && l.status === 'Converted';

      return matchSearch && matchStatus;
    });
  }, [leads, dashboardLeads, searchQuery, statusFilter, activeTab, currentUser]);

  const visibleLeads = useMemo(() => {
    const start = leadPage * LEADS_PAGE_SIZE;
    return filteredLeads.slice(start, start + LEADS_PAGE_SIZE);
  }, [filteredLeads, leadPage]);

  useEffect(() => { setLeadPage(0); }, [searchQuery, statusFilter, activeTab]);

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeadIds(visibleLeads.map((l) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const toggleSelectOne = (id) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter((item) => item !== id));
    } else {
      setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  const openLeadDetail = (lead) => {
    setSelectedLead(lead);
    navigateTo('lead-detail', lead);
  };

  const handleRowClick = (lead) => {
    setQuickPreviewLead(lead);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {dashboardFilterContext && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', marginBottom: 14, border: '1px solid #bfdbfe', borderRadius: 10, background: '#eff6ff', color: '#1e40af', fontSize: 13 }}>
          <span>{dashboardLeadLoading ? 'Loading matching leads from the database…' : dashboardLeadError || `Showing ${dashboardLeads?.length ?? 0} database records matching Dashboard filters`}</span>
          <button type="button" onClick={() => { setDashboardFilterContext(null); setDashboardLeads(null); setDashboardLeadError(''); setLeadPage(0); }} style={{ border: 0, background: 'transparent', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer' }}>Clear filter</button>
        </div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Leads
            </h1>
            <span className="badge badge-blue">
              {totalEffectiveCount.toLocaleString()} total
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Track, score and convert prospective accounts into pipeline revenue
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* View switcher */}
          <div style={{ display: 'flex', background: 'var(--surface-alt)', borderRadius: 8, padding: 3, border: '1px solid var(--border-default)' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: 700,
                background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <List size={14} />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: 700,
                background: viewMode === 'board' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'board' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'board' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Kanban size={14} />
              <span>Board</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".csv,.json,.txt"
            onChange={handleFileUpload}
          />

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchImportHistory();
              setDrawerMode(importAuditReport ? 'details' : 'history');
              setIsImportDrawerOpen(true);
            }}
            title="Open audit logs and persistent history of bulk lead imports"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              borderColor: 'var(--success-border)',
              background: 'var(--success-bg)',
              color: 'var(--success-text-dark)',
            }}
          >
            <span>📊 Import History</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleImportClick} title="Import leads from CSV or JSON file">
            <Upload size={14} />
            <span>Import</span>
          </button>

          <button
            className="btn btn-primary"
            onClick={() => {
              setQuickCreateType('lead');
              setIsQuickCreateOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="tab-group">
        {['All', 'My leads', 'New', 'Hot', 'Converted'].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            <span className="tab-count-pill">
              {tab === 'All' ? totalEffectiveCount.toLocaleString() : leads.filter((l) => tab === 'Hot' ? l.score >= 90 : l.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 280 }}>
          <div className="search-bar-wrapper" style={{ flex: 1 }}>
            <Search size={16} className="search-icon-inside" />
            <input
              type="text"
              placeholder="Search leads by name, company, or owner..."
              className="search-input"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Qualified">Qualified</option>
            <option value="Converted">Converted</option>
          </select>
        </div>

        {(searchQuery || statusFilter !== 'All') && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setPage(1);
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Import Notification Toast */}
      {importNotification && (
        <div
          style={{
            padding: '0.65rem 1rem',
            background: importNotification.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
            border: `1px solid ${importNotification.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`,
            borderRadius: 8,
            color: importNotification.type === 'error' ? 'var(--danger-text-dark)' : 'var(--success-text-dark)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1 }}>
            <span>{importNotification.type === 'error' ? '⚠️' : importNotification.type === 'loading' ? '⏳' : '✓'}</span>
            <span>{typeof importNotification === 'string' ? importNotification : importNotification.message}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {importNotification?.hasDiagnostics && (
              <button
                onClick={() => setIsImportDrawerOpen(true)}
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>🔍 View Log & Details</span>
              </button>
            )}
            <button
              onClick={() => setImportNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: importNotification.type === 'error' ? 'var(--danger-text-dark)' : 'var(--success-text-dark)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar (When rows selected) */}
      {selectedLeadIds.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
          color: '#ffffff',
          padding: '0.65rem 1.25rem',
          borderRadius: 10,
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <span>{selectedLeadIds.length} leads selected</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => {
                setLeadIdToAssign(null);
                setIsAssignOwnerOpen(true);
              }}
              title="Assign selected leads to a team member"
            >
              <UserCheck size={13} />
              <span>Assign Owner</span>
            </button>
            <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
              <Mail size={13} />
              Send Outreach
            </button>
            <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff', border: 'none' }}>
              <Sparkles size={13} />
              Dakini AI Enrich
            </button>
            <button
              className="btn btn-sm"
              style={{ background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
              onClick={handleDeleteSelected}
              title="Delete selected leads"
            >
              <Trash2 size={13} />
              <span>Delete ({selectedLeadIds.length})</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', cursor: 'pointer' }}
              onClick={() => setSelectedLeadIds([])}
              title="Clear selection checkboxes"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoadingData && leads.length === 0 ? (
        <LoadingSymbol message="" />
      ) : (
        <>
          {/* Content Area: Table or Board */}
          {viewMode === 'list' ? (
            <div className="crm-table-container">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={visibleLeads.length > 0 && visibleLeads.every((lead) => selectedLeadIds.includes(lead.id))}
                    onChange={toggleSelectAll}
                    style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                </th>
                <th>Name & Title</th>
                <th>Interested Product</th>
                <th>Source</th>
                <th>Company</th>
                <th>Status</th>
                <th>Lead Score</th>
                <th>Owner</th>
                <th>Last Touched</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((lead) => {
                const isSelected = selectedLeadIds.includes(lead.id);

                return (
                  <tr
                    key={lead.id}
                    className={isSelected ? 'selected' : ''}
                    onClick={() => handleRowClick(lead)}
                  >
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(lead.id)}
                        style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openLeadDetail(lead);
                        }}
                        title="Click to view full 3-column lead record"
                      >
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                          color: '#ffffff',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {(lead.name || 'Lead').split(' ').filter(Boolean).map((n) => n[0] || '').join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', textDecoration: 'none' }} className="lead-name-link">{lead.name}</div>
                          {lead.title ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.title}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      {lead.interested_product ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.55rem',
                            borderRadius: 6,
                            background: 'var(--primary-light)',
                            color: 'var(--primary-dark)',
                            border: '1px solid rgba(59, 130, 246, 0.28)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            maxWidth: 170,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={lead.interested_product}
                        >
                          📦 {lead.interested_product}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: 6,
                          background:
                            (lead.source || '').toLowerCase().includes('linkedin') ? 'var(--primary-light)' :
                            (lead.source || '').toLowerCase().includes('google') ? 'var(--danger-bg)' :
                            (lead.source || '').toLowerCase().includes('referral') ? 'var(--success-bg)' :
                            'var(--surface-soft)',
                          color:
                            (lead.source || '').toLowerCase().includes('linkedin') ? 'var(--primary-dark)' :
                            (lead.source || '').toLowerCase().includes('google') ? 'var(--danger-text-dark)' :
                            (lead.source || '').toLowerCase().includes('referral') ? 'var(--success-text-dark)' :
                            'var(--text-body)',
                          border: '1px solid',
                          borderColor:
                            (lead.source || '').toLowerCase().includes('linkedin') ? 'rgba(59, 130, 246, 0.28)' :
                            (lead.source || '').toLowerCase().includes('google') ? 'var(--danger-border)' :
                            (lead.source || '').toLowerCase().includes('referral') ? 'var(--success-border)' :
                            'var(--border-default)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {lead.source || 'Website'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-body)' }}>{lead.company}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{lead.industry}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        lead.status === 'Converted' ? 'badge-blue' :
                        lead.status === 'Qualified' ? 'badge-green' :
                        lead.status === 'Contacted' ? 'badge-amber' : 'badge-gray'
                      }`}>
                        <span className="badge-dot" />
                        {lead.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 60, height: 6, background: 'var(--border-default)', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, (lead.score / 130) * 100)}%`,
                              height: '100%',
                              background: lead.score > 90 ? 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)' : '#60a5fa',
                              borderRadius: 3
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 800, color: lead.score >= 90 ? 'var(--primary)' : 'var(--text-main)' }}>
                          {lead.score}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-body)', fontWeight: 600 }}>
                          {lead.owner}
                        </span>
                        {(isOwner || isManager) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLeadIdToAssign(lead.id);
                              setIsAssignOwnerOpen(true);
                            }}
                            title={`Reassign owner for ${lead.name}`}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              opacity: 0.6,
                              transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                          >
                            <UserCheck size={13} color="var(--primary)" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.lastContact}</span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        {lead.status !== 'Converted' ? (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setLeadToConvert(lead);
                              setIsConvertModalOpen(true);
                            }}
                          >
                            + Convert
                          </button>
                        ) : (
                          <span className="badge badge-blue" style={{ fontSize: '0.6875rem' }}>
                            Converted
                          </span>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openLeadDetail(lead)}
                          title="Open 3-Column Salesforce Lead Detail"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>
            <span>Showing {filteredLeads.length ? leadPage * LEADS_PAGE_SIZE + 1 : 0}–{Math.min((leadPage + 1) * LEADS_PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length.toLocaleString()} leads</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={leadPage === 0} onClick={() => setLeadPage((page) => Math.max(0, page - 1))}>Previous</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={(leadPage + 1) * LEADS_PAGE_SIZE >= filteredLeads.length} onClick={() => setLeadPage((page) => page + 1)}>Next</button>
            </div>
          </div>
        </div>
      ) : (
        /* Board Kanban View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
          {['New', 'Contacted', 'Qualified', 'Converted'].map((stg) => {
            const stageLeads = filteredLeads.filter((l) => l.status === stg);
            return (
              <div key={stg} className="kanban-column">
                <div className="kanban-column-header">
                  <span className="kanban-column-title">
                    {stg}
                    <span className="badge badge-gray">{stageLeads.length}</span>
                  </span>
                </div>

                <div className="kanban-cards-stack">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="deal-card"
                      onClick={() => openLeadDetail(lead)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span className="badge badge-blue">Score: {lead.score}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.source}</span>
                      </div>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-main)' }}>{lead.name}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-body)', marginBottom: '0.35rem' }}>{lead.company}</div>
                      {lead.interested_product && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--primary-dark)', fontWeight: 600, marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>📦 {lead.interested_product}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>{lead.owner}</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginTop: '1.25rem',
          padding: '0.85rem 1.25rem',
          background: 'var(--bg-card)',
          borderRadius: 10,
          border: '1px solid var(--border-default)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span>
            Showing <strong style={{ color: 'var(--text-main)' }}>{totalEffectiveCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to{' '}
            <strong style={{ color: 'var(--text-main)' }}>{Math.min(page * pageSize, totalEffectiveCount)}</strong> of{' '}
            <strong style={{ color: 'var(--text-main)' }}>{totalEffectiveCount.toLocaleString()}</strong> leads
          </span>

          <span style={{ color: 'var(--border-strong)' }}>|</span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                fontSize: '0.8125rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                background: 'var(--surface-soft)',
                color: 'var(--text-body)',
                cursor: 'pointer',
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        {/* Page buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '0.35rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              opacity: page <= 1 ? 0.4 : 1,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          {getPageNumbers(page, totalPages).map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 0.35rem', color: 'var(--text-subtle)' }}>
                …
              </span>
            ) : (
              <button
                key={`page-${p}`}
                onClick={() => setPage(p)}
                style={{
                  minWidth: 32,
                  height: 32,
                  padding: '0 0.5rem',
                  borderRadius: 6,
                  fontSize: '0.8125rem',
                  fontWeight: page === p ? 700 : 500,
                  border: '1px solid',
                  borderColor: page === p ? '#2563eb' : 'var(--border-default)',
                  background: page === p ? '#2563eb' : 'var(--bg-card)',
                  color: page === p ? '#ffffff' : 'var(--text-body)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {p}
              </button>
            )
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '0.35rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              opacity: page >= totalPages ? 0.4 : 1,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      </>
      )}

      {/* Quick Preview Slide-out Panel */}
      {quickPreviewLead && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            right: isAgentDockOpen ? 360 : 0,
            bottom: 0,
            width: 380,
            maxWidth: 'calc(100vw - 380px)',
            background: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-default)',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            transition: 'right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'slideLeft 0.2s ease'
          }}
        >
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>Lead Preview</h3>
            <button onClick={() => setQuickPreviewLead(null)} style={{ color: 'var(--text-muted)' }}>
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                {(quickPreviewLead?.name || 'Lead').split(' ').filter(Boolean).map(n => n[0] || '').join('')}
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>{quickPreviewLead.name}</h2>
              {quickPreviewLead.title ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{quickPreviewLead.title}</div> : null}
              <div style={{ marginTop: '0.5rem' }}>
                <span className="badge badge-blue">Lead Score: {quickPreviewLead.score}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem', borderTop: '1px solid var(--border-default)', paddingTop: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Company</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{quickPreviewLead.company}</div>
              </div>
              {quickPreviewLead.interested_product && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Interested Product</span>
                  <div style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>📦 {quickPreviewLead.interested_product}</div>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Email</span>
                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{quickPreviewLead.email}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Phone</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{quickPreviewLead.phone}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Owner</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{quickPreviewLead.owner}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Lead Source</span>
                <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{quickPreviewLead.source || 'Website'}</div>
              </div>
              {quickPreviewLead.website && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Website</span>
                  <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    <a
                      href={quickPreviewLead.website.startsWith('http') ? quickPreviewLead.website : `https://${quickPreviewLead.website}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      {quickPreviewLead.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-default)', display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => openLeadDetail(quickPreviewLead)}
            >
              Open Full Detail
            </button>
            {quickPreviewLead.status !== 'Converted' && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setLeadToConvert(quickPreviewLead);
                  setIsConvertModalOpen(true);
                }}
              >
                + Convert
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk Import Audit Slide-out Drawer */}
      {isImportDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            right: isAgentDockOpen ? 360 : 0,
            bottom: 0,
            width: 500,
            maxWidth: 'calc(100vw - 380px)',
            background: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-default)',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            zIndex: 46,
            display: 'flex',
            flexDirection: 'column',
            transition: 'right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'slideLeft 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1.15rem 1.25rem',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-soft)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.15rem' }}>📊</span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Bulk Import Audit
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                {importAuditReport && (
                  <button
                    onClick={() => setDrawerMode('details')}
                    style={{
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRadius: 6,
                      border: '1px solid',
                      borderColor: drawerMode === 'details' ? 'var(--primary)' : 'var(--border-strong)',
                      background: drawerMode === 'details' ? 'var(--primary-light)' : 'var(--bg-card)',
                      color: drawerMode === 'details' ? 'var(--primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Current Batch
                  </button>
                )}
                <button
                  onClick={() => {
                    setDrawerMode('history');
                    fetchImportHistory();
                  }}
                  style={{
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: drawerMode === 'history' ? 'var(--primary)' : 'var(--border-strong)',
                    background: drawerMode === 'history' ? 'var(--primary-light)' : 'var(--bg-card)',
                    color: drawerMode === 'history' ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  📜 History Log ({importHistory.length})
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsImportDrawerOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.2rem',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* Mode 1: Persistent History Log Table */}
          {drawerMode === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--surface-alt)',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  color: 'var(--text-body)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>
                  <strong>Role Scope:</strong>{' '}
                  {isOwner
                    ? 'Owner (All organization imports)'
                    : isManager
                    ? 'Manager (Squad imports)'
                    : 'Salesperson (My imports)'}
                </span>
                <button
                  onClick={fetchImportHistory}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🔄 Refresh
                </button>
              </div>

              {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  ⏳ Loading persistent import history...
                </div>
              ) : importHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-subtle)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-body)' }}>No Import Batches Found</div>
                  <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                    Click [↑ Import] on the Leads page to upload your first lead batch.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {importHistory.map((batch) => {
                    const formattedDate = batch.created_at
                      ? new Date(batch.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                    return (
                      <div
                        key={batch.batch_id}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 8,
                          padding: '0.9rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                            📄 {batch.file_name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'var(--success-bg)',
                              color: 'var(--success-text-dark)',
                            }}
                          >
                            {batch.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>By: <strong style={{ color: 'var(--text-body)' }}>{batch.user_name}</strong> ({batch.user_role})</span>
                          <span>{formattedDate}</span>
                        </div>

                        {/* Metric pills */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'var(--success-bg)',
                              color: 'var(--success-text-dark)',
                              border: '1px solid var(--success-border)',
                              borderRadius: 4,
                              padding: '2px 6px',
                            }}
                          >
                            +{batch.inserted_count.toLocaleString()} Inserted
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'var(--warning-bg)',
                              color: 'var(--warning-text-dark)',
                              border: '1px solid var(--warning-border)',
                              borderRadius: 4,
                              padding: '2px 6px',
                            }}
                          >
                            {batch.duplicate_count.toLocaleString()} Duplicates
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: 'var(--danger-bg)',
                              color: 'var(--danger-text-dark)',
                              border: '1px solid var(--danger-border)',
                              borderRadius: 4,
                              padding: '2px 6px',
                            }}
                          >
                            {batch.error_count.toLocaleString()} Errors
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-default)' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setImportAuditReport(batch);
                              setSelectedDuplicateRows(new Set());
                              setDrawerMode('details');
                            }}
                            style={{ flex: 1, fontSize: '0.75rem', justifyContent: 'center' }}
                          >
                            🔍 View Diagnostics
                          </button>
                          {batch.error_sample && batch.error_sample.length > 0 && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => downloadAuditCsv(batch)}
                              title="Download diagnostics CSV for this batch"
                              style={{ fontSize: '0.75rem', padding: '0 0.5rem' }}
                            >
                              <Download size={13} />
                              <span>CSV</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Detailed Diagnostics for Selected / Current Batch */}
          {drawerMode === 'details' && importAuditReport && (
            <>
              {/* Stat Cards Overview */}
              <div style={{ padding: '1.25rem 1.25rem 0.75rem 1.25rem', borderBottom: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Inspecting file: <strong style={{ color: 'var(--text-main)' }}>{importAuditReport.file_name}</strong>
                  {importAuditReport.user_name && (
                    <span> • Imported by: <strong>{importAuditReport.user_name}</strong></span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div
                    style={{
                      background: 'var(--success-bg)',
                      border: '1px solid var(--success-border)',
                      borderRadius: 8,
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success-text)' }}>
                      {importAuditReport.inserted_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--success-text-dark)', textTransform: 'uppercase' }}>
                      ✓ Inserted
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--warning-bg)',
                      border: '1px solid var(--warning-border)',
                      borderRadius: 8,
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warning-text)' }}>
                      {importAuditReport.duplicate_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--warning-text-dark)', textTransform: 'uppercase' }}>
                      ⚠️ Duplicates
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger-border)',
                      borderRadius: 8,
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger-text)' }}>
                      {importAuditReport.error_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--danger-text-dark)', textTransform: 'uppercase' }}>
                      ❌ Errors
                    </div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '1rem' }}>
                  {[
                    { id: 'all', label: `All Issues (${(importAuditReport.error_sample || []).length.toLocaleString()})` },
                    {
                      id: 'duplicates',
                      label: `Duplicates (${(importAuditReport.error_sample || []).filter(e => e.is_duplicate || (e.error || '').toLowerCase().includes('duplicate')).length.toLocaleString()})`,
                    },
                    {
                      id: 'errors',
                      label: `Errors (${(importAuditReport.error_sample || []).filter(e => !(e.is_duplicate || (e.error || '').toLowerCase().includes('duplicate'))).length.toLocaleString()})`,
                    },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setAuditFilterTab(t.id);
                        setVisibleIssuesCount(100);
                      }}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: auditFilterTab === t.id ? 'var(--primary)' : 'var(--border-default)',
                        background: auditFilterTab === t.id ? 'var(--primary-light)' : 'var(--bg-card)',
                        color: auditFilterTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Allow Duplicates Action Bar (Select All + Import Selected) */}
                {pendingDuplicateItems.length > 0 && (auditFilterTab === 'all' || auditFilterTab === 'duplicates') && (
                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.6rem 0.75rem',
                      background: 'var(--warning-bg)',
                      border: '1px solid var(--warning-border)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--warning-text-dark)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          pendingDuplicateItems.length > 0 &&
                          pendingDuplicateItems.every((d) => selectedDuplicateRows.has(d.row))
                        }
                        onChange={(e) => handleSelectAllDuplicates(e.target.checked)}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#d97706' }}
                      />
                      <span>Select All Duplicates ({pendingDuplicateItems.length.toLocaleString()})</span>
                    </label>

                    <button
                      className="btn btn-primary btn-sm"
                      disabled={selectedDuplicateRows.size === 0 || isAllowingDuplicates}
                      onClick={handleAllowSelectedDuplicates}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.65rem',
                        opacity: selectedDuplicateRows.size === 0 || isAllowingDuplicates ? 0.55 : 1,
                        cursor: selectedDuplicateRows.size === 0 || isAllowingDuplicates ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isAllowingDuplicates
                        ? '⏳ Importing...'
                        : `✓ Allow & Import (${selectedDuplicateRows.size.toLocaleString()})`}
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable Error / Duplicate Diagnostics List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
                {(!importAuditReport.error_sample || importAuditReport.error_sample.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--success-text)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>100% Clean Upload!</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      All {importAuditReport.total_rows} rows were successfully inserted without any duplicate or validation issues.
                    </div>
                  </div>
                ) : (
                  (() => {
                    const allFiltered = importAuditReport.error_sample.filter(item => {
                      const isDup = item.is_duplicate || (item.error || '').toLowerCase().includes('duplicate');
                      if (auditFilterTab === 'duplicates') return isDup;
                      if (auditFilterTab === 'errors') return !isDup;
                      return true;
                    });
                    const displayed = allFiltered.slice(0, visibleIssuesCount);

                    return (
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {displayed.map((item, idx) => {
                            const isDup = item.is_duplicate || (item.error || '').toLowerCase().includes('duplicate');
                            const isAllowed = Boolean(item.allowed);
                            const canSelect = isDup && !isAllowed && Boolean(item.lead_data);
                            const isChecked = canSelect && selectedDuplicateRows.has(item.row);
                            return (
                              <div
                                key={idx}
                                style={{
                                  padding: '0.75rem',
                                  borderRadius: 8,
                                  border: '1px solid',
                                  borderColor: isAllowed ? 'var(--success-border)' : isChecked ? 'var(--primary)' : isDup ? 'var(--warning-border)' : 'var(--danger-border)',
                                  background: isAllowed ? 'var(--success-bg)' : isChecked ? 'var(--primary-light)' : isDup ? 'var(--warning-bg)' : 'var(--danger-bg)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.35rem',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    {canSelect && (
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleDuplicateRow(item.row)}
                                        aria-label={`Allow duplicate row ${item.row}`}
                                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#2563eb' }}
                                      />
                                    )}
                                    <span
                                      style={{
                                        fontSize: '0.6875rem',
                                        fontWeight: 800,
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: 4,
                                        background: isAllowed ? 'var(--success-bg)' : isDup ? 'var(--warning-bg)' : 'var(--danger-bg)',
                                        color: isAllowed ? 'var(--success-text-dark)' : isDup ? 'var(--warning-text-dark)' : 'var(--danger-text-dark)',
                                      }}
                                    >
                                      ROW {item.row}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                      {item.name || '(Missing Name)'}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '0.625rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      color: isAllowed ? 'var(--success-text)' : isDup ? 'var(--warning-text)' : 'var(--danger-text)',
                                    }}
                                  >
                                    {isAllowed ? '✓ Allowed & Imported' : isDup ? 'Skipped Duplicate' : 'Validation Error'}
                                  </span>
                                </div>

                                {item.email && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Contact: <code style={{ color: 'var(--text-main)', background: 'var(--surface-alt)', padding: '1px 4px', borderRadius: 3 }}>{item.email}</code>
                                  </div>
                                )}

                                <div style={{ fontSize: '0.75rem', color: isAllowed ? 'var(--success-text-dark)' : isDup ? 'var(--warning-text-dark)' : 'var(--danger-text-dark)', lineHeight: 1.4 }}>
                                  {item.error}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {allFiltered.length > visibleIssuesCount && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setVisibleIssuesCount(prev => prev + 200)}
                              style={{ fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                            >
                              Load Next 200 (Showing {visibleIssuesCount} of {allFiltered.length.toLocaleString()})
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setVisibleIssuesCount(allFiltered.length)}
                              style={{ fontSize: '0.75rem', justifyContent: 'center' }}
                            >
                              Show All ({allFiltered.length.toLocaleString()})
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid var(--border-default)',
              background: 'var(--surface-soft)',
              display: 'flex',
              gap: '0.75rem',
            }}
          >
            {drawerMode === 'details' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDrawerMode('history')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>← History</span>
              </button>
            )}

            {drawerMode === 'details' && importAuditReport?.error_sample && importAuditReport.error_sample.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                onClick={() => downloadAuditCsv(importAuditReport)}
                title="Download CSV containing all skipped rows and error reasons"
              >
                <Download size={14} />
                <span>Download Diagnostics CSV ({importAuditReport.error_sample.length.toLocaleString()} rows)</span>
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              style={{ minWidth: 80 }}
              onClick={() => setIsImportDrawerOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Assign Lead Owner Modal */}
      <AssignOwnerModal
        isOpen={isAssignOwnerOpen}
        onClose={() => {
          setIsAssignOwnerOpen(false);
          setLeadIdToAssign(null);
        }}
        selectedLeadIds={leadIdToAssign ? [leadIdToAssign] : selectedLeadIds}
        onSuccess={() => {
          setSelectedLeadIds([]);
          setLeadIdToAssign(null);
        }}
      />
    </div>
  );
}
