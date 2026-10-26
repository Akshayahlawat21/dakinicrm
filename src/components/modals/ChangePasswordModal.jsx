import React, { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import gatewayApi from '../../services/api';
import { KeyRound, ShieldAlert, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordModal() {
  const { currentUser, setCurrentUser } = useCRM();

  // If user doesn't have must_change_password set, do not render
  if (!currentUser?.must_change_password) return null;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setErrorMsg('New password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setErrorMsg('New password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setErrorMsg('New password must contain at least one digit');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match');
      return;
    }
    if (oldPassword === newPassword) {
      setErrorMsg('New password must be different from current temporary password');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await gatewayApi.changePassword(oldPassword, newPassword);
      if (res.success) {
        setSuccessNotice(true);
        // If a new access token was issued, save it
        if (res.data?.access_token) {
          localStorage.setItem('dakini_access_token', res.data.access_token);
        }
        setTimeout(() => {
          // Update currentUser state to clear must_change_password
          const updatedUser = {
            ...currentUser,
            must_change_password: false,
          };
          localStorage.setItem('dakini_user_profile', JSON.stringify(updatedUser));
          setCurrentUser(updatedUser);
        }, 1200);
      } else {
        setErrorMsg(res.error?.message || 'Failed to change password. Please check your current password.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Set Your Permanent Password
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Required before accessing workspace data
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: 8,
              padding: '0.75rem',
              display: 'flex',
              gap: '0.625rem',
              color: '#92400e',
              fontSize: '0.8125rem',
              lineHeight: 1.4,
            }}>
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>First-Login Security Policy:</strong> You are currently authenticated with temporary credentials. You must choose a secure permanent password to continue.
              </div>
            </div>

            {errorMsg && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '0.625rem 0.875rem',
                borderRadius: 8,
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successNotice && (
              <div style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
                padding: '0.625rem 0.875rem',
                borderRadius: 8,
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Check size={16} />
                <span>Password successfully updated! Unlocking workspace...</span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Current Temporary Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOld ? 'text' : 'password'}
                  className="input-field"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  required
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                New Permanent Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input-field"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: 2, display: 'block' }}>
                Must contain at least 8 characters, 1 uppercase, 1 lowercase, and 1 number.
              </span>
            </div>

            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
              />
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || successNotice}
              style={{ minWidth: 160 }}
            >
              {isSubmitting ? 'Updating...' : 'Set Password & Enter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
