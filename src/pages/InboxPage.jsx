import React, { useState } from 'react';
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
  UserCheck,
  ArrowRight
} from 'lucide-react';

export default function InboxPage() {
  const { emails, navigateTo, setIsAgentDockOpen, sendAgentMessage } = useCRM();
  const [selectedEmail, setSelectedEmail] = useState(emails[0]);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [activeFolder, setActiveFolder] = useState('inbox');

  const handleSmartReply = () => {
    setIsReplying(true);
    setReplyText(
      `Hi ${selectedEmail.from.split(' ')[0]},\n\nThank you for the update! I have prepared the final agreement terms and attached our technical implementation plan.\n\nLooking forward to speaking next week.\n\nBest regards,\nElena Rostova\nSales Director | Dakini AI CRM`
    );
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
            Inbox & Communication
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Email conversations automatically synced to matching Salesforce CRM records
          </p>
        </div>
      </div>

      {/* 3-Pane Email Layout */}
      <div className="inbox-3pane">
        {/* Pane 1: Folders */}
        <div className="inbox-folders-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <button
              className={`nav-item ${activeFolder === 'inbox' ? 'active' : ''}`}
              onClick={() => setActiveFolder('inbox')}
            >
              <Inbox size={16} />
              <span>Inbox</span>
              <span className="nav-item-badge">{emails.length}</span>
            </button>
            <button
              className={`nav-item ${activeFolder === 'sent' ? 'active' : ''}`}
              onClick={() => setActiveFolder('sent')}
            >
              <Send size={16} />
              <span>Sent</span>
            </button>
            <button
              className={`nav-item ${activeFolder === 'drafts' ? 'active' : ''}`}
              onClick={() => setActiveFolder('drafts')}
            >
              <FileText size={16} />
              <span>Drafts</span>
            </button>
            <button
              className={`nav-item ${activeFolder === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveFolder('templates')}
            >
              <Bookmark size={16} />
              <span>Templates</span>
            </button>
          </div>
        </div>

        {/* Pane 2: Thread List */}
        <div className="inbox-threads-col">
          {emails.map((em) => (
            <div
              key={em.id}
              className={`inbox-thread-item ${selectedEmail.id === em.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedEmail(em);
                setIsReplying(false);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                  {em.from.split('<')[0]}
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

        {/* Pane 3: Reading Pane & Linked Record Card */}
        <div className="inbox-reading-pane">
          {selectedEmail ? (
            <div>
              {/* Linked Record Banner */}
              {selectedEmail.linkedRecord && (
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
                        Linked {selectedEmail.linkedRecord.type}: {selectedEmail.linkedRecord.name}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {selectedEmail.linkedRecord.company}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigateTo('leads')}
                  >
                    View Lead <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Message Header */}
              <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  {selectedEmail.subject}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.8125rem' }}>
                    <strong style={{ color: '#0f172a' }}>From:</strong> {selectedEmail.from}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedEmail.date}</span>
                </div>
              </div>

              {/* Message Body */}
              <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-line', marginBottom: '1.5rem' }}>
                {selectedEmail.body}
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
                          alert("Email dispatched through connected Gmail / Outlook mailbox!");
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
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              Select an email thread to read
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
