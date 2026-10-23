import React, { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { X, Check } from 'lucide-react';

export default function QuickCreateModal() {
  const {
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    quickCreateType,
    setQuickCreateType,
    addLead,
    addDeal,
    addContact,
    addTask
  } = useCRM();

  if (!isQuickCreateOpen) return null;

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    title: '',
    industry: 'Technology',
    dealValue: '35000',
    dealStage: 'Qualified',
    taskTitle: '',
    taskPriority: 'Medium',
    taskRecord: 'Acme Corp'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (quickCreateType === 'lead') {
      addLead({
        name: formData.name || 'New Prospect',
        company: formData.company || 'Enterprise Corp',
        title: formData.title || 'Director',
        email: formData.email || 'prospect@enterprise.com',
        phone: formData.phone || '+1 555-019-2831',
        industry: formData.industry,
        owner: 'Elena Rostova',
        source: 'Direct Inbound',
        score: Math.floor(Math.random() * 40) + 70
      });
    } else if (quickCreateType === 'deal') {
      addDeal({
        name: formData.name || `${formData.company} Opportunity`,
        company: formData.company || 'Enterprise Corp',
        value: Number(formData.dealValue) || 30000,
        stage: formData.dealStage,
        closeDate: '2026-11-30',
        owner: 'Elena Rostova',
        priority: 'High'
      });
    } else if (quickCreateType === 'contact') {
      addContact({
        name: formData.name || 'New Contact',
        account: formData.company || 'Enterprise Corp',
        title: formData.title || 'VP',
        email: formData.email || 'contact@corp.com',
        phone: formData.phone || '+1 555-010-0000',
        industry: formData.industry
      });
    } else if (quickCreateType === 'task') {
      addTask(formData.taskTitle || 'Follow up with customer', formData.taskRecord, formData.taskPriority);
    }
    setIsQuickCreateOpen(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => setIsQuickCreateOpen(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
              Create New Record
            </h3>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
              {['lead', 'deal', 'contact', 'task'].map((t) => (
                <button
                  key={t}
                  type="button"
                  style={{
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    borderRadius: 6,
                    background: quickCreateType === t ? '#2563eb' : 'transparent',
                    color: quickCreateType === t ? '#ffffff' : '#64748b'
                  }}
                  onClick={() => setQuickCreateType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setIsQuickCreateOpen(false)} style={{ color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {quickCreateType === 'lead' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Lead Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. John Doe"
                      className="input-field"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Company *
                    </label>
                    <input
                      type="text"
                      name="company"
                      required
                      placeholder="e.g. Acme Corp"
                      className="input-field"
                      value={formData.company}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Work Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="name@company.com"
                      className="input-field"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Phone
                    </label>
                    <input
                      type="text"
                      name="phone"
                      placeholder="+1 (555) 000-0000"
                      className="input-field"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Industry
                  </label>
                  <select name="industry" className="input-field" value={formData.industry} onChange={handleChange}>
                    <option value="Logistics">Logistics & Supply Chain</option>
                    <option value="Technology">Technology & SaaS</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Retail">Retail & E-Commerce</option>
                    <option value="Automotive">Automotive</option>
                  </select>
                </div>
              </>
            )}

            {quickCreateType === 'deal' && (
              <>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Deal / Opportunity Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Enterprise Cloud License"
                    className="input-field"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Target Account
                    </label>
                    <input
                      type="text"
                      name="company"
                      placeholder="e.g. TVS Mobility Solutions"
                      className="input-field"
                      value={formData.company}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Deal Value ($)
                    </label>
                    <input
                      type="number"
                      name="dealValue"
                      className="input-field"
                      value={formData.dealValue}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Initial Pipeline Stage
                  </label>
                  <select name="dealStage" className="input-field" value={formData.dealStage} onChange={handleChange}>
                    <option value="Qualified">Qualified</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Negotiation">Negotiation</option>
                  </select>
                </div>
              </>
            )}

            {quickCreateType === 'contact' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Sarah Connor"
                      className="input-field"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Company / Account
                    </label>
                    <input
                      type="text"
                      name="company"
                      placeholder="e.g. Acme Corp"
                      className="input-field"
                      value={formData.company}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="input-field"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            {quickCreateType === 'task' && (
              <>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Task Title *
                  </label>
                  <input
                    type="text"
                    name="taskTitle"
                    required
                    placeholder="e.g. Follow up on procurement review"
                    className="input-field"
                    value={formData.taskTitle}
                    onChange={handleChange}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Associated Record
                    </label>
                    <input
                      type="text"
                      name="taskRecord"
                      className="input-field"
                      value={formData.taskRecord}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Priority
                    </label>
                    <select name="taskPriority" className="input-field" value={formData.taskPriority} onChange={handleChange}>
                      <option value="Normal">Normal</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsQuickCreateOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Check size={16} />
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
