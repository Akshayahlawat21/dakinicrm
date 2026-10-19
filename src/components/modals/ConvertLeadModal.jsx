import React, { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { X, CheckCircle, ArrowRight, Building2, User, Handshake } from 'lucide-react';

export default function ConvertLeadModal() {
  const { isConvertModalOpen, setIsConvertModalOpen, leadToConvert, convertLead } = useCRM();

  if (!isConvertModalOpen || !leadToConvert) return null;

  const [dealName, setDealName] = useState(`${leadToConvert.company} - Expansion Deal`);
  const [dealAmount, setDealAmount] = useState('45000');
  const [createDeal, setCreateDeal] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    convertLead(leadToConvert, createDeal ? dealName : null, createDeal ? dealAmount : null);
  };

  return (
    <div className="modal-backdrop" onClick={() => setIsConvertModalOpen(false)}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
              Convert Lead: {leadToConvert.name}
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Transform this qualified prospect into active Salesforce CRM records
            </span>
          </div>
          <button onClick={() => setIsConvertModalOpen(false)} style={{ color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Conversion Visual Pathway */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: '1rem'
            }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px auto' }}>
                  <Building2 size={18} />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>New Account</div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{leadToConvert.company}</div>
              </div>

              <ArrowRight size={18} color="#2563eb" />

              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px auto' }}>
                  <User size={18} />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>New Contact</div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{leadToConvert.name}</div>
              </div>

              <ArrowRight size={18} color="#2563eb" />

              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: createDeal ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px auto' }}>
                  <Handshake size={18} />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>Opportunity</div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Pipeline Deal</div>
              </div>
            </div>

            {/* Account Details */}
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Account Name
              </label>
              <input
                type="text"
                className="input-field"
                value={leadToConvert.company}
                readOnly
                style={{ background: '#f8fafc' }}
              />
            </div>

            {/* Contact Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Contact Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={leadToConvert.name}
                  readOnly
                  style={{ background: '#f8fafc' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={leadToConvert.email}
                  readOnly
                  style={{ background: '#f8fafc' }}
                />
              </div>
            </div>

            {/* Deal Toggle & Fields */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={createDeal}
                  onChange={(e) => setCreateDeal(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                  Create Opportunity Deal in Active Pipeline
                </span>
              </label>

              {createDeal && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Opportunity Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={dealName}
                      onChange={(e) => setDealName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Deal Amount ($)
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      value={dealAmount}
                      onChange={(e) => setDealAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsConvertModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} />
              Convert & Open Pipeline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
