import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCRM } from '../context/CRMContext';
import { gatewayApi } from '../services/api';
import LoadingSymbol from '../components/common/LoadingSymbol';
import AssignOwnerModal from '../components/modals/AssignOwnerModal';
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
    return leads.filter((l) => {
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
  }, [leads, searchQuery, statusFilter, activeTab, currentUser]);

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Leads
            </h1>
            <span className="badge badge-blue">
              {totalEffectiveCount.toLocaleString()} total
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Track, score and convert prospective accounts into pipeline revenue
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* View switcher */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, border: '1px solid #e2e8f0' }}>
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
                background: viewMode === 'list' ? '#ffffff' : 'transparent',
                color: viewMode === 'list' ? '#2563eb' : '#64748b',
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
                background: viewMode === 'board' ? '#ffffff' : 'transparent',
                color: viewMode === 'board' ? '#2563eb' : '#64748b',
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
              borderColor: '#bbf7d0',
              background: '#f0fdf4',
              color: '#15803d',
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
            background: importNotification.type === 'error' ? '#fef2f2' : '#ecfdf5',
            border: `1px solid ${importNotification.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
            borderRadius: 8,
            color: importNotification.type === 'error' ? '#991b1b' : '#065f46',
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
                color: importNotification.type === 'error' ? '#991b1b' : '#065f46',
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
                        checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
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
              {filteredLeads.map((lead) => {
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
                          <div style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'none' }} className="lead-name-link">{lead.name}</div>
                          {lead.title ? <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.title}</div> : null}
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
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
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
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
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
                            (lead.source || '').toLowerCase().includes('linkedin') ? '#eff6ff' :
                            (lead.source || '').toLowerCase().includes('google') ? '#fef2f2' :
                            (lead.source || '').toLowerCase().includes('referral') ? '#f0fdf4' :
                            '#f8fafc',
                          color:
                            (lead.source || '').toLowerCase().includes('linkedin') ? '#1d4ed8' :
                            (lead.source || '').toLowerCase().includes('google') ? '#b91c1c' :
                            (lead.source || '').toLowerCase().includes('referral') ? '#15803d' :
                            '#475569',
                          border: '1px solid',
                          borderColor:
                            (lead.source || '').toLowerCase().includes('linkedin') ? '#bfdbfe' :
                            (lead.source || '').toLowerCase().includes('google') ? '#fecaca' :
                            (lead.source || '').toLowerCase().includes('referral') ? '#bbf7d0' :
                            '#e2e8f0',
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
                      <div style={{ fontWeight: 600, color: '#334155' }}>{lead.company}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{lead.industry}</div>
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
                        <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, (lead.score / 130) * 100)}%`,
                              height: '100%',
                              background: lead.score > 90 ? 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)' : '#60a5fa',
                              borderRadius: 3
                            }}
                          />
                        </div>
                        <span style={{ fontWeight: 800, color: lead.score >= 90 ? '#2563eb' : '#0f172a' }}>
                          {lead.score}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 600 }}>
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
                              color: '#64748b',
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
                            <UserCheck size={13} color="#2563eb" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.lastContact}</span>
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
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.source}</span>
                      </div>
                      <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>{lead.name}</h4>
                      <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.35rem' }}>{lead.company}</div>
                      {lead.interested_product && (
                        <div style={{ fontSize: '0.6875rem', color: '#1d4ed8', fontWeight: 600, marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>📦 {lead.interested_product}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
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
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#64748b' }}>
          <span>
            Showing <strong style={{ color: '#0f172a' }}>{totalEffectiveCount === 0 ? 0 : (page - 1) * pageSize + 1}</strong> to{' '}
            <strong style={{ color: '#0f172a' }}>{Math.min(page * pageSize, totalEffectiveCount)}</strong> of{' '}
            <strong style={{ color: '#0f172a' }}>{totalEffectiveCount.toLocaleString()}</strong> leads
          </span>

          <span style={{ color: '#cbd5e1' }}>|</span>

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
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
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
              <span key={`ellipsis-${idx}`} style={{ padding: '0 0.35rem', color: '#94a3b8' }}>
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
                  borderColor: page === p ? '#2563eb' : '#e2e8f0',
                  background: page === p ? '#2563eb' : '#ffffff',
                  color: page === p ? '#ffffff' : '#334155',
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
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            transition: 'right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: 'slideLeft 0.2s ease'
          }}
        >
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Lead Preview</h3>
            <button onClick={() => setQuickPreviewLead(null)} style={{ color: '#64748b' }}>
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
                {(quickPreviewLead?.name || 'Lead').split(' ').filter(Boolean).map(n => n[0] || '').join('')}
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{quickPreviewLead.name}</h2>
              {quickPreviewLead.title ? <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{quickPreviewLead.title}</div> : null}
              <div style={{ marginTop: '0.5rem' }}>
                <span className="badge badge-blue">Lead Score: {quickPreviewLead.score}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Company</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{quickPreviewLead.company}</div>
              </div>
              {quickPreviewLead.interested_product && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Interested Product</span>
                  <div style={{ fontWeight: 600, color: '#1d4ed8' }}>📦 {quickPreviewLead.interested_product}</div>
                </div>
              )}
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Email</span>
                <div style={{ fontWeight: 600, color: '#2563eb' }}>{quickPreviewLead.email}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Phone</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{quickPreviewLead.phone}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Owner</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{quickPreviewLead.owner}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Lead Source</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{quickPreviewLead.source || 'Website'}</div>
              </div>
              {quickPreviewLead.website && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Website</span>
                  <div style={{ fontWeight: 600, color: '#2563eb' }}>
                    <a
                      href={quickPreviewLead.website.startsWith('http') ? quickPreviewLead.website : `https://${quickPreviewLead.website}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', textDecoration: 'none' }}
                    >
                      {quickPreviewLead.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.75rem' }}>
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
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
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
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.15rem' }}>📊</span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
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
                      borderColor: drawerMode === 'details' ? '#2563eb' : '#cbd5e1',
                      background: drawerMode === 'details' ? '#eff6ff' : '#ffffff',
                      color: drawerMode === 'details' ? '#2563eb' : '#64748b',
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
                    borderColor: drawerMode === 'history' ? '#2563eb' : '#cbd5e1',
                    background: drawerMode === 'history' ? '#eff6ff' : '#ffffff',
                    color: drawerMode === 'history' ? '#2563eb' : '#64748b',
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
                color: '#64748b',
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
                  background: '#f1f5f9',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  color: '#475569',
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
                    color: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🔄 Refresh
                </button>
              </div>

              {isLoadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
                  ⏳ Loading persistent import history...
                </div>
              ) : importHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#475569' }}>No Import Batches Found</div>
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
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '0.9rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#0f172a' }}>
                            📄 {batch.file_name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#ecfdf5',
                              color: '#065f46',
                            }}
                          >
                            {batch.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                          <span>By: <strong style={{ color: '#334155' }}>{batch.user_name}</strong> ({batch.user_role})</span>
                          <span>{formattedDate}</span>
                        </div>

                        {/* Metric pills */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
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
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a',
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
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              borderRadius: 4,
                              padding: '2px 6px',
                            }}
                          >
                            {batch.error_count.toLocaleString()} Errors
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #f1f5f9' }}>
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
              <div style={{ padding: '1.25rem 1.25rem 0.75rem 1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  Inspecting file: <strong style={{ color: '#0f172a' }}>{importAuditReport.file_name}</strong>
                  {importAuditReport.user_name && (
                    <span> • Imported by: <strong>{importAuditReport.user_name}</strong></span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 8,
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>
                      {importAuditReport.inserted_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#15803d', textTransform: 'uppercase' }}>
                      ✓ Inserted
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 8,
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706' }}>
                      {importAuditReport.duplicate_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>
                      ⚠️ Duplicates
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      padding: '0.65rem',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
                      {importAuditReport.error_count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase' }}>
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
                        borderColor: auditFilterTab === t.id ? '#2563eb' : '#e2e8f0',
                        background: auditFilterTab === t.id ? '#eff6ff' : '#ffffff',
                        color: auditFilterTab === t.id ? '#2563eb' : '#64748b',
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
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
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
                        color: '#92400e',
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
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#16a34a' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>100% Clean Upload!</div>
                    <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
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
                                  borderColor: isAllowed ? '#bbf7d0' : isChecked ? '#2563eb' : isDup ? '#fde68a' : '#fecaca',
                                  background: isAllowed ? '#f0fdf4' : isChecked ? '#eff6ff' : isDup ? '#fffdf7' : '#fffaf0',
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
                                        background: isAllowed ? '#dcfce7' : isDup ? '#fef3c7' : '#fee2e2',
                                        color: isAllowed ? '#15803d' : isDup ? '#92400e' : '#991b1b',
                                      }}
                                    >
                                      ROW {item.row}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b' }}>
                                      {item.name || '(Missing Name)'}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '0.625rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      color: isAllowed ? '#16a34a' : isDup ? '#d97706' : '#dc2626',
                                    }}
                                  >
                                    {isAllowed ? '✓ Allowed & Imported' : isDup ? 'Skipped Duplicate' : 'Validation Error'}
                                  </span>
                                </div>

                                {item.email && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Contact: <code style={{ color: '#0f172a', background: 'rgba(0,0,0,0.04)', padding: '1px 4px', borderRadius: 3 }}>{item.email}</code>
                                  </div>
                                )}

                                <div style={{ fontSize: '0.75rem', color: isAllowed ? '#166534' : isDup ? '#78350f' : '#7f1d1d', lineHeight: 1.4 }}>
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
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
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
