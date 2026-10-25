import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import {
  Mail,
  Send,
  Inbox,
  FileText,
  Bookmark,
  Reply,
  Sparkles,
  Paperclip,
  Check,
  CheckCheck,
  UserCheck,
  ArrowRight,
  Copy,
  Sliders,
  ExternalLink,
  Tag,
  Clock,
  Trash2,
  Edit3
} from 'lucide-react';

export default function InboxPage() {
  const navigate = useNavigate();
  const { emails, currentUser, setIsAgentDockOpen, sendAgentMessage } = useCRM();

  const [activeFolder, setActiveFolder] = useState('inbox'); // 'inbox' | 'sent' | 'drafts' | 'templates'
  const [selectedInboxId, setSelectedInboxId] = useState(emails[0]?.id || 'email-001');
  const [selectedSentId, setSelectedSentId] = useState('sent-001');
  const [selectedDraftId, setSelectedDraftId] = useState('draft-001');
  const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-001');

  // Reply & Composer state
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);

  // Template test variable overrides
  const [templateVars, setTemplateVars] = useState({
    first_name: 'Priya',
    company: 'Acme Corp',
    user_name: currentUser?.name || 'Elena Rostova',
    next_meeting_date: 'Friday at 10:00 AM',
    deal_value: '$120,000 / year'
  });

  const showToast = (msg) => {
    setActionAlert(msg);
    setTimeout(() => setActionAlert(null), 3000);
  };

  // Sent Emails Dataset
  const sentEmails = [
    {
      id: "sent-001",
      to: "Marcus Vance <marcus.vance@dakini.ai>",
      recipientName: "Marcus Vance",
      subject: "RE: Q3 Enterprise SaaS Discount Escalation & VP Signoff",
      date: "2 hours ago",
      snippet: "Approved 12% multi-year discount for Acme Corp enterprise deployment with 3-year commit...",
      status: "Delivered & Read (Opened 2 times)",
      linkedRecord: { type: "Deal", name: "Acme Enterprise Cloud Migration", company: "Acme Corp" },
      body: `Hi Marcus,

I reviewed the discount escalation request for Acme Corp.

Given that Priya Sharma's committee has approved the autonomous lead scoring scope and committed to a 3-year term with upfront annual billing, I have approved the 12% enterprise tier discount.

Please ensure the revised MSA reflects the SLA guarantee of 99.95% uptime and AWS India data residency.

Best regards,
${currentUser?.name || 'Elena Rostova'}
Sales Director | Dakini AI CRM`
    },
    {
      id: "sent-002",
      to: "Aarav Patel <aarav@aaravpatel.com>",
      recipientName: "Aarav Patel",
      subject: "Follow-up & Dakini AI Product Architecture Deck",
      date: "Yesterday at 4:15 PM",
      snippet: "Hi Aarav, Great connecting earlier today. Attached is our technical architecture overview...",
      status: "Delivered & Read (Opened 4 times)",
      linkedRecord: { type: "Lead", name: "Aarav Patel", company: "Aarav Patel Enterprises" },
      body: `Hi Aarav,

Thank you for your time on our discovery session today.

As requested, I have attached our complete technical architecture deck covering:
1. Real-time fleet telematics integration via REST & Webhook APIs
2. Autonomous AI lead enrichment and qualification workflows
3. SOC2 Type II compliance audit reports and AES-256 data encryption specs

Looking forward to our technical deep-dive on Friday at 10:00 AM IST.

Best regards,
${currentUser?.name || 'Elena Rostova'}
Sales Director | Dakini AI CRM`
    },
    {
      id: "sent-003",
      to: "Vikram Malhotra <vikram.m@tataconsumer.com>",
      recipientName: "Vikram Malhotra",
      subject: "Dakini CRM — Implementation Timeline & Security SOC2 Report",
      date: "Oct 8, 2:30 PM",
      snippet: "Hi Vikram, Attached is the phased rollout plan for your 450 field sales reps...",
      status: "Delivered & Read (Opened 1 time)",
      linkedRecord: { type: "Contact", name: "Vikram Malhotra", company: "Tata Consumer Digital" },
      body: `Hi Vikram,

Following up on our pilot scoping discussion with your IT steering group.

Here is the implementation timeline we propose:
• Week 1-2: ERP and data migration into dedicated Supabase PostgreSQL schema
• Week 3: Autonomous workflow setup and sales rep onboarding
• Week 4: Full production launch across all 450 field reps

Please let me know if your infosec team needs any additional vendor questionnaires completed.

Best regards,
${currentUser?.name || 'Elena Rostova'}
Sales Director | Dakini AI CRM`
    },
    {
      id: "sent-004",
      to: "Priya Sharma <priya@acme.io>",
      recipientName: "Priya Sharma",
      subject: "Acme Enterprise Cloud Migration — DocuSign Executable MSA",
      date: "Oct 5, 5:10 PM",
      snippet: "Hi Priya, Following up on our terms discussion, the executable agreement is ready...",
      status: "Delivered & Read (Opened 5 times)",
      linkedRecord: { type: "Lead", name: "Priya Sharma", company: "Acme Corp" },
      body: `Hi Priya,

Following our terms discussion earlier today, I have uploaded the final Master Services Agreement package to DocuSign.

The agreement includes:
• 3-Year Enterprise Subscription ($120,000 / year)
• Dedicated Slack Connect war-room channel
• Dedicated Solution Architect SLA

Looking forward to welcoming Acme Corp to Dakini AI!

Best regards,
${currentUser?.name || 'Elena Rostova'}
Sales Director | Dakini AI CRM`
    }
  ];

  // Drafts Dataset
  const [draftsList, setDraftsList] = useState([
    {
      id: "draft-001",
      to: "Sunita Rao <sunita.rao@hdfcsec.com>",
      recipientName: "Sunita Rao",
      subject: "Quarterly Business Review & Upsell Proposal for HDFC Logistics",
      date: "Draft saved today, 3:15 PM",
      snippet: "Hi Sunita, Attached is the QBR executive deck covering agent automation metrics and ROI...",
      linkedRecord: { type: "Account", name: "HDFC Securities", company: "HDFC Securities" },
      body: `Hi Sunita,

Hope you are having a productive week.

Ahead of our QBR next Wednesday, I've compiled the adoption metrics from your first 90 days on Dakini AI:
• Lead triage time decreased by 64%
• Rep CRM data logging compliance reached 98%
• 142 enterprise deals tracked across your Mumbai and Bengaluru desks

Given your team's expansion into institutional securities, we've outlined an expansion package including 50 additional user seats and custom automated risk checks.

Looking forward to presenting the full deck next week.

Best regards,
${currentUser?.name || 'Elena Rostova'}
Sales Director | Dakini AI CRM`
    },
    {
      id: "draft-002",
      to: "Amit Verma <amit.v@reliancelogistics.com>",
      recipientName: "Amit Verma",
      subject: "Dedicated VPC Tenant Configuration & API Rate Limits",
      date: "Draft saved yesterday",
      snippet: "Hi Amit, Following your question regarding dedicated tenancy and rate limit throughput...",
      linkedRecord: { type: "Lead", name: "Amit Verma", company: "Reliance Logistics" },
      body: `Hi Amit,

Following up on your questions regarding high-volume event ingestion:

1. Dedicated Single-Tenant VPC: Dakini supports isolated tenant VPCs hosted in AWS ap-south-1 (Mumbai).
2. API Rate Limits: Enterprise tier includes 10,000 webhook events/min with zero latency throttling.
3. Database Replication: Real-time read replicas for your internal BI and analytics pipelines.

Let me know if you would like our cloud architect to join a 15-minute sync this Thursday.

Best regards,
${currentUser?.name || 'Elena Rostova'}
Sales Director | Dakini AI CRM`
    }
  ]);

  // Sales Templates Dataset
  const salesTemplates = [
    {
      id: "tpl-001",
      title: "Inbound Demo Follow-Up & Next Steps",
      category: "Sales Cadence",
      badgeColor: "#2563eb",
      badgeBg: "#dbeafe",
      subject: "Next Steps: {{company}} <> Dakini AI Discovery Session",
      snippet: "Hi {{first_name}}, Great connecting today! As discussed, Dakini AI will help {{company}}...",
      mergeTags: ["{{first_name}}", "{{company}}", "{{user_name}}", "{{next_meeting_date}}"],
      body: `Hi {{first_name}},

Great connecting today!

As discussed during our session, Dakini AI CRM will help {{company}} automate lead triage, eliminate manual data entry, and accelerate enterprise pipeline velocity by up to 40%.

Here are the resources we covered:
• Dakini AI Enterprise Architecture & Real-Time Sync Overview
• SOC2 Type II Security & Data Residency Brief
• Enterprise ROI & Rep Productivity Benchmark Study

Looking forward to our technical deep-dive on {{next_meeting_date}}. Please feel free to invite your IT and security leads.

Best regards,
{{user_name}}
Sales Director | Dakini AI CRM`
    },
    {
      id: "tpl-002",
      title: "Enterprise MSA & DocuSign Package Delivery",
      category: "Closing / Legal",
      badgeColor: "#059669",
      badgeBg: "#d1fae5",
      subject: "Dakini AI Enterprise Agreement & DocuSign Package for {{company}}",
      snippet: "Hi {{first_name}}, Attached is the revised Master Services Agreement (MSA) reflecting...",
      mergeTags: ["{{first_name}}", "{{company}}", "{{user_name}}", "{{deal_value}}"],
      body: `Hi {{first_name}},

Attached and routed via DocuSign is the finalized Master Services Agreement (MSA) reflecting the enterprise tier package we agreed upon for {{company}} (Total Contract Value: {{deal_value}}).

Key commercial highlights included:
1. Enterprise tier platform access with unlimited autonomous AI workflows
2. 99.95% uptime SLA with dedicated enterprise solutions architect
3. Compliant data residency in AWS India with full AES-256 encryption at rest

Please countersign by the end of this week so we can schedule your implementation kickoff.

Best regards,
{{user_name}}
Sales Director | Dakini AI CRM`
    },
    {
      id: "tpl-003",
      title: "Re-engagement / Pipeline Reviver",
      category: "Outbound",
      badgeColor: "#d97706",
      badgeBg: "#fef3c7",
      subject: "Quick question regarding {{company}}'s Q4 pipeline velocity",
      snippet: "Hi {{first_name}}, I noticed {{company}} has been expanding the supply chain footprint...",
      mergeTags: ["{{first_name}}", "{{company}}", "{{user_name}}"],
      body: `Hi {{first_name}},

I noticed {{company}} has recently expanded operations and is scaling out your sales organization.

Enterprise teams in your sector frequently struggle with rep CRM logging compliance and delayed lead routing. With Dakini AI's autonomous copilot, reps save 6+ hours every week while sales leadership gets 100% accurate forecast data.

Would you be open to a brief 10-minute walkthrough this Thursday or Friday?

Best regards,
{{user_name}}
Sales Director | Dakini AI CRM`
    },
    {
      id: "tpl-004",
      title: "Executive Sponsor Introduction & Alignment",
      category: "Executive",
      badgeColor: "#7c3aed",
      badgeBg: "#ede9fe",
      subject: "Executive Briefing: Accelerating ROI with Dakini Autonomous Agents for {{company}}",
      snippet: "Hi {{first_name}}, Introducing our executive solutions leadership to support {{company}}...",
      mergeTags: ["{{first_name}}", "{{company}}", "{{user_name}}"],
      body: `Hi {{first_name}},

Following our strategic review, I would like to introduce Marcus Vance from our executive leadership team.

Marcus partners with enterprise C-level sponsors at companies like {{company}} to ensure complete alignment between CRM modernization, ERP integrations, and tangible revenue growth.

We would love to host a 20-minute executive briefing with your leadership team next week.

Best regards,
{{user_name}}
Sales Director | Dakini AI CRM`
    }
  ];

  // Active items based on selected folder
  const currentInboxEmail = emails.find((e) => e.id === selectedInboxId) || emails[0];
  const currentSentEmail = sentEmails.find((e) => e.id === selectedSentId) || sentEmails[0];
  const currentDraft = draftsList.find((e) => e.id === selectedDraftId) || draftsList[0];
  const currentTemplate = salesTemplates.find((t) => t.id === selectedTemplateId) || salesTemplates[0];

  // Draft editing state
  const [draftSubject, setDraftSubject] = useState(currentDraft?.subject || '');
  const [draftBody, setDraftBody] = useState(currentDraft?.body || '');

  // Render template text with merge tags replaced
  const renderTemplateText = (text) => {
    if (!text) return '';
    return text
      .replace(/\{\{first_name\}\}/g, templateVars.first_name || '{{first_name}}')
      .replace(/\{\{company\}\}/g, templateVars.company || '{{company}}')
      .replace(/\{\{user_name\}\}/g, currentUser?.name || templateVars.user_name || 'Elena Rostova')
      .replace(/\{\{next_meeting_date\}\}/g, templateVars.next_meeting_date || '{{next_meeting_date}}')
      .replace(/\{\{deal_value\}\}/g, templateVars.deal_value || '{{deal_value}}');
  };

  const handleSmartReply = () => {
    setIsReplying(true);
    setReplyText(
      `Hi ${currentInboxEmail.from.split(' ')[0]},\n\nThank you for the update! I have prepared the final agreement terms and attached our technical implementation plan.\n\nLooking forward to speaking next week.\n\nBest regards,\n${currentUser?.name || 'Elena Rostova'}\nSales Director | Dakini AI CRM`
    );
  };

  const handleCopyTemplate = () => {
    const renderedBody = renderTemplateText(currentTemplate.body);
    navigator.clipboard?.writeText(renderedBody);
    showToast(`Template "${currentTemplate.title}" copied to clipboard!`);
  };

  const handleUseTemplateAsDraft = (tpl) => {
    const newDraft = {
      id: `draft-${Date.now()}`,
      to: `${templateVars.first_name} <lead@${templateVars.company.toLowerCase().replace(/\s+/g, '')}.com>`,
      recipientName: templateVars.first_name,
      subject: renderTemplateText(tpl.subject),
      date: "Draft created now",
      snippet: renderTemplateText(tpl.body).slice(0, 80) + '...',
      linkedRecord: { type: "Lead", name: templateVars.first_name, company: templateVars.company },
      body: renderTemplateText(tpl.body)
    };
    setDraftsList([newDraft, ...draftsList]);
    setSelectedDraftId(newDraft.id);
    setDraftSubject(newDraft.subject);
    setDraftBody(newDraft.body);
    setActiveFolder('drafts');
    showToast(`New email draft created from "${tpl.title}" template!`);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Toast Notification */}
      {actionAlert && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '0.75rem 1.25rem',
          borderRadius: 8,
          marginBottom: '1rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{actionAlert}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
            Inbox & Communication
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Email conversations and sales cadence templates automatically synced with Salesforce CRM
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setActiveFolder('drafts');
            const blankDraft = {
              id: `draft-${Date.now()}`,
              to: '',
              recipientName: 'New Recipient',
              subject: 'New Sales Outreach',
              date: 'Draft created just now',
              snippet: 'Start composing your message...',
              linkedRecord: null,
              body: `Hi,\n\nI hope this email finds you well.\n\nBest regards,\n${currentUser?.name || 'Elena Rostova'}`
            };
            setDraftsList([blankDraft, ...draftsList]);
            setSelectedDraftId(blankDraft.id);
            setDraftSubject(blankDraft.subject);
            setDraftBody(blankDraft.body);
            showToast('New blank draft opened for editing.');
          }}
        >
          <Edit3 size={15} />
          <span>Compose New Email</span>
        </button>
      </div>

      {/* 3-Pane Email Layout */}
      <div className="inbox-3pane">

        {/* ========================================================
            PANE 1: FOLDERS NAVIGATION
           ======================================================== */}
        <div className="inbox-folders-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {/* Inbox */}
            <button
              className={`nav-item ${activeFolder === 'inbox' ? 'active' : ''}`}
              onClick={() => {
                setActiveFolder('inbox');
                setIsReplying(false);
              }}
            >
              <Inbox size={16} />
              <span>Inbox</span>
              <span className="nav-item-badge">{emails.length}</span>
            </button>

            {/* Sent */}
            <button
              className={`nav-item ${activeFolder === 'sent' ? 'active' : ''}`}
              onClick={() => {
                setActiveFolder('sent');
                setIsReplying(false);
              }}
            >
              <Send size={16} />
              <span>Sent</span>
              <span className="nav-item-badge" style={{ background: '#e2e8f0', color: '#475569' }}>
                {sentEmails.length}
              </span>
            </button>

            {/* Drafts */}
            <button
              className={`nav-item ${activeFolder === 'drafts' ? 'active' : ''}`}
              onClick={() => {
                setActiveFolder('drafts');
                setIsReplying(false);
                if (currentDraft) {
                  setDraftSubject(currentDraft.subject);
                  setDraftBody(currentDraft.body);
                }
              }}
            >
              <FileText size={16} />
              <span>Drafts</span>
              <span className="nav-item-badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                {draftsList.length}
              </span>
            </button>

            {/* Templates */}
            <button
              className={`nav-item ${activeFolder === 'templates' ? 'active' : ''}`}
              onClick={() => {
                setActiveFolder('templates');
                setIsReplying(false);
              }}
            >
              <Bookmark size={16} />
              <span>Templates</span>
              <span className="nav-item-badge" style={{ background: '#eff6ff', color: '#2563eb' }}>
                {salesTemplates.length}
              </span>
            </button>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '1.5rem', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Connected Mailbox
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
              {currentUser?.email || 'elena.rostova@dakini.ai'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
              Google Workspace Active
            </div>
          </div>
        </div>

        {/* ========================================================
            PANE 2: THREAD & TEMPLATE LIST
           ======================================================== */}
        <div className="inbox-threads-col">

          {/* FOLDER 1: INBOX LIST */}
          {activeFolder === 'inbox' && (
            <div>
              {emails.map((em) => (
                <div
                  key={em.id}
                  className={`inbox-thread-item ${selectedInboxId === em.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedInboxId(em.id);
                    setIsReplying(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                      {em.from.split('<')[0].trim()}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>{em.date}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {em.subject}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {em.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FOLDER 2: SENT LIST */}
          {activeFolder === 'sent' && (
            <div>
              {sentEmails.map((em) => (
                <div
                  key={em.id}
                  className={`inbox-thread-item ${selectedSentId === em.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSentId(em.id);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                      To: {em.recipientName}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>{em.date}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {em.subject}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {em.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FOLDER 3: DRAFTS LIST */}
          {activeFolder === 'drafts' && (
            <div>
              {draftsList.map((dr) => (
                <div
                  key={dr.id}
                  className={`inbox-thread-item ${selectedDraftId === dr.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDraftId(dr.id);
                    setDraftSubject(dr.subject);
                    setDraftBody(dr.body);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#b45309' }}>
                      [Draft] {dr.recipientName}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>{dr.date.split(',')[0]}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dr.subject || '(No subject)'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dr.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FOLDER 4: TEMPLATES LIST */}
          {activeFolder === 'templates' && (
            <div>
              {salesTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`inbox-thread-item ${selectedTemplateId === tpl.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedTemplateId(tpl.id);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: tpl.badgeBg,
                      color: tpl.badgeColor,
                      textTransform: 'uppercase'
                    }}>
                      {tpl.category}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                      {tpl.mergeTags.length} tags
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                    {tpl.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tpl.subject}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tpl.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* ========================================================
            PANE 3: READING PANE & TEMPLATE INSPECTOR
           ======================================================== */}
        <div className="inbox-reading-pane">

          {/* ----------------------------------------------------
              VIEW A: INBOX READING PANE
             ---------------------------------------------------- */}
          {activeFolder === 'inbox' && currentInboxEmail && (
            <div>
              {/* Linked Record Banner */}
              {currentInboxEmail.linkedRecord && (
                <div style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
                  border: '1px solid #bfdbfe',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCheck size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                        Linked {currentInboxEmail.linkedRecord.type}: {currentInboxEmail.linkedRecord.name}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {currentInboxEmail.linkedRecord.company}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/leads')}
                  >
                    View Lead <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Message Header */}
              <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  {currentInboxEmail.subject}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.8125rem' }}>
                    <strong style={{ color: '#0f172a' }}>From:</strong> {currentInboxEmail.from}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{currentInboxEmail.date}</span>
                </div>
              </div>

              {/* Message Body */}
              <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-line', marginBottom: '1.5rem' }}>
                {currentInboxEmail.body}
              </div>

              {/* Reply Section */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                {!isReplying ? (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-primary" onClick={() => setIsReplying(true)}>
                      <Reply size={15} />
                      <span>Reply</span>
                    </button>
                    <button className="btn btn-sparkle" onClick={handleSmartReply}>
                      <Sparkles size={15} />
                      <span>Dakini Smart Reply</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                        Draft Response
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setIsReplying(false)}>
                        Cancel
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      className="input-field"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your email reply..."
                      style={{ marginBottom: '0.75rem', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          showToast("Email dispatched through connected Google Workspace mailbox!");
                          setIsReplying(false);
                        }}
                      >
                        <Send size={15} />
                        <span>Send Email</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW B: SENT READING PANE
             ---------------------------------------------------- */}
          {activeFolder === 'sent' && currentSentEmail && (
            <div>
              {/* Linked Record Banner */}
              {currentSentEmail.linkedRecord && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Send size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                        Linked {currentSentEmail.linkedRecord.type}: {currentSentEmail.linkedRecord.name}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {currentSentEmail.linkedRecord.company}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate('/deals')}
                  >
                    View CRM Record <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Sent Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#065f46',
                  background: '#d1fae5',
                  padding: '3px 8px',
                  borderRadius: 6
                }}>
                  <CheckCheck size={14} color="#059669" />
                  {currentSentEmail.status}
                </span>

                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {currentSentEmail.date}
                </span>
              </div>

              {/* Message Header */}
              <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  {currentSentEmail.subject}
                </h2>
                <div style={{ fontSize: '0.8125rem', color: '#475569' }}>
                  <strong>To:</strong> {currentSentEmail.to}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                  <strong>From:</strong> {currentUser?.name || 'Elena Rostova'} &lt;{currentUser?.email || 'elena.rostova@dakini.ai'}&gt;
                </div>
              </div>

              {/* Message Body */}
              <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-line', marginBottom: '1.5rem' }}>
                {currentSentEmail.body}
              </div>

              {/* Actions */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    handleUseTemplateAsDraft({
                      title: "Follow-up",
                      subject: `Follow-up: ${currentSentEmail.subject}`,
                      body: `Hi ${currentSentEmail.recipientName.split(' ')[0]},\n\nJust wanted to follow up on my previous note below...\n\nBest regards,\n${currentUser?.name || 'Elena Rostova'}`
                    });
                  }}
                >
                  <Reply size={15} />
                  <span>Send Follow-Up</span>
                </button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW C: DRAFTS EDITOR PANE
             ---------------------------------------------------- */}
          {activeFolder === 'drafts' && currentDraft && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-amber">Draft Autosaved</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{currentDraft.date}</span>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#dc2626' }}
                  onClick={() => {
                    setDraftsList(draftsList.filter((d) => d.id !== currentDraft.id));
                    showToast("Draft deleted.");
                  }}
                >
                  <Trash2 size={14} />
                  <span>Discard</span>
                </button>
              </div>

              {/* Recipient Input */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 3 }}>
                  To:
                </label>
                <input
                  type="text"
                  className="input-field"
                  defaultValue={currentDraft.to}
                  placeholder="recipient@company.com"
                />
              </div>

              {/* Subject Input */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 3 }}>
                  Subject:
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  placeholder="Email Subject Line"
                />
              </div>

              {/* Body Textarea */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 3 }}>
                  Email Body:
                </label>
                <textarea
                  rows={10}
                  className="input-field"
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  style={{ fontFamily: 'inherit', lineHeight: 1.6 }}
                />
              </div>

              {/* Draft Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  className="btn btn-sparkle"
                  onClick={() => {
                    setDraftBody(prev => `${prev}\n\nP.S. Let me know if you would like me to configure an enterprise pilot sandbox for your team.`);
                    showToast("AI Copilot added closing proposal hook!");
                  }}
                >
                  <Sparkles size={14} />
                  <span>Dakini AI Enhance</span>
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => showToast("Draft saved locally.")}
                  >
                    Save Draft
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      showToast("Draft dispatched successfully via Google Workspace!");
                      setDraftsList(draftsList.filter((d) => d.id !== currentDraft.id));
                    }}
                  >
                    <Send size={15} />
                    <span>Send Email Now</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
              VIEW D: TEMPLATES WORKSPACE & INTERACTIVE PREVIEW
             ---------------------------------------------------- */}
          {activeFolder === 'templates' && currentTemplate && (
            <div>
              {/* Template Category & Title Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: currentTemplate.badgeBg,
                    color: currentTemplate.badgeColor,
                    textTransform: 'uppercase'
                  }}>
                    {currentTemplate.category}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#059669',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    padding: '2px 8px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}>
                    <Check size={12} />
                    Sales Approved
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyTemplate}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Copy size={14} />
                    <span>Copy Template</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleUseTemplateAsDraft(currentTemplate)}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Send size={14} />
                    <span>Use In New Email</span>
                  </button>
                </div>
              </div>

              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>
                {currentTemplate.title}
              </h2>

              {/* Subject Line Pill */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '0.65rem 0.85rem',
                fontSize: '0.8125rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <strong style={{ color: '#0f172a' }}>Subject:</strong>
                <span style={{ color: '#2563eb', fontWeight: 600 }}>
                  {renderTemplateText(currentTemplate.subject)}
                </span>
              </div>

              {/* Interactive Merge Variable Playground */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 10,
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1e40af', fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                  <Sliders size={14} />
                  <span>Customize Template Merge Variables (Live Preview)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 2 }}>
                      &#123;&#123;first_name&#125;&#125;
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: '#ffffff' }}
                      value={templateVars.first_name}
                      onChange={(e) => setTemplateVars({ ...templateVars, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 2 }}>
                      &#123;&#123;company&#125;&#125;
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: '#ffffff' }}
                      value={templateVars.company}
                      onChange={(e) => setTemplateVars({ ...templateVars, company: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: 2 }}>
                      &#123;&#123;user_name&#125;&#125;
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', background: '#ffffff' }}
                      value={currentUser?.name || templateVars.user_name}
                      onChange={(e) => setTemplateVars({ ...templateVars, user_name: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Rendered Template Body */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '1.25rem',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                color: '#1e293b',
                whiteSpace: 'pre-line',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
              }}>
                {renderTemplateText(currentTemplate.body)}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
