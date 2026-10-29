import React, { useState, useEffect, useRef } from 'react';
import { useCRM } from '../../context/CRMContext';
import { X, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import CountryPhoneInput from '../common/CountryPhoneInput';

const INITIAL_FORM_DATA = {
  name: '',
  company: '',
  email: '',
  phone: '',
  title: '',
  interestedProduct: '',
  productId: null,
  industry: 'Technology',
  source: 'LinkedIn Ad',
  dealValue: '35000',
  dealStage: 'Qualified',
  taskTitle: '',
  taskPriority: 'Medium',
  taskRecord: 'Acme Corp',
  campaignName: '',
  campaignType: 'Roadshow & In-Person',
  campaignBudget: '25000',
  campaignStatus: 'Active',
  accountName: '',
  website: '',
  city: ''
};

const ENTITY_CONFIG = {
  account: { title: 'Create New Account', button: 'Save Account' },
  deal: { title: 'Create New Deal', button: 'Save Deal' },
  lead: { title: 'Create New Lead', button: 'Save Lead' },
  contact: { title: 'Create New Contact', button: 'Save Contact' },
  task: { title: 'Create New Task', button: 'Save Task' },
  campaign: { title: 'Create New Campaign', button: 'Save Campaign' }
};

export default function QuickCreateModal() {
  const {
    isQuickCreateOpen,
    setIsQuickCreateOpen,
    quickCreateType,
    setQuickCreateType,
    showTypeSelector = false,
    addLead,
    addDeal,
    deals = [],
    products = [],
    addProduct,
    fetchProducts,
    addAccount,
    addContact,
    addTask,
    addCampaign,
    currentUser,
    checkDuplicateLead,
    checkDuplicateDeal,
    checkDuplicateAccount,
    checkDuplicateContact,
    setCurrentTab,
  } = useCRM();

  // Form & error states (must be declared before any conditional return)
  const currentConfig = ENTITY_CONFIG[quickCreateType] || {
    title: 'Create New Record',
    button: 'Save Record'
  };
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [dealPurchaseType, setDealPurchaseType] = useState('New Opportunity');
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [leadDuplicateWarning, setLeadDuplicateWarning] = useState(null);
  const [confirmSeparateInquiry, setConfirmSeparateInquiry] = useState(false);
  const [dealDuplicateWarning, setDealDuplicateWarning] = useState(null);
  const [accountDuplicateWarning, setAccountDuplicateWarning] = useState(null);
  const [confirmSeparateAccount, setConfirmSeparateAccount] = useState(false);
  const [contactDuplicateWarning, setContactDuplicateWarning] = useState(null);
  const [confirmSeparateContact, setConfirmSeparateContact] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const sourceDropdownRef = useRef(null);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  const SOURCE_PRESETS = [
    'LinkedIn Ad',
    'Google Ads',
    'Website Inbound',
    'Cold Outreach',
    'Referral',
    'Email Campaign',
    'Webinar / Event',
    'Partner Network',
    'Organic Search',
  ];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target)) {
        setIsSourceOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isQuickCreateOpen) {
      setErrorMsg(null);
      setIsSubmitting(false);
      setFormData(INITIAL_FORM_DATA);
      setDealPurchaseType('New Opportunity');
      setConfirmedDuplicate(false);
      setLeadDuplicateWarning(null);
      setConfirmSeparateInquiry(false);
      setDealDuplicateWarning(null);
      setAccountDuplicateWarning(null);
      setConfirmSeparateAccount(false);
      setContactDuplicateWarning(null);
      setConfirmSeparateContact(false);
      setIsSourceOpen(false);
      setIsProductDropdownOpen(false);
      setIsCreatingProduct(false);
    } else if (products.length === 0 && fetchProducts) {
      fetchProducts();
    }
  }, [isQuickCreateOpen, products.length, fetchProducts]);

  // Live duplicate checking for Leads: warn ONLY if all 3 match (name + email + interested product)
  useEffect(() => {
    let active = true;
    const hasName = Boolean(formData.name && formData.name.trim().length >= 2);
    const hasEmail = Boolean(formData.email && formData.email.trim().includes('@'));
    const hasProduct = Boolean(
      (formData.interestedProduct && formData.interestedProduct.trim().length > 0) ||
      formData.productId
    );

    // Give warning only if all 3 are present: name + email + interested product
    if (quickCreateType === 'lead' && hasName && hasEmail && hasProduct) {
      const timer = setTimeout(async () => {
        try {
          if (checkDuplicateLead) {
            const res = await checkDuplicateLead({
              name: formData.name.trim() || undefined,
              email: formData.email.trim() || undefined,
              company: formData.company.trim() || undefined,
              title: formData.title.trim() || undefined,
              interested_product: formData.interestedProduct?.trim() || undefined,
              product_id: formData.productId || undefined,
            });
            const actualRes = res?.data !== undefined ? res.data : res;
            if (active) {
              if (actualRes?.is_duplicate_warning || actualRes?.has_existing_contact || actualRes?.is_cross_sell) {
                setLeadDuplicateWarning(actualRes);
              } else {
                setLeadDuplicateWarning(null);
              }
            }
          }
        } catch (e) {
          console.warn('Lead duplicate check failed:', e);
        }
      }, 350);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setLeadDuplicateWarning(null);
    }
  }, [
    quickCreateType,
    formData.name,
    formData.email,
    formData.company,
    formData.title,
    formData.interestedProduct,
    formData.productId,
    checkDuplicateLead,
  ]);

  // Live duplicate checking for Deals
  useEffect(() => {
    let active = true;
    if (quickCreateType === 'deal' && (formData.company?.trim() || formData.name?.trim())) {
      const timer = setTimeout(async () => {
        try {
          if (checkDuplicateDeal) {
            const res = await checkDuplicateDeal({
              company: formData.company.trim(),
              name: formData.name.trim(),
              opportunity_reference: dealPurchaseType !== 'New Opportunity' ? dealPurchaseType : undefined,
            });
            if (active) {
              if (res?.is_duplicate_warning) {
                setDealDuplicateWarning(res);
              } else {
                setDealDuplicateWarning(null);
              }
            }
          }
        } catch (e) {
          console.warn('Deal duplicate check failed:', e);
        }
      }, 350);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setDealDuplicateWarning(null);
    }
  }, [quickCreateType, formData.company, formData.name, dealPurchaseType, checkDuplicateDeal]);

  // Live duplicate checking for Accounts: warn when company name + industry match (+ location)
  useEffect(() => {
    let active = true;
    const accountName = (formData.name || formData.accountName || '').trim();
    const hasName = Boolean(accountName.length >= 2);
    const hasIndustry = Boolean((formData.industry || '').trim());

    if (quickCreateType === 'account' && hasName && hasIndustry) {
      const timer = setTimeout(async () => {
        try {
          if (checkDuplicateAccount) {
            const res = await checkDuplicateAccount({
              name: accountName,
              industry: formData.industry.trim(),
              location: (formData.city || '').trim() || undefined,
            });
            const actualRes = res?.data !== undefined ? res.data : res;
            if (active) {
              if (actualRes?.is_duplicate_warning) {
                setAccountDuplicateWarning(actualRes);
              } else {
                setAccountDuplicateWarning(null);
              }
            }
          }
        } catch (e) {
          console.warn('Account duplicate check failed:', e);
        }
      }, 350);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setAccountDuplicateWarning(null);
    }
  }, [
    quickCreateType,
    formData.name,
    formData.accountName,
    formData.industry,
    formData.city,
    checkDuplicateAccount,
  ]);

  // Live duplicate checking for Contacts: warn ONLY if name + company + email match (+ optional job title)
  useEffect(() => {
    let active = true;
    const contactName = (formData.name || '').trim();
    const contactCompany = (formData.company || '').trim();
    const contactEmail = (formData.email || '').trim();
    const contactTitle = (formData.title || '').trim();

    const hasName = Boolean(contactName.length >= 2);
    const hasCompany = Boolean(contactCompany.length >= 2);
    const hasEmail = Boolean(contactEmail.includes('@'));

    if (quickCreateType === 'contact' && hasName && hasCompany && hasEmail) {
      const timer = setTimeout(async () => {
        try {
          if (checkDuplicateContact) {
            const res = await checkDuplicateContact({
              name: contactName,
              company: contactCompany,
              email: contactEmail,
              title: contactTitle || undefined,
            });
            const actualRes = res?.data !== undefined ? res.data : res;
            if (active) {
              if (actualRes?.is_duplicate_warning) {
                setContactDuplicateWarning(actualRes);
              } else {
                setContactDuplicateWarning(null);
              }
            }
          }
        } catch (e) {
          console.warn('Contact duplicate check failed:', e);
        }
      }, 350);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setContactDuplicateWarning(null);
    }
  }, [
    quickCreateType,
    formData.name,
    formData.company,
    formData.email,
    formData.title,
    checkDuplicateContact,
  ]);


  // Real-time active deal duplicate detection fallback
  const activeExistingDeal =
    quickCreateType === 'deal' && (formData.company || '').trim().length > 1
      ? (deals || []).find(
          (d) =>
            ((d.company || d.account || '').toLowerCase().trim() === (formData.company || '').toLowerCase().trim()) &&
            !['Won', 'Lost', 'Closed Won', 'Closed Lost'].includes(d.stage) &&
            (d.status === 'open' || !d.status)
        )
      : null;

  if (!isQuickCreateOpen) return null;

  const handleChange = (e) => {
    if (errorMsg) setErrorMsg(null);
    setConfirmedDuplicate(false);
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTypeChange = (t) => {
    setErrorMsg(null);
    setConfirmedDuplicate(false);
    setLeadDuplicateWarning(null);
    setConfirmSeparateInquiry(false);
    setDealDuplicateWarning(null);
    setQuickCreateType(t);
  };

  const executeSaveDeal = async (bypassDuplicate = false) => {
    const hasDealConflict = dealDuplicateWarning || activeExistingDeal;
    if (hasDealConflict && !bypassDuplicate && !confirmedDuplicate) {
      // Don't auto-block! Prompt the salesperson with warning and confirmation
      return;
    }
    const dynamicOwner = currentUser?.name || 'Sales Representative';
    const typeTag = dealPurchaseType && dealPurchaseType !== 'New Opportunity' ? `[${dealPurchaseType}] ` : '';
    const baseDealName = formData.name.trim() || `${formData.company.trim() || 'Enterprise'} Opportunity`;
    const finalDealName = baseDealName.startsWith('[') ? baseDealName : `${typeTag}${baseDealName}`;

    const res = await addDeal({
      name: finalDealName,
      company: formData.company.trim() || 'Enterprise Corp',
      value: Number(formData.dealValue) || 30000,
      stage: formData.dealStage,
      closeDate: '2026-11-30',
      owner: dynamicOwner,
      priority: 'High',
      opportunity_reference: dealPurchaseType !== 'New Opportunity' ? dealPurchaseType : undefined,
    });

    if (res && res.success === false) {
      setErrorMsg(res.error?.message || 'Failed to create deal.');
      setIsSubmitting(false);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    if (quickCreateType === 'deal' && (dealDuplicateWarning || activeExistingDeal) && !confirmedDuplicate) {
      // Prompt user with warning rather than automatically blocking
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    const dynamicOwner = currentUser?.name || 'Sales Representative';

    try {
      if (quickCreateType === 'lead') {
        const hasAllThree = Boolean(
          formData.name?.trim() &&
          formData.email?.trim() &&
          (formData.interestedProduct?.trim() || formData.productId)
        );

        // Enforce duplicate check before saving if all 3 match (name + email + product)
        let dupCheck = leadDuplicateWarning;
        if (!dupCheck && checkDuplicateLead && hasAllThree) {
          try {
            const checkRes = await checkDuplicateLead({
              name: formData.name.trim() || undefined,
              email: formData.email.trim() || undefined,
              company: formData.company.trim() || undefined,
              title: formData.title.trim() || undefined,
              interested_product: formData.interestedProduct?.trim() || undefined,
              product_id: formData.productId || undefined,
            });
            dupCheck = checkRes?.data !== undefined ? checkRes.data : checkRes;
          } catch (e) {
            console.warn('Pre-submit duplicate check skipped:', e);
          }
        }

        if (dupCheck?.is_duplicate_warning && !confirmSeparateInquiry) {
          setLeadDuplicateWarning(dupCheck);
          setErrorMsg(
            dupCheck.warning_message ||
            'A lead with matching details already exists in this organization. Please confirm if this is a separate inquiry before proceeding.'
          );
          setIsSubmitting(false);
          return;
        }

        const res = await addLead({
          name: formData.name.trim() || 'New Prospect',
          company: formData.company.trim() || 'Enterprise Corp',
          title: formData.title.trim() || '',
          website: formData.website.trim() || null,
          email: formData.email.trim(),
          phone: formData.phone.trim() || '+1 555-019-2831',
          industry: formData.industry,
          owner: dynamicOwner,
          source: formData.source.trim() || 'LinkedIn Ad',
          score: Math.floor(Math.random() * 40) + 70,
          product_id: formData.productId || null,
          interested_product: formData.interestedProduct?.trim() || null,
          allow_separate_inquiry: confirmSeparateInquiry,
        });

        if (res && res.success === false) {
          setErrorMsg(
            res.error?.message ||
            (formData.email.trim()
              ? `A lead with email "${formData.email.trim()}" already exists in the organization database.`
              : 'Failed to create lead. Please check your inputs.')
          );
          setIsSubmitting(false);
          return;
        }
      } else if (quickCreateType === 'deal') {
        const ok = await executeSaveDeal(confirmedDuplicate);
        if (!ok) return;
      } else if (quickCreateType === 'account') {
        if (accountDuplicateWarning && !confirmSeparateAccount) {
          setErrorMsg(accountDuplicateWarning.warning_message || 'Please confirm creating a separate account or use the existing account.');
          setIsSubmitting(false);
          return;
        }
        await addAccount({
          name: formData.accountName.trim() || formData.name.trim() || formData.company.trim() || 'New Enterprise Account',
          industry: formData.industry || 'Logistics & Tech',
          website: formData.website.trim() || '',
          phone: formData.phone.trim() || '',
          city: formData.city.trim() || '',
          address: formData.city.trim() || '',
          allow_separate_account: confirmSeparateAccount,
        });
      } else if (quickCreateType === 'contact') {
        if (contactDuplicateWarning && !confirmSeparateContact) {
          setErrorMsg(contactDuplicateWarning.warning_message || 'Please confirm creating a separate contact or use the existing contact.');
          setIsSubmitting(false);
          return;
        }
        await addContact({
          name: formData.name.trim() || 'New Contact',
          account: formData.company.trim() || 'Enterprise Corp',
          title: formData.title.trim() || '',
          email: formData.email.trim() || '',
          phone: formData.phone.trim() || '',
          industry: formData.industry,
          allow_separate_contact: confirmSeparateContact,
        });
      } else if (quickCreateType === 'task') {
        await addTask(formData.taskTitle.trim() || 'Follow up with customer', formData.taskRecord, formData.taskPriority);
      } else if (quickCreateType === 'campaign') {
        await addCampaign({
          name: formData.campaignName.trim() || formData.name.trim() || 'Q4 Growth Roadshow',
          type: formData.campaignType || 'Roadshow & In-Person',
          budget: Number(formData.campaignBudget) || 25000,
          status: formData.campaignStatus || 'Active',
          spent: 0,
          leadsGenerated: 0,
          pipelineValue: 0,
          roi: '0%'
        });
      }

      setIsSubmitting(false);
      setIsQuickCreateOpen(false);
      setFormData(INITIAL_FORM_DATA);
    } catch (err) {
      console.error('Quick create failed:', err);
      setErrorMsg(err.message || 'An unexpected error occurred while saving.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && setIsQuickCreateOpen(false)}>
      <div className="modal-box" style={{ maxWidth: 640, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
              {currentConfig.title}
            </h3>
            {showTypeSelector && (
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2, flexWrap: 'wrap', gap: 2 }}>
                {['lead', 'deal', 'account', 'contact', 'task', 'campaign'].map((t) => (
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
                    onClick={() => handleTypeChange(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => !isSubmitting && setIsQuickCreateOpen(false)}
            disabled={isSubmitting}
            style={{ color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Professional Alert Banner when conflict or error occurs */}
            {errorMsg && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  color: '#991b1b',
                  boxShadow: '0 1px 2px rgba(220, 38, 38, 0.05)',
                }}
              >
                <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#991b1b', marginBottom: 2 }}>
                    Duplicate Record Conflict
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#b91c1c', lineHeight: 1.4 }}>
                    {errorMsg}
                  </div>
                </div>
              </div>
            )}
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
                    <CountryPhoneInput
                      label="Phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(555) 000-0000"
                    />
                  </div>
                </div>

                {leadDuplicateWarning?.is_cross_sell && (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}>
                    <Check size={18} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.45, color: '#166534' }}>
                      <strong style={{ display: 'block', marginBottom: 2 }}>
                        ✨ Cross-Sell Opportunity Identified
                      </strong>
                      <span>
                        {leadDuplicateWarning.notice_message ||
                          `Existing customer has an active lead, but this inquiry is for a different product. You can proceed with saving.`}
                      </span>
                    </div>
                  </div>
                )}

                {leadDuplicateWarning?.is_duplicate_warning && (
                  <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={18} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.45 }}>
                      <strong style={{ color: '#92400e', display: 'block', marginBottom: 2 }}>
                        Possible Duplicate Lead Detected
                      </strong>
                      <span style={{ color: '#b45309' }}>
                        {leadDuplicateWarning.warning_message}
                      </span>
                      {leadDuplicateWarning.existing_lead_id && (
                        <div style={{ marginTop: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsQuickCreateOpen(false);
                              if (setCurrentTab) setCurrentTab('leads');
                            }}
                            style={{
                              fontSize: '0.75rem',
                              color: '#2563eb',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontWeight: 600,
                            }}
                          >
                            Open Existing Lead ({leadDuplicateWarning.existing_lead_name})
                          </button>
                        </div>
                      )}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        marginTop: '0.5rem',
                        color: '#78350f',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={confirmSeparateInquiry}
                          onChange={(e) => setConfirmSeparateInquiry(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span>Confirm this is a legitimate separate inquiry (preserves both records)</span>
                      </label>
                    </div>
                  </div>
                )}

                {leadDuplicateWarning?.has_existing_contact && (
                  <div style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 8,
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    gap: '0.6rem',
                    alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={16} color="#2563eb" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ fontSize: '0.78125rem', color: '#1e40af', lineHeight: 1.4 }}>
                      <strong>Existing Contact Record:</strong> {leadDuplicateWarning.notice_message}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                  <div ref={sourceDropdownRef} style={{ position: 'relative' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Lead Source
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        name="source"
                        placeholder="Select or type custom source..."
                        className="input-field"
                        style={{ paddingRight: '2.25rem', cursor: 'text' }}
                        value={formData.source}
                        onChange={(e) => {
                          handleChange(e);
                          if (!isSourceOpen) setIsSourceOpen(true);
                        }}
                        onClick={() => setIsSourceOpen((prev) => !prev)}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setIsSourceOpen((prev) => !prev)}
                        title="Toggle source options"
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.25rem',
                        }}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transition: 'transform 0.2s ease',
                            transform: isSourceOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        />
                      </button>
                    </div>

                    {/* Styled Dropdown Menu */}
                    {isSourceOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                          zIndex: 100,
                          maxHeight: 220,
                          overflowY: 'auto',
                          padding: '0.35rem',
                        }}
                      >
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.35rem 0.6rem 0.2rem 0.6rem' }}>
                          Select or Type Custom
                        </div>
                        {SOURCE_PRESETS.map((preset) => {
                          const isSelected = (formData.source || '').trim().toLowerCase() === preset.toLowerCase();
                          return (
                            <div
                              key={preset}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, source: preset }));
                                setIsSourceOpen(false);
                              }}
                              style={{
                                padding: '0.5rem 0.65rem',
                                fontSize: '0.8125rem',
                                color: isSelected ? '#2563eb' : '#0f172a',
                                fontWeight: isSelected ? 700 : 500,
                                background: isSelected ? '#eff6ff' : 'transparent',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <span>{preset}</span>
                              {isSelected && <Check size={14} color="#2563eb" strokeWidth={2.5} />}
                            </div>
                          );
                        })}

                        {/* Custom source badge if user typed something not in presets */}
                        {formData.source?.trim() &&
                          !SOURCE_PRESETS.some((p) => p.toLowerCase() === formData.source.trim().toLowerCase()) && (
                            <div
                              onClick={() => setIsSourceOpen(false)}
                              style={{
                                borderTop: '1px solid #f1f5f9',
                                marginTop: '0.35rem',
                                paddingTop: '0.4rem',
                                padding: '0.45rem 0.65rem',
                                fontSize: '0.8125rem',
                                color: '#059669',
                                fontWeight: 600,
                                background: '#ecfdf5',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <span>✍️ Use custom: "{formData.source.trim()}"</span>
                            </div>
                          )}

                        <div
                          style={{
                            borderTop: '1px solid #f1f5f9',
                            marginTop: '0.35rem',
                            padding: '0.4rem 0.65rem 0.2rem 0.65rem',
                            fontSize: '0.6875rem',
                            color: '#64748b',
                            fontStyle: 'italic',
                          }}
                        >
                          Tip: Pick from list or type directly in the box to use a custom source.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 4: Job Title / Role & Interested Product (Placed before Website per user specification) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Job Title / Role
                    </label>
                    <input
                      type="text"
                      name="title"
                      placeholder="e.g. VP of Operations"
                      className="input-field"
                      value={formData.title}
                      onChange={handleChange}
                    />
                  </div>
                  <div ref={productDropdownRef} style={{ position: 'relative' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Interested Product
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        name="interestedProduct"
                        placeholder="Select or type new product..."
                        className="input-field"
                        style={{ paddingRight: '2.25rem', cursor: 'text' }}
                        value={formData.interestedProduct}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = products.find((p) => p.name.toLowerCase() === val.trim().toLowerCase());
                          setFormData((prev) => ({
                            ...prev,
                            interestedProduct: val,
                            productId: matched ? matched.id : null,
                          }));
                          if (!isProductDropdownOpen) setIsProductDropdownOpen(true);
                        }}
                        onClick={() => setIsProductDropdownOpen((prev) => !prev)}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setIsProductDropdownOpen((prev) => !prev)}
                        title="Toggle products list"
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.25rem',
                        }}
                      >
                        <ChevronDown
                          size={16}
                          style={{
                            transition: 'transform 0.2s ease',
                            transform: isProductDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        />
                      </button>
                    </div>

                    {/* Products Creatable Dropdown Menu */}
                    {isProductDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '4px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                          zIndex: 110,
                          maxHeight: 230,
                          overflowY: 'auto',
                          padding: '0.35rem',
                        }}
                      >
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.35rem 0.6rem 0.2rem 0.6rem' }}>
                          Product Catalog ({products.length})
                        </div>
                        {products
                          .filter((prod) =>
                            !formData.interestedProduct ||
                            prod.name.toLowerCase().includes(formData.interestedProduct.toLowerCase()) ||
                            (prod.sku && prod.sku.toLowerCase().includes(formData.interestedProduct.toLowerCase()))
                          )
                          .map((prod) => {
                            const isSelected =
                              formData.productId === prod.id ||
                              (formData.interestedProduct || '').trim().toLowerCase() === prod.name.toLowerCase();
                            return (
                              <div
                                key={prod.id}
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    interestedProduct: prod.name,
                                    productId: prod.id,
                                  }));
                                  setIsProductDropdownOpen(false);
                                }}
                                style={{
                                  padding: '0.5rem 0.65rem',
                                  fontSize: '0.8125rem',
                                  color: isSelected ? '#2563eb' : '#0f172a',
                                  fontWeight: isSelected ? 700 : 500,
                                  background: isSelected ? '#eff6ff' : 'transparent',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  transition: 'background 0.1s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <div>
                                  <div>{prod.name}</div>
                                  {prod.sku && <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>SKU: {prod.sku}</div>}
                                </div>
                                {isSelected && <Check size={14} color="#2563eb" strokeWidth={2.5} />}
                              </div>
                            );
                          })}

                        {/* Type-to-Create option if user types something not in catalog */}
                        {formData.interestedProduct?.trim() &&
                          !products.some((p) => p.name.toLowerCase() === formData.interestedProduct.trim().toLowerCase()) && (
                            <div
                              onClick={async () => {
                                const typedName = formData.interestedProduct.trim();
                                if (!typedName) return;
                                setIsCreatingProduct(true);
                                try {
                                  if (addProduct) {
                                    const res = await addProduct({ name: typedName });
                                    if (res?.success && res.data) {
                                      setFormData((prev) => ({
                                        ...prev,
                                        interestedProduct: res.data.name,
                                        productId: res.data.id,
                                      }));
                                    }
                                  }
                                } catch (e) {
                                  console.warn('Could not pre-save product:', e);
                                } finally {
                                  setIsCreatingProduct(false);
                                  setIsProductDropdownOpen(false);
                                }
                              }}
                              style={{
                                borderTop: '1px solid #f1f5f9',
                                marginTop: '0.35rem',
                                paddingTop: '0.4rem',
                                padding: '0.45rem 0.65rem',
                                fontSize: '0.8125rem',
                                color: '#059669',
                                fontWeight: 600,
                                background: '#ecfdf5',
                                borderRadius: 6,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>✨ + Save "{formData.interestedProduct.trim()}" to Catalog</span>
                              {isCreatingProduct && <Loader2 size={12} className="spin-animate" />}
                            </div>
                          )}

                        <div
                          style={{
                            borderTop: '1px solid #f1f5f9',
                            marginTop: '0.35rem',
                            padding: '0.4rem 0.65rem 0.2rem 0.65rem',
                            fontSize: '0.6875rem',
                            color: '#64748b',
                            fontStyle: 'italic',
                          }}
                        >
                          Tip: Select existing or type any product — it automatically saves with an ID for future leads.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 5: Website (Optional) — Positioned lower per user specification */}
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Website <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="website"
                    placeholder="e.g. https://abctech.com"
                    className="input-field"
                    value={formData.website}
                    onChange={handleChange}
                  />
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

                {(dealDuplicateWarning || activeExistingDeal) && (
                  <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start'
                  }}>
                    <AlertCircle size={18} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.45 }}>
                      <strong style={{ color: '#92400e', display: 'block', marginBottom: 2 }}>
                        Similar Active Opportunity Detected
                      </strong>
                      <div style={{ color: '#b45309' }}>
                        <strong>Deal:</strong> {dealDuplicateWarning?.existing_deal_name || activeExistingDeal?.name || 'Active Opportunity'} | {' '}
                        <strong>Amount:</strong> ${Number(dealDuplicateWarning?.existing_amount || activeExistingDeal?.amount || activeExistingDeal?.value || 0).toLocaleString()} | {' '}
                        <strong>Stage:</strong> {dealDuplicateWarning?.existing_stage || activeExistingDeal?.stage} | {' '}
                        <strong>Owner:</strong> {dealDuplicateWarning?.existing_owner || activeExistingDeal?.owner || 'Assigned Rep'}
                        {dealDuplicateWarning?.existing_created_at && (
                          <span> | <strong>Created:</strong> {new Date(dealDuplicateWarning.existing_created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div style={{ color: '#78350f', marginTop: 4, fontSize: '0.75rem' }}>
                        💡 <em>Dakini CRM preserves all past orders. If this is a repeat purchase, subscription renewal, or additional license, confirm as a separate opportunity below.</em>
                      </div>
                      <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsQuickCreateOpen(false);
                            if (setCurrentTab) setCurrentTab('deals');
                          }}
                          style={{
                            fontSize: '0.75rem',
                            color: '#2563eb',
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            fontWeight: 600,
                          }}
                        >
                          Open Existing Deal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Purchase / Opportunity Type
                    </label>
                    <select
                      className="input-field"
                      value={dealPurchaseType}
                      onChange={(e) => setDealPurchaseType(e.target.value)}
                    >
                      <option value="New Opportunity">New Opportunity</option>
                      <option value="Repeat Purchase / Add-on">Repeat Purchase / Add-on</option>
                      <option value="Subscription Renewal">Subscription Renewal</option>
                      <option value="Additional Licenses">Additional Licenses</option>
                      <option value="Expansion / Upgrade">Expansion / Upgrade</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {quickCreateType === 'account' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Company / Account Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Acme Corporation"
                      className="input-field"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Industry *
                    </label>
                    <select name="industry" className="input-field" value={formData.industry} onChange={handleChange}>
                      <option value="Logistics">Logistics & Supply Chain</option>
                      <option value="Technology">Technology & SaaS</option>
                      <option value="Financial Services">Financial Services</option>
                      <option value="Healthcare">Healthcare & Bio</option>
                      <option value="Retail">Retail & E-commerce</option>
                      <option value="Manufacturing">Manufacturing</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Website URL <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      name="website"
                      placeholder="e.g. acmecorp.com"
                      className="input-field"
                      value={formData.website}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <CountryPhoneInput
                      label="Phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(555) 000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Headquarters / Address
                  </label>
                  <input
                    type="text"
                    name="city"
                    placeholder="e.g. San Francisco, CA / Bengaluru, India"
                    className="input-field"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>

                {accountDuplicateWarning && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '0.5rem',
                    marginTop: '0.75rem',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={18} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.45 }}>
                      <strong style={{ color: '#92400e', display: 'block', marginBottom: 2 }}>
                        Possible Duplicate Account Detected
                      </strong>
                      <span style={{ color: '#b45309' }}>
                        {accountDuplicateWarning.warning_message}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', color: '#78350f', fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={confirmSeparateAccount}
                          onChange={(e) => setConfirmSeparateAccount(e.target.checked)}
                          style={{ accentColor: '#d97706' }}
                        />
                        <span>Confirm this is a legitimate separate account (preserves both records)</span>
                      </label>
                    </div>
                  </div>
                )}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Job Title / Role
                    </label>
                    <input
                      type="text"
                      name="title"
                      placeholder="e.g. Software Engineer / VP"
                      className="input-field"
                      value={formData.title}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Email Address
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
                </div>
                <div>
                  <CountryPhoneInput
                    label="Phone Number"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(555) 000-0000"
                  />
                </div>

                {contactDuplicateWarning && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '0.5rem',
                    marginTop: '0.75rem',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}>
                    <AlertCircle size={18} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.45 }}>
                      <strong style={{ color: '#92400e', display: 'block', marginBottom: 2 }}>
                        Possible Duplicate Contact Detected
                      </strong>
                      <span style={{ color: '#b45309' }}>
                        {contactDuplicateWarning.warning_message}
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', color: '#78350f', fontWeight: 500 }}>
                        <input
                          type="checkbox"
                          checked={confirmSeparateContact}
                          onChange={(e) => setConfirmSeparateContact(e.target.checked)}
                          style={{ accentColor: '#d97706' }}
                        />
                        <span>Confirm this is a legitimate separate contact (preserves both records)</span>
                      </label>
                    </div>
                  </div>
                )}
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

            {quickCreateType === 'campaign' && (
              <>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    name="campaignName"
                    required
                    placeholder="e.g. Q4 Autonomous Logistics Roadshow"
                    className="input-field"
                    value={formData.campaignName}
                    onChange={handleChange}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Campaign Type
                    </label>
                    <select name="campaignType" className="input-field" value={formData.campaignType} onChange={handleChange}>
                      <option value="Roadshow & In-Person">Roadshow & In-Person</option>
                      <option value="Webinar Series">Webinar Series</option>
                      <option value="Digital Ads & Content">Digital Ads & Content</option>
                      <option value="Email Outreach">Email Outreach</option>
                      <option value="Partner Co-Marketing">Partner Co-Marketing</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Budget ($ USD) *
                    </label>
                    <input
                      type="number"
                      name="campaignBudget"
                      required
                      min="100"
                      step="500"
                      placeholder="25000"
                      className="input-field"
                      value={formData.campaignBudget}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Status
                  </label>
                  <select name="campaignStatus" className="input-field" value={formData.campaignStatus} onChange={handleChange}>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            {quickCreateType === 'deal' && (dealDuplicateWarning || activeExistingDeal) && !confirmedDuplicate ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.78125rem', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={16} color="#d97706" />
                  <span>A similar active Opportunity already exists. Do you want to proceed as a distinct deal?</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      setErrorMsg(null);
                      setIsQuickCreateOpen(false);
                    }}
                  >
                    Cancel / Review
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    style={{ background: '#d97706', borderColor: '#b45309' }}
                    onClick={async () => {
                      setConfirmedDuplicate(true);
                      setIsSubmitting(true);
                      setErrorMsg(null);
                      const ok = await executeSaveDeal(true);
                      setIsSubmitting(false);
                      if (ok) {
                        setIsQuickCreateOpen(false);
                        setFormData(INITIAL_FORM_DATA);
                        setConfirmedDuplicate(false);
                      }
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Yes, Confirm Distinct Opportunity</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => {
                    setErrorMsg(null);
                    setIsQuickCreateOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ minWidth: 125 }}>
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{currentConfig.button}</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
