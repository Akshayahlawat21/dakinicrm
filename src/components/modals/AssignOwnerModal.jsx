import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '../../context/CRMContext';
import { gatewayApi } from '../../services/api';
import {
  X,
  UserCheck,
  Search,
  Check,
  AlertCircle,
  Loader2,
  Shield,
  Briefcase,
  Users
} from 'lucide-react';

export default function AssignOwnerModal({
  isOpen,
  onClose,
  selectedLeadIds = [],
  onSuccess
}) {
  const { leads = [], assignLeads, currentUser } = useCRM();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'salesperson').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');

  // Selected leads objects for chip preview
  const selectedLeads = useMemo(() => {
    const idSet = new Set(selectedLeadIds);
    return (leads || []).filter((l) => idSet.has(l.id));
  }, [leads, selectedLeadIds]);

  // Load team users when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedUser(null);
      setErrorMsg(null);
      setSearchQuery('');
      setIsSubmitting(false);
      return;
    }

    let isMounted = true;
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setErrorMsg(null);
      try {
        const res = await gatewayApi.getUsers({ limit: 100 });
        if (isMounted) {
          if (res.success && Array.isArray(res.data?.data)) {
            setUsers(res.data.data);
          } else {
            // Fallback default enterprise roster if gateway offline
            setUsers([
              { id: '33333333-3333-3333-3333-333333330003', name: 'Dev Singhania', role_name: 'salesperson', email: 'dev.singhania@dakini.ai' },
              { id: '33333333-3333-3333-3333-333333330004', name: 'Asha Nair', role_name: 'salesperson', email: 'asha.nair@dakini.ai' },
              { id: '33333333-3333-3333-3333-333333330002', name: 'Marcus Vance', role_name: 'manager', email: 'marcus.vance@dakini.ai' },
              { id: 'e7e81b6a-d30e-5270-87f1-260879092306', name: 'Elena Rostova', role_name: 'owner', email: 'elena.rostova@dakini.ai' },
            ]);
          }
        }
      } catch (err) {
        console.warn('Failed to load users for assignment:', err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filter users based on hierarchical permissions:
  // - Owner can assign to Manager and Salesperson (and self)
  // - Manager can assign to Salespersons in their team (and self)
  const eligibleUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return (users || []).filter((u) => {
      const uRole = (u.role_name || u.role || '').toLowerCase();

      // Salesperson cannot assign leads
      if (!isOwner && !isManager) return false;

      // Manager can assign to Salespersons or self
      if (isManager && !isOwner) {
        if (uRole === 'owner' || uRole === 'admin') return false;
        if (uRole === 'manager' && u.id !== currentUser?.id && u.email !== currentUser?.email) return false;
      }

      // Search match
      if (!q) return true;
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = uRole;
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [users, isOwner, isManager, currentUser, searchQuery]);

  // Check if user is already the current owner of all selected leads
  const checkIsCurrentOwner = (user) => {
    if (!user || selectedLeads.length === 0) return false;
    const uId = String(user.id || '').toLowerCase();
    const uName = (user.name || '').trim().toLowerCase();
    const uEmail = (user.email || '').trim().toLowerCase();

    return selectedLeads.every((lead) => {
      const leadAssignedTo = String(lead.assigned_to || '').toLowerCase();
      const leadOwnerName = (lead.owner || '').trim().toLowerCase();

      const matchById = Boolean(leadAssignedTo && leadAssignedTo === uId);
      const matchByName = Boolean(leadOwnerName && (leadOwnerName === uName || leadOwnerName === uEmail));
      return matchById || matchByName;
    });
  };

  const isSelectedUserCurrentOwner = Boolean(selectedUser && checkIsCurrentOwner(selectedUser));

  if (!isOpen) return null;

  const handleTransfer = async () => {
    if (!selectedUser || isSubmitting || selectedLeadIds.length === 0) return;

    if (checkIsCurrentOwner(selectedUser)) {
      setErrorMsg(
        selectedLeads.length === 1
          ? `Lead '${selectedLeads[0].name}' is already assigned to ${selectedUser.name}. Transferring to the same person is not permitted. Please select a different team member.`
          : `Selected leads are already assigned to ${selectedUser.name}. Please select a different team member.`
      );
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await assignLeads(selectedLeadIds, selectedUser);
      if (res && res.success === false) {
        setErrorMsg(res.error?.message || 'Failed to transfer ownership. Please check your permissions.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred while reassigning.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !isSubmitting && onClose?.()}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, width: '100%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Assign Lead Owner
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Transfer {selectedLeadIds.length} selected lead{selectedLeadIds.length > 1 ? 's' : ''} to a sales team member
              </span>
            </div>
          </div>
          <button
            onClick={() => !isSubmitting && onClose?.()}
            disabled={isSubmitting}
            style={{ color: '#64748b' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Permission warning if user is not authorized */}
          {!isOwner && !isManager && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '0.75rem 1rem',
                color: '#991b1b',
                fontSize: '0.8125rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, color: '#dc2626' }} />
              <span>Permission Restricted: Only Organization Owners and Team Managers can reassign leads.</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '0.75rem 1rem',
                color: '#991b1b',
                fontSize: '0.8125rem',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, color: '#dc2626', marginTop: 2 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 2 }}>Assignment Failed</strong>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Selected Leads Chips */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 6 }}>
              Selected Leads ({selectedLeadIds.length})
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 80, overflowY: 'auto', padding: '0.35rem 0' }}>
              {selectedLeads.slice(0, 6).map((l) => (
                <span
                  key={l.id}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.55rem',
                    borderRadius: 6,
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {l.name}
                  {l.company && <span style={{ color: '#64748b', fontWeight: 400 }}>({l.company})</span>}
                </span>
              ))}
              {selectedLeads.length > 6 && (
                <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center', padding: '0.2rem' }}>
                  +{selectedLeads.length - 6} more
                </span>
              )}
            </div>
          </div>

          {/* Search Assignee */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'block', marginBottom: 6 }}>
              Select New Owner
            </label>
            <div className="search-bar-wrapper" style={{ width: '100%', marginBottom: '0.75rem' }}>
              <Search size={15} className="search-icon-inside" />
              <input
                type="text"
                placeholder="Search team member by name or role..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Users Roster List */}
            {loadingUsers ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8125rem' }}>
                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 6px auto', color: '#2563eb' }} />
                <span>Loading team members...</span>
              </div>
            ) : (
              <div
                style={{
                  maxHeight: 220,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '0.35rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  background: '#f8fafc'
                }}
              >
                {eligibleUsers.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  const roleStr = (u.role_name || u.role || 'salesperson').toLowerCase();

                  let roleBadgeBg = '#f0fdfa';
                  let roleBadgeColor = '#0d9488';
                  let roleLabel = 'Salesperson';

                  if (roleStr.includes('owner') || roleStr.includes('admin')) {
                    roleBadgeBg = '#f5f3ff';
                    roleBadgeColor = '#7c3aed';
                    roleLabel = 'Owner';
                  } else if (roleStr.includes('manager')) {
                    roleBadgeBg = '#eff6ff';
                    roleBadgeColor = '#2563eb';
                    roleLabel = 'Manager';
                  }

                  const isCurrentOwner = checkIsCurrentOwner(u);

                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setErrorMsg(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.75rem',
                        borderRadius: 6,
                        background: isSelected ? '#ffffff' : 'transparent',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid transparent',
                        boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.08)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: isSelected ? '#2563eb' : '#e2e8f0',
                            color: isSelected ? '#ffffff' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            flexShrink: 0
                          }}
                        >
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>
                            {u.name}
                          </div>
                          <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                            {u.email}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isCurrentOwner && (
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: 4,
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              letterSpacing: '0.01em',
                            }}
                          >
                            Current Owner
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: 4,
                            background: roleBadgeBg,
                            color: roleBadgeColor,
                            textTransform: 'capitalize',
                          }}
                        >
                          {roleLabel}
                        </span>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            border: isSelected ? '2px solid #2563eb' : '2px solid #cbd5e1',
                            background: isSelected ? '#2563eb' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                          }}
                        >
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {eligibleUsers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.8125rem' }}>
                    No eligible team members found matching "{searchQuery}"
                  </div>
                )}
              </div>
            )}

            {/* Warning if selected user is already the owner */}
            {isSelectedUserCurrentOwner && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.65rem',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  color: '#92400e',
                  fontSize: '0.8125rem',
                  lineHeight: 1.4,
                  marginTop: '0.75rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, color: '#d97706', marginTop: 2 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: 2 }}>Lead Already Assigned to this Member</strong>
                  {selectedLeads.length === 1
                    ? `Lead '${selectedLeads[0].name}' is already assigned to ${selectedUser.name}. Reassigning to the same owner is not allowed. Please select a different team member.`
                    : `All selected leads are already assigned to ${selectedUser.name}. Please select a different team member.`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isSubmitting}
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedUser || isSubmitting || (!isOwner && !isManager) || isSelectedUserCurrentOwner}
            onClick={handleTransfer}
            title={isSelectedUserCurrentOwner ? `Lead is already assigned to ${selectedUser.name}` : undefined}
            style={{
              minWidth: 160,
              opacity: isSelectedUserCurrentOwner ? 0.5 : 1,
              cursor: isSelectedUserCurrentOwner ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Reassigning...</span>
              </>
            ) : (
              <>
                <UserCheck size={16} />
                <span>Transfer Ownership</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
