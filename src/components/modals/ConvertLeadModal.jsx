import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import { X, CheckCircle, ArrowRight, Building2, User, Handshake, AlertCircle, Loader2 } from 'lucide-react';

export default function ConvertLeadModal() {
  const { isConvertModalOpen, setIsConvertModalOpen, leadToConvert, convertLead, accounts = [], contacts = [], deals = [] } = useCRM();
  const navigate = useNavigate();

  const [accountName, setAccountName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [dealName, setDealName] = useState('');
  const [dealAmount, setDealAmount] = useState('45000');
  const [createDeal, setCreateDeal] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (leadToConvert) {
      const company = leadToConvert.company || leadToConvert.name || 'Enterprise Account';
      const person = leadToConvert.name || 'Enterprise Contact';
      setAccountName(company);
      setContactName(person);
      setContactEmail(leadToConvert.email || '');
      setDealName(leadToConvert.name ? `${leadToConvert.name}'s CRM subscription` : `${company} - Expansion Deal`);
      setDealAmount('45000');
      setCreateDeal(true);
    }
  }, [leadToConvert]);

  if (!isConvertModalOpen || !leadToConvert) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Immediately close modal and perform atomic conversion
      setIsConvertModalOpen(false);
      await convertLead(
        leadToConvert,
        createDeal ? dealName : null,
        createDeal ? dealAmount : null,
        createDeal,
        {
          accountName: accountName.trim() || leadToConvert.company || leadToConvert.name,
          contactName: contactName.trim() || leadToConvert.name,
          contactEmail: contactEmail.trim() || leadToConvert.email,
          contactTitle: leadToConvert.title,
          website: leadToConvert.website,
        }
      );
      if (createDeal) {
        navigate('/deals');
      }
    } catch (err) {
      console.error('Lead conversion failed:', err);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
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
              Transform this qualified prospect into active CRM records
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
              {(() => {
                const targetComp = (accountName || leadToConvert.company || leadToConvert.name || '').trim().toLowerCase();
                const existingAcc = (accounts || []).find((a) => (a.name || '').toLowerCase().trim() === targetComp);
                return (
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: existingAcc ? '#059669' : '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px auto' }}>
                      <Building2 size={18} />
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: existingAcc ? '#059669' : '#0f172a' }}>
                      {existingAcc ? 'Existing Account' : 'New Account'}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: existingAcc ? '#059669' : '#64748b' }}>
                      {existingAcc ? `${existingAcc.name} (Reused)` : (accountName || leadToConvert.company || leadToConvert.name)}
                    </div>
                  </div>
                );
              })()}

              <ArrowRight size={18} color="#2563eb" />

              {(() => {
                const normEmail = (contactEmail || leadToConvert.email || '').trim().toLowerCase();
                const existingCon = normEmail ? (contacts || []).find(c => (c.email || '').trim().toLowerCase() === normEmail) : null;
                return (
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: existingCon ? '#059669' : '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px auto' }}>
                      <User size={18} />
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: existingCon ? '#059669' : '#0f172a' }}>
                      {existingCon ? 'Existing Contact' : 'New Contact'}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: existingCon ? '#059669' : '#64748b' }}>
                      {existingCon ? `${existingCon.name || contactName} (Reused)` : (contactName || leadToConvert.name)}
                    </div>
                  </div>
                );
              })()}

              <ArrowRight size={18} color="#2563eb" />

              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: createDeal ? '#2563eb' : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px auto' }}>
                  <Handshake size={18} />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>Opportunity</div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{createDeal ? 'Pipeline Deal' : 'Skipped'}</div>
              </div>
            </div>

            {/* Account Details */}
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Account Name (Company)
              </label>
              <input
                type="text"
                className="input-field"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Company Name"
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
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="email@example.com"
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
                <>
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
                  {(() => {
                    const targetComp = (accountName || leadToConvert.company || leadToConvert.name || '').trim().toLowerCase();
                    const activeExistingDeal = (deals || []).find((d) =>
                      ((d.company || d.account || '').toLowerCase().trim() === targetComp) &&
                      !['Won', 'Lost', 'Closed Won', 'Closed Lost'].includes(d.stage) &&
                      (d.status === 'open' || !d.status)
                    );
                    if (!activeExistingDeal) return null;
                    return (
                      <div style={{
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: 8,
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'flex-start',
                        marginTop: '0.75rem'
                      }}>
                        <AlertCircle size={16} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ fontSize: '0.75rem', color: '#92400e', lineHeight: 1.4 }}>
                          <strong>Active Deal Notice:</strong> An active deal <em>"{activeExistingDeal.name}"</em> (${Number(activeExistingDeal.amount || activeExistingDeal.value || 0).toLocaleString()}, Stage: {activeExistingDeal.stage}) already exists for {accountName || leadToConvert.company}. Converting creates a separate opportunity or repeat purchase while preserving all history.
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsConvertModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Convert & Open Pipeline
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
