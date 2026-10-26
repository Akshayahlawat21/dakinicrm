import React, { useState, useMemo, useRef } from 'react';
import { useCRM } from '../context/CRMContext';
import LoadingSymbol from '../components/common/LoadingSymbol';
import {
  Plus,
  Filter,
  Download,
  Upload,
  Search,
  List,
  Kanban,
  Sparkles,
  ChevronRight,
  UserCheck,
  Check,
  Trash2,
  Mail,
  UserPlus,
  Eye,
  ArrowRight
} from 'lucide-react';

export default function LeadsPage() {
  const {
    leads,
    setLeads,
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
  } = useCRM();

  const [activeTab, setActiveTab] = useState('All');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [importNotification, setImportNotification] = useState(null);
  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        let newLeadsToAdd = [];

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          const rawItems = Array.isArray(parsed) ? parsed : (parsed.leads || [parsed]);
          newLeadsToAdd = rawItems.map((item, idx) => ({
            id: `lead-import-${Date.now()}-${idx}`,
            name: item.name || 'Imported Lead',
            company: item.company || 'Unknown Company',
            title: item.title || 'Prospect',
            status: item.status || 'New',
            score: Number(item.score) || 75,
            email: item.email || `lead${idx}@imported.com`,
            phone: item.phone || '+91 98000 00000',
            owner: item.owner || currentUser?.name || 'Sales Representative',
            industry: item.industry || 'Enterprise Technology',
            lastContact: 'Just now',
            scoreBreakdown: { websiteDemo: 70, emailEngagement: 60, companyFit: 80, sourceQuality: 75 },
            timeline: [
              {
                id: `t-${Date.now()}-${idx}`,
                type: 'system',
                title: 'Lead imported',
                description: `Imported from file ${file.name}`,
                time: 'Just now'
              }
            ]
          }));
        } else {
          // CSV / Text parsing
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 0) {
            const firstLine = lines[0].toLowerCase();
            const hasHeader = firstLine.includes('name') || firstLine.includes('company');
            const dataLines = hasHeader ? lines.slice(1) : lines;

            newLeadsToAdd = dataLines.map((line, idx) => {
              const cols = line.split(/[,;\t]/).map((c) => c.replace(/^["']|["']$/g, '').trim());
              return {
                id: `lead-csv-${Date.now()}-${idx}`,
                name: cols[0] || `Imported Lead ${idx + 1}`,
                company: cols[1] || 'Imported Corp',
                title: cols[2] || 'Decision Maker',
                status: cols[3] || 'New',
                score: Number(cols[4]) || 80,
                email: cols[5] || `lead${idx}@imported.com`,
                phone: cols[6] || '+91 98000 00000',
                owner: currentUser?.name || 'Sales Representative',
                industry: 'Enterprise Technology',
                lastContact: 'Just now',
                scoreBreakdown: { websiteDemo: 70, emailEngagement: 60, companyFit: 80, sourceQuality: 75 },
                timeline: [
                  {
                    id: `t-${Date.now()}-${idx}`,
                    type: 'system',
                    title: 'Lead imported',
                    description: `Imported from ${file.name}`,
                    time: 'Just now'
                  }
                ]
              };
            });
          }
        }

        if (newLeadsToAdd.length > 0) {
          setLeads((prev) => [...newLeadsToAdd, ...prev]);
          setImportNotification(`Successfully imported ${newLeadsToAdd.length} leads from ${file.name}`);
          setTimeout(() => setImportNotification(null), 4000);
        } else {
          setImportNotification('File contained no valid records to import.');
          setTimeout(() => setImportNotification(null), 3000);
        }
      } catch (err) {
        setImportNotification(`Import error: ${err.message}`);
        setTimeout(() => setImportNotification(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.owner.toLowerCase().includes(searchQuery.toLowerCase());

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
            <span className="badge badge-blue">{filteredLeads.length} total</span>
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
              {tab === 'All' ? leads.length : leads.filter((l) => tab === 'Hot' ? l.score >= 90 : l.status === tab).length}
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
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 8,
            color: '#065f46',
            fontSize: '0.8125rem',
            fontWeight: 600,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>✓ {importNotification}</span>
          <button
            onClick={() => setImportNotification(null)}
            style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
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
            <button className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
              Assign Owner
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
                          {lead.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'none' }} className="lead-name-link">{lead.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{lead.title}</div>
                        </div>
                      </div>
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
                      <span style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 500 }}>
                        {lead.owner}
                      </span>
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
                      <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '0.5rem' }}>{lead.company}</div>
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
      </>
      )}

      {/* Quick Preview Slide-out Panel */}
      {quickPreviewLead && (
        <div
          style={{
            position: 'fixed',
            top: 64,
            right: 0,
            bottom: 0,
            width: 380,
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
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
                {quickPreviewLead.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{quickPreviewLead.name}</h2>
              <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{quickPreviewLead.title}</div>
              <div style={{ marginTop: '0.5rem' }}>
                <span className="badge badge-blue">Lead Score: {quickPreviewLead.score}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Company</span>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{quickPreviewLead.company}</div>
              </div>
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
    </div>
  );
}
