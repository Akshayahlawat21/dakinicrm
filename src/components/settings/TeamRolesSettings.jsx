import React, { useState, useEffect } from 'react';
import gatewayApi from '../../services/api';
import {
  Users,
  UserPlus,
  Plus,
  Search,
  Key,
  Shield,
  Copy,
  Check,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  X,
  Building,
  RefreshCw,
} from 'lucide-react';

export default function TeamRolesSettings({ currentUser }) {
  const isOwner =
    currentUser?.role?.toLowerCase().includes('owner') ||
    currentUser?.role?.toLowerCase().includes('admin') ||
    currentUser?.roles?.includes('owner') ||
    currentUser?.roles?.includes('admin');

  const isManager =
    currentUser?.role?.toLowerCase().includes('manager') ||
    currentUser?.roles?.includes('manager');

  const isSalesperson = !isOwner && !isManager;

  // Data states
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamModalMode, setTeamModalMode] = useState('create'); // 'create' | 'edit'
  const [teamForm, setTeamForm] = useState({ id: '', name: '', description: '', manager_id: '' });

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', role_name: 'salesperson', team_id: '' });

  // Credentials dialog
  const [credsDialog, setCredsDialog] = useState({
    isOpen: false,
    title: '',
    name: '',
    email: '',
    login_id: '',
    temporary_password: '',
  });
  const [copied, setCopied] = useState(false);

  // Deactivate confirmation
  const [confirmDeactivate, setConfirmDeactivate] = useState({
    isOpen: false,
    type: '', // 'team' | 'user'
    targetId: '',
    targetName: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load teams and users
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [teamsRes, usersRes] = await Promise.all([
        gatewayApi.getTeams('active'),
        gatewayApi.getUsers({ limit: 100 }),
      ]);

      if (teamsRes.success && Array.isArray(teamsRes.data?.data)) {
        setTeams(teamsRes.data.data);
      } else if (teamsRes.success && Array.isArray(teamsRes.data)) {
        setTeams(teamsRes.data);
      }

      if (usersRes.success && Array.isArray(usersRes.data?.data)) {
        setUsers(usersRes.data.data);
      } else if (usersRes.success && Array.isArray(usersRes.data)) {
        setUsers(usersRes.data);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not load team data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.login_id?.toLowerCase().includes(q);

    const matchRole = roleFilter === 'all' || u.role_name?.toLowerCase() === roleFilter.toLowerCase();
    const matchStatus = statusFilter === 'all' || u.status?.toLowerCase() === statusFilter.toLowerCase();

    // Team filtering
    let matchTeam = true;
    if (teamFilter !== 'all') {
      const selectedTeam = teams.find((t) => t.id === teamFilter);
      // If team manager or member
      const isMgr = selectedTeam?.manager?.id === u.id;
      // In team
      matchTeam = isMgr || u.team_id === teamFilter;
    }

    return matchQuery && matchRole && matchStatus;
  });

  // Managers list for dropdown
  const availableManagers = users.filter((u) => u.role_name?.toLowerCase() === 'manager' && u.status === 'active');

  // Copy temporary credentials
  const copyCredentials = () => {
    const emailToUse = credsDialog.email || credsDialog.login_id;
    const text = `Dakini CRM Credentials:\nLogin Email: ${emailToUse}\nTemporary Password: ${credsDialog.temporary_password}\nLogin URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Create or Update Team
  const handleSaveTeam = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      let res;
      if (teamModalMode === 'create') {
        res = await gatewayApi.createTeam({
          name: teamForm.name,
          description: teamForm.description || null,
          manager_id: teamForm.manager_id || null,
        });
      } else {
        res = await gatewayApi.updateTeam(teamForm.id, {
          name: teamForm.name,
          description: teamForm.description || null,
          manager_id: teamForm.manager_id || null,
        });
      }

      if (res.success) {
        setIsTeamModalOpen(false);
        setSuccessMsg(teamModalMode === 'create' ? 'Team created successfully.' : 'Team updated successfully.');
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to save team.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error saving team.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create User
  const handleSaveUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await gatewayApi.createUser({
        name: userForm.name,
        email: userForm.email,
        role_name: userForm.role_name,
        team_id: userForm.team_id || null,
      });

      if (res.success && res.data?.data) {
        const newUser = res.data.data;
        setIsUserModalOpen(false);
        // Show temporary credentials dialog
        setCredsDialog({
          isOpen: true,
          title: 'User Account Created',
          name: newUser.name,
          email: newUser.email || userForm.email,
          login_id: newUser.email || newUser.login_id,
          temporary_password: newUser.temporary_password || '********',
        });
        await fetchData();
      } else {
        setErrorMsg(res.error?.message || 'Failed to create user.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error creating user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset user password
  const handleResetPassword = async (user) => {
    if (!window.confirm(`Issue temporary credentials and reset password for ${user.name}? All active sessions will be invalidated.`)) {
      return;
    }
    setErrorMsg('');
    try {
      const res = await gatewayApi.resetUserPassword(user.id);
      if (res.success && res.data?.data) {
        setCredsDialog({
          isOpen: true,
          title: 'Password Reset Issued',
          name: user.name,
          email: user.email,
          login_id: user.email || user.login_id,
          temporary_password: res.data.data.temporary_password,
        });
      } else {
        setErrorMsg(res.error?.message || 'Failed to reset password.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error resetting password.');
    }
  };

  // Deactivate Team or User execution
  const executeDeactivate = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      let res;
      if (confirmDeactivate.type === 'team') {
        res = await gatewayApi.deactivateTeam(confirmDeactivate.targetId);
      } else {
        res = await gatewayApi.deactivateUser(confirmDeactivate.targetId);
      }

      if (res.success) {
        setConfirmDeactivate({ isOpen: false, type: '', targetId: '', targetName: '' });
        setSuccessMsg(`${confirmDeactivate.type === 'team' ? 'Team' : 'User'} deactivated.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      } else {
        setErrorMsg(res.error?.message || 'Deactivation failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error performing deactivation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reactivate user
  const handleReactivateUser = async (user) => {
    setErrorMsg('');
    try {
      const res = await gatewayApi.reactivateUser(user.id);
      if (res.success) {
        setSuccessMsg(`User ${user.name} reactivated.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchData();
      } else {
        setErrorMsg(res.error?.message || 'Reactivation failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error reactivating user.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Team & Role Governance
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Manage organizational hierarchy, team assignments, and user credentials.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isOwner && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setTeamModalMode('create');
                setTeamForm({ id: '', name: '', description: '', manager_id: '' });
                setIsTeamModalOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <Plus size={16} />
              <span>New Team</span>
            </button>
          )}

          {(isOwner || isManager) && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setUserForm({
                  name: '',
                  email: '',
                  role_name: 'salesperson',
                  team_id: isManager && teams.length > 0 ? teams[0].id : '',
                });
                setIsUserModalOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <UserPlus size={16} />
              <span>{isManager ? 'Add Salesperson' : 'Add User'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Team Overview Cards */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#334155', marginBottom: '0.875rem' }}>
          Active Teams ({teams.length})
        </h3>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.875rem' }}>
            <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            Loading teams...
          </div>
        ) : teams.length === 0 ? (
          <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <Building size={32} style={{ margin: '0 auto 8px auto', color: '#94a3b8' }} />
            <div style={{ fontWeight: 600 }}>No active teams configured</div>
            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
              {isOwner ? 'Click "+ New Team" above to create your first sales team.' : 'No teams assigned.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {teams.map((t) => (
              <div
                key={t.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {t.name}
                    </h4>
                    <span className="badge badge-green">Active</span>
                  </div>
                  {t.description && (
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.875rem 0' }}>
                      {t.description}
                    </p>
                  )}

                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.625rem 0.75rem', marginBottom: '0.875rem' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Team Manager
                    </div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b', marginTop: 2 }}>
                      {t.manager ? t.manager.name : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                    {t.salesperson_count || 0} Salespersons
                  </span>

                  {isOwner && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        className="btn-icon"
                        title="Edit Team"
                        onClick={() => {
                          setTeamModalMode('edit');
                          setTeamForm({
                            id: t.id,
                            name: t.name,
                            description: t.description || '',
                            manager_id: t.manager?.id || '',
                          });
                          setIsTeamModalOpen(true);
                        }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Deactivate Team"
                        style={{ color: '#dc2626' }}
                        onClick={() => {
                          setConfirmDeactivate({
                            isOpen: true,
                            type: 'team',
                            targetId: t.id,
                            targetName: t.name,
                          });
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by name, login ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>

        <select
          className="input-field"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 130 }}
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="salesperson">Salesperson</option>
        </select>

        <select
          className="input-field"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 130 }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Users & Team Members Table */}
      <div className="crm-table-container">
        <table className="crm-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>User & Login ID</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No users found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const roleBadgeClass =
                  u.role_name === 'owner' ? 'badge-blue' : u.role_name === 'manager' ? 'badge-blue' : 'badge-gray';
                const statusBadgeClass = u.status === 'active' ? 'badge-green' : 'badge-red';

                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{u.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b', fontFamily: 'monospace' }}>
                        @{u.login_id || u.email.split('@')[0]}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: '#334155' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${roleBadgeClass}`} style={{ textTransform: 'capitalize' }}>
                        {u.role_name}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass}`} style={{ textTransform: 'capitalize' }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        {(isOwner || isManager) && u.status === 'active' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Reset Temporary Password"
                            onClick={() => handleResetPassword(u)}
                          >
                            <Key size={13} />
                            <span>Reset Pwd</span>
                          </button>
                        )}

                        {isOwner && u.role_name !== 'owner' && (
                          u.status === 'active' ? (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fca5a5' }}
                              title="Deactivate User"
                              onClick={() => {
                                setConfirmDeactivate({
                                  isOpen: true,
                                  type: 'user',
                                  targetId: u.id,
                                  targetName: u.name,
                                });
                              }}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#059669', borderColor: '#a7f3d0' }}
                              title="Reactivate User"
                              onClick={() => handleReactivateUser(u)}
                            >
                              Reactivate
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Team Create / Edit Modal */}
      {isTeamModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsTeamModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {teamModalMode === 'create' ? 'Create Sales Team' : 'Edit Team'}
              </h3>
              <button onClick={() => setIsTeamModalOpen(false)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveTeam}>
              <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Team Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="e.g. Enterprise North America"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Description (Optional)
                  </label>
                  <textarea
                    className="input-field"
                    value={teamForm.description}
                    onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                    placeholder="Territory, segment, or quota objectives..."
                    rows={3}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Assigned Manager (1:1 Active Team)
                  </label>
                  <select
                    className="input-field"
                    value={teamForm.manager_id}
                    onChange={(e) => setTeamForm({ ...teamForm, manager_id: e.target.value })}
                  >
                    <option value="">No Manager Assigned</option>
                    {availableManagers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsTeamModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : teamModalMode === 'create' ? 'Create Team' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. User Create Modal */}
      {isUserModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsUserModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {isManager ? 'Add Team Salesperson' : 'Create User Account'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    placeholder="e.g. Maya Lin"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Corporate Email
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    placeholder="name@company.com"
                    required
                  />
                  {userForm.email && (
                    <span style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                      Login Email: {userForm.email}
                    </span>
                  )}
                </div>
                {isOwner && (
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                      Role Assignment
                    </label>
                    <select
                      className="input-field"
                      value={userForm.role_name}
                      onChange={(e) => setUserForm({ ...userForm, role_name: e.target.value })}
                    >
                      <option value="salesperson">Salesperson</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                    Assign to Team
                  </label>
                  <select
                    className="input-field"
                    value={userForm.team_id}
                    onChange={(e) => setUserForm({ ...userForm, team_id: e.target.value })}
                    disabled={isManager} // Managers are auto-assigned to own team
                  >
                    {!isManager && <option value="">No Team (Unassigned Pool)</option>}
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsUserModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Generating...' : 'Create & Issue Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Temporary Credentials Dialog */}
      {credsDialog.isOpen && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {credsDialog.title}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    for {credsDialog.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '0.75rem', fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.4 }}>
                <strong>Security Notice:</strong> This temporary password is shown <u>once</u>. The user will be required to choose a new permanent password on initial login.
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Login Email
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: 2 }}>
                    {credsDialog.email || credsDialog.login_id}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Temporary Password
                  </span>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace', letterSpacing: '0.05em', marginTop: 2 }}>
                    {credsDialog.temporary_password}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={copyCredentials}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.625rem' }}
              >
                {copied ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials to Clipboard'}</span>
              </button>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCredsDialog({ ...credsDialog, isOpen: false })}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Deactivate Confirmation Modal */}
      {confirmDeactivate.isOpen && (
        <div className="modal-backdrop" onClick={() => setConfirmDeactivate({ isOpen: false, type: '', targetId: '', targetName: '' })}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#dc2626', margin: 0 }}>
                Confirm Deactivation
              </h3>
              <button onClick={() => setConfirmDeactivate({ isOpen: false, type: '', targetId: '', targetName: '' })} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#334155', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                Are you sure you want to deactivate{' '}
                <strong>{confirmDeactivate.targetName}</strong>?
              </p>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', background: '#f8fafc', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                {confirmDeactivate.type === 'team'
                  ? 'Active salespersons in this team will be detached and placed into the unassigned pool. Historical sales records remain intact.'
                  : 'The user will immediately lose access to the CRM and all active login sessions will be terminated.'}
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDeactivate({ isOpen: false, type: '', targetId: '', targetName: '' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                onClick={executeDeactivate}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
