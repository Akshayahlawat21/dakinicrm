import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Download,
  ExternalLink,
  Layers,
  Shield,
  Zap,
  Bot,
  Mail,
  Calendar,
  CheckCircle2,
  Users,
  Building2,
  Handshake,
  BarChart3,
  HelpCircle,
  FileText,
  Sliders,
  Database,
  ArrowRight,
  X,
  Code2,
  Check
} from 'lucide-react';

export default function HelpDocsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);

  const tabs = [
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'core-modules', label: 'Core CRM Modules' },
    { id: 'engagement', label: 'Communication & Cadence' },
    { id: 'ai-automation', label: 'AI Agents & Automations' },
    { id: 'developer-guide', label: 'Edge Gateway & Developer API' }
  ];

  const articles = [
    // Tab 1: Getting Started
    {
      id: 'intro-dakini',
      tab: 'getting-started',
      title: 'Introduction to Dakini CRM Platform',
      category: 'Overview',
      badge: 'Architecture',
      icon: BookOpen,
      desc: 'Explore our enterprise 3-tier sales CRM platform built with React 18, FastAPI Gateway, and Supabase PostgreSQL.',
      content: {
        subtitle: 'Modern 3-Tier Enterprise Architecture',
        overview: 'Dakini CRM is engineered to bridge enterprise sales execution with autonomous agent intelligence. The system strictly isolates client channels, edge routing, and data persistence to ensure sub-millisecond responsiveness and row-level security.',
        sections: [
          {
            heading: 'System Architecture Layers',
            text: '• Layer 1 (Presentation): React 18 SPA on Vite with React Router v6 URL navigation.\n• Layer 2 (Edge / API Gateway): Python FastAPI edge shield running on port 8080 handling rate limiting, JWT validation, and correlation logging.\n• Layer 3 (Application & Data): Python FastAPI domain services on port 8000 connected to Supabase PostgreSQL.'
          },
          {
            heading: 'Three-Terminal Local Development',
            text: 'To run the complete stack locally:\n1. Terminal 1: npm run backend (Port 8000)\n2. Terminal 2: npm run gateway (Port 8080)\n3. Terminal 3: npm run dev (Port 3000)'
          }
        ]
      }
    },
    {
      id: 'rbac-auth',
      tab: 'getting-started',
      title: 'User Roles & Access Control (RBAC)',
      category: 'Security & Access',
      badge: 'Security',
      icon: Shield,
      desc: 'Understand permissions across Owner, Manager, and Salesperson tiers with multi-tenant tenant_id isolation.',
      content: {
        subtitle: 'Role-Based Permissions & Isolation',
        overview: 'Every request is cryptographically tied to a verified tenant organization. Users cannot view or modify data outside their authorized tenant context.',
        sections: [
          {
            heading: 'Default Role Tiers',
            text: '• Owner (Elena Rostova): Full administrative control, settings configuration, sales quota assignments, and all reports.\n• Manager (Marcus Vance): Team performance oversight, pipeline approvals, and rep assignment.\n• Salesperson (Dev Singhania / Asha Nair): Lead management, deal progression, and personal task execution.'
          },
          {
            heading: '1-Click Role Login Presets',
            text: 'On the /login page, click any of the preset role buttons (Owner, Manager, Sales Rep) to instantly populate credentials and authenticate via JWT.'
          }
        ]
      }
    },
    {
      id: 'quick-start',
      tab: 'getting-started',
      title: 'Navigation & Route System',
      category: 'User Experience',
      badge: 'Routing',
      icon: Layers,
      desc: 'Learn about client-side URL routing, state preservation across page reloads, and protected route guards.',
      content: {
        subtitle: 'Stateful Single Page Architecture',
        overview: 'All primary pages operate under explicit URLs (/dashboard, /leads, /deals, /inbox, /calendar, /settings). Browser Back, Forward, and Page Reload work seamlessly without session loss.',
        sections: [
          {
            heading: 'Key Routes',
            text: '• /dashboard — Real-time ARR metrics and revenue pacing.\n• /leads & /leads/:id — Lead directory and 360-degree customer detail.\n• /deals — Kanban pipeline with drag-and-drop stages.\n• /inbox — 3-pane email communication hub with cadence templates.\n• /calendar — Day, Week, and Month engagement scheduling.'
          }
        ]
      }
    },

    // Tab 2: Core CRM Modules
    {
      id: 'leads-module',
      tab: 'core-modules',
      title: 'Leads Management & Scoring Engine',
      category: 'Sales Force Automation',
      badge: 'Core Module',
      icon: Users,
      desc: 'Track inbound prospects, evaluate automated AI lead scores (0-150), import CSV data, and execute 1-click conversions.',
      content: {
        subtitle: 'Prospect Triage & Qualification',
        overview: 'Leads represent potential customers who have shown interest. Dakini evaluates inbound signals (website demos, sandbox API usage) to automatically score prospects.',
        sections: [
          {
            heading: 'Lead Scoring Algorithm',
            text: 'Leads receive a composite score based on: website demo requests (+40 pts), company size fit (+30 pts), and interaction frequency (+25 pts). Leads exceeding 90 are flagged as High Priority.'
          },
          {
            heading: '1-Click Conversion Flow',
            text: 'Clicking "Convert Lead" creates three linked records in a single database transaction:\n1. An Account record for the organization\n2. A Contact record for the decision maker\n3. An Opportunity Deal placed into the Qualified stage'
          }
        ]
      }
    },
    {
      id: 'deals-kanban',
      tab: 'core-modules',
      title: 'Deals Pipeline & Kanban Board',
      category: 'Sales Force Automation',
      badge: 'Pipeline',
      icon: Handshake,
      desc: 'Visual Kanban pipeline across 5 standardized stages: Qualified, Proposal, Negotiation, Won, and Lost.',
      content: {
        subtitle: 'Visual Opportunity Management',
        overview: 'Deals allow sales teams to forecast revenue and track contract negotiations across their full lifecycle.',
        sections: [
          {
            heading: 'Standardized Stages',
            text: '• Qualified: Opportunity identified with confirmed budget and timeline.\n• Proposal: Formal commercial and technical proposal submitted.\n• Negotiation: Legal and procurement review of MSA and pricing.\n• Won: Contract signed and implementation scheduled.\n• Lost: Opportunity closed without agreement.'
          },
          {
            heading: 'Drag-and-Drop & Live Sync',
            text: 'Dragging a card across columns immediately updates the deal stage in the UI, dispatches an API request, and writes the stage update directly into Supabase PostgreSQL.'
          }
        ]
      }
    },
    {
      id: 'accounts-contacts',
      tab: 'core-modules',
      title: 'Accounts & Contacts Directory',
      category: 'Data Management',
      badge: 'Directory',
      icon: Building2,
      desc: 'Enterprise account hierarchy, domain associations, ARR metrics, and 360-degree customer touchpoint history.',
      content: {
        subtitle: '360° Customer Intelligence',
        overview: 'Accounts store company-level metadata (industry, website, employee count, ARR health), while Contacts represent individual stakeholders at those accounts.',
        sections: [
          {
            heading: 'Account Health Metrics',
            text: 'Accounts display ARR health scores (Healthy, At Risk, Churned) based on product usage and pending support tickets.'
          }
        ]
      }
    },

    // Tab 3: Engagement & Communication
    {
      id: 'inbox-cadence',
      tab: 'engagement',
      title: 'Multi-Folder Inbox & Email Cadence',
      category: 'Omnichannel Engagement',
      badge: 'Communication',
      icon: Mail,
      desc: 'Synchronized email hub with Inbox, Sent (read receipts), Autosaved Drafts, and reusable Sales Cadence Templates.',
      content: {
        subtitle: 'Unified Sales Communication',
        overview: 'Directly connect customer emails to matching CRM records, eliminating manual data entry.',
        sections: [
          {
            heading: 'Four Specialized Folders',
            text: '• Inbox: Inbound threads linked to Leads/Contacts with Dakini Smart Reply.\n• Sent: Dispatched emails with "Delivered & Read" tracking receipts.\n• Drafts: Autosaved email drafts with AI tone enhancer.\n• Templates: Enterprise sales cadence templates with live merge variable playground.'
          },
          {
            heading: 'Merge Variable Playground',
            text: 'Templates support dynamic tags like {{first_name}}, {{company}}, {{user_name}}, and {{deal_value}}. The interactive tester replaces tags in real time and allows 1-click clipboard copy or new email draft creation.'
          }
        ]
      }
    },
    {
      id: 'calendar-scheduling',
      tab: 'engagement',
      title: 'Calendar & Engagement Scheduling',
      category: 'Meeting Management',
      badge: 'Calendar',
      icon: Calendar,
      desc: 'Interactive Day (hourly timeline), Week (7-day columns), and Month (35-day grid) views with video bridge links.',
      content: {
        subtitle: 'Executive Demo & Review Scheduling',
        overview: 'Track customer demos, architectural reviews, and executive follow-ups with full calendar visibility.',
        sections: [
          {
            heading: 'Three View Modes',
            text: '• Day View: Hourly breakdown (8:00 AM – 6:00 PM) showing meeting blocks, attendees, and direct "Join Video Bridge" buttons.\n• Week View: 7-day Monday through Sunday schedule with today highlight.\n• Month View: 35-day October 2026 calendar grid with date badges and quick day jumping.'
          }
        ]
      }
    },

    // Tab 4: AI Agents & Automations
    {
      id: 'ai-copilot',
      tab: 'ai-automation',
      title: 'Dakini AI Copilot & Autonomous Agents',
      category: 'Artificial Intelligence',
      badge: 'AI Engine',
      icon: Bot,
      desc: 'Context-aware AI copilot dock, autonomous telemetry scoring, and executive approval queues for safe agent action.',
      content: {
        subtitle: 'Autonomous CRM Intelligence',
        overview: 'Dakini AI works side-by-side with sales reps to automate repetitive logging and answer complex pipeline questions.',
        sections: [
          {
            heading: 'Slide-Out Copilot Dock',
            text: 'Click "Ask Dakini" or the bot icon to open the chat dock. Ask questions like "What are my closing deals this week?" or request AI email drafts.'
          },
          {
            heading: 'Executive Approval Queue',
            text: 'Autonomous agents cannot issue contract discounts or change account ownership without human-in-the-loop signoff in the notifications tray.'
          }
        ]
      }
    },
    {
      id: 'workflow-automations',
      tab: 'ai-automation',
      title: 'Workflow Automations & Event Triggers',
      category: 'Process Automation',
      badge: 'Automations',
      icon: Zap,
      desc: 'Trigger-action workflow builder automating lead assignment, Slack alert broadcasts, and follow-up task creation.',
      content: {
        subtitle: 'Event-Driven Workflow Automation',
        overview: 'Eliminate manual administrative overhead by configuring automated triggers and conditional actions.',
        sections: [
          {
            heading: 'Sample Workflow Rules',
            text: '• On Lead Created -> If Lead Score > 100 -> Auto-assign to Enterprise Rep & Notify #sales-war-room.\n• On Deal Won -> Auto-generate Implementation Task & Send DocuSign executable package.'
          }
        ]
      }
    },

    // Tab 5: Developer Guide & Edge Gateway
    {
      id: 'edge-gateway-lld',
      tab: 'developer-guide',
      title: 'Layer 2 Edge / API Gateway (E1–E8)',
      category: 'Developer Architecture',
      badge: 'Edge Gateway',
      icon: Shield,
      desc: 'Complete specification of Edge Shield, health probes, reverse proxy, JWT auth, rate limiter, and error normalization.',
      content: {
        subtitle: 'Enterprise Gateway Modules E1–E8',
        overview: 'The Layer 2 Gateway (Port 8080) acts as the secure reverse proxy for all API traffic, strictly disallowing direct database exposure.',
        sections: [
          {
            heading: 'Gateway Security Pipeline',
            text: '• E1 Edge Shield: Origin secret (X-Edge-Secret) validation & dynamic cache prevention.\n• E2 Health Probes: Non-blocking /health and /v1/health readiness probes.\n• E3 Versioned Proxy: Reverse-proxies /v1/* to Layer 3 with strict production mock forbidding.\n• E4 Token Auth: HMAC-SHA256 JWT validation and user/tenant claims forwarding.\n• E5 Rate Limiter: Sliding-window limiter returning HTTP 429 and Retry-After.\n• E6 Request Validation: 16KB header cap, 1MB body size limit, method whitelist, and application/json Content-Type enforcement.\n• E7 Correlation Logging: Injects X-Correlation-ID (req_<uuid>) for end-to-end tracing.\n• E8 Error Normalization: Standardized JSON error envelopes across all HTTP status codes.'
          }
        ]
      }
    },
    {
      id: 'supabase-integration',
      tab: 'developer-guide',
      title: 'Supabase PostgreSQL Cloud Integration',
      category: 'Data Layer',
      badge: 'Database',
      icon: Database,
      desc: 'Live PostgreSQL schema, connection pooling, multi-tenant row-level security, and verification test scripts.',
      content: {
        subtitle: 'Enterprise Cloud Data Persistence',
        overview: 'All CRM entities (leads, deals, accounts, contacts, campaigns, tasks) are stored in Supabase PostgreSQL.',
        sections: [
          {
            heading: 'Live Proof Script',
            text: 'Run python scripts/live_proof.py in terminal to compare raw SQL direct from Supabase against API JSON responses. Verifies 100% data consistency.'
          },
          {
            heading: 'Test Suite',
            text: 'Run pytest -q to execute all 59 automated unit and integration tests across Layer 2 and Layer 3.'
          }
        ]
      }
    }
  ];

  // Filtered articles based on active tab and search query
  const filteredArticles = articles.filter((art) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (searchQuery.trim() !== '') {
      return matchesSearch;
    }
    return art.tab === activeTab;
  });

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* ========================================================
          HERO BANNER (Zoho CRM Help Inspired)
         ======================================================== */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
        borderRadius: 16,
        padding: '3rem 2rem',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: '2rem',
        boxShadow: '0 10px 25px rgba(37, 99, 235, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle background glow */}
        <div style={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 250,
          height: 250,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem', backdropFilter: 'blur(4px)' }}>
          <BookOpen size={14} />
          <span>DAKINI CRM KNOWLEDGE BASE & SYSTEM MANUAL</span>
        </div>

        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
          Hi, how can we help?
        </h1>
        <p style={{ fontSize: '0.9375rem', opacity: 0.9, maxWidth: 650, margin: '0 auto 1.75rem auto', lineHeight: 1.6 }}>
          Explore comprehensive documentation for Dakini CRM. Learn module workflows, understand Layer 2 edge security, and verify Supabase PostgreSQL data sync.
        </p>

        {/* Search Input Box */}
        <div style={{
          maxWidth: 620,
          margin: '0 auto',
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16 }} />
          <input
            type="text"
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documentation, modules, APIs, workflows (e.g. leads, deals, jwt, rate limit)..."
            style={{
              padding: '0.85rem 1rem 0.85rem 2.85rem',
              borderRadius: 30,
              border: 'none',
              fontSize: '0.875rem',
              color: '#0f172a',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 14,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Quick Search Chips */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Popular Topics:</span>
          {['Leads Lifecycle', 'Deals Kanban', 'Email Templates', 'Supabase Cloud', 'Edge Gateway', 'Rate Limiting'].map((chip) => (
            <button
              key={chip}
              onClick={() => setSearchQuery(chip)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 14,
                padding: '3px 10px',
                color: '#ffffff',
                fontSize: '0.6875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              #{chip}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================
          DOWNLOAD PDF PROMO BANNER
         ======================================================== */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #bfdbfe',
        borderRadius: 12,
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a' }}>
              Download Complete Enterprise Documentation PDF
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Full 8-chapter specification manual with architecture diagrams, schema models, and verification steps.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a
            href="/Dakini_CRM_Documentation_Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ExternalLink size={14} />
            <span>View PDF Online</span>
          </a>
          <a
            href="/Dakini_CRM_Documentation_Guide.pdf"
            download="Dakini_CRM_Documentation_Guide.pdf"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} />
            <span>Download PDF Manual</span>
          </a>
        </div>
      </div>

      {/* ========================================================
          ZOHO-STYLE NAVIGATION TABS
         ======================================================== */}
      {searchQuery.trim() === '' && (
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.75rem',
          overflowX: 'auto',
          gap: '0.5rem'
        }}>
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#2563eb' : '#64748b',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search Result Count */}
      {searchQuery.trim() !== '' && (
        <div style={{ marginBottom: '1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
          Showing <strong>{filteredArticles.length}</strong> documentation topics matching "<strong>{searchQuery}</strong>":
        </div>
      )}

      {/* ========================================================
          ARTICLE CARDS GRID (Zoho CRM Help Style)
         ======================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: '1.25rem'
      }}>
        {filteredArticles.map((art) => {
          const Icon = art.icon;
          return (
            <div
              key={art.id}
              className="crm-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                border: '1px solid #e2e8f0'
              }}
              onClick={() => setSelectedArticle(art)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={20} />
                  </div>
                  <span className="badge badge-blue">
                    {art.badge}
                  </span>
                </div>

                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  {art.category}
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  {art.title}
                </h3>

                <p style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                  {art.desc}
                </p>
              </div>

              <div style={{
                borderTop: '1px solid #f1f5f9',
                paddingTop: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#2563eb',
                fontSize: '0.8125rem',
                fontWeight: 700
              }}>
                <span>Read Full Documentation</span>
                <ArrowRight size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {filteredArticles.length === 0 && (
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
          <HelpCircle size={40} style={{ margin: '0 auto 1rem auto', color: '#cbd5e1' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>No documentation topics found</h3>
          <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>
            Try searching with broader terms like "leads", "deals", "jwt", or "gateway".
          </p>
        </div>
      )}

      {/* ========================================================
          ARTICLE DETAIL MODAL / READER
         ======================================================== */}
      {selectedArticle && (
        <div className="modal-backdrop" onClick={() => setSelectedArticle(null)}>
          <div
            className="modal-box"
            style={{ maxWidth: 780, maxHeight: '85vh', overflowY: 'auto', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div>
                <span className="badge badge-blue" style={{ marginBottom: 6 }}>
                  {selectedArticle.category}
                </span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                  {selectedArticle.title}
                </h2>
                <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 2 }}>
                  {selectedArticle.content.subtitle}
                </div>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedArticle(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Overview */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '1rem',
              fontSize: '0.875rem',
              lineHeight: 1.7,
              color: '#334155',
              marginBottom: '1.5rem'
            }}>
              {selectedArticle.content.overview}
            </div>

            {/* Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {selectedArticle.content.sections.map((sec, idx) => (
                <div key={idx}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.45rem' }}>
                    {sec.heading}
                  </h4>
                  <div style={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.7,
                    color: '#475569',
                    whiteSpace: 'pre-line'
                  }}>
                    {sec.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div style={{
              borderTop: '1px solid #e2e8f0',
              marginTop: '2rem',
              paddingTop: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <a
                href="/Dakini_CRM_Documentation_Guide.pdf"
                download="Dakini_CRM_Documentation_Guide.pdf"
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} />
                <span>Download PDF Guide</span>
              </a>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => setSelectedArticle(null)}
              >
                Close Documentation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
