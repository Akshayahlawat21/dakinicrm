import React, { useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { X, Lock, Mail, Shield, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SignInModal() {
  const { isSignInModalOpen, setIsSignInModalOpen, login, gatewayStatus } = useCRM();

  const [email, setEmail] = useState('elena.rostova@dakini.ai');
  const [password, setPassword] = useState('dakini_secure_2026');
  const [tenantId, setTenantId] = useState('tenant_enterprise_01');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isSignInModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setErrorMsg(result.error?.message || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to connect to authentication gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => setIsSignInModalOpen(false)}>
      <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Shield size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                Sign In to Dakini CRM
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Enter your credentials to continue
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSignInModalOpen(false)}
            style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {errorMsg && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 8,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Work Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="email"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.3rem', width: '100%' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="password"
                  required
                  className="input-field"
                  style={{ paddingLeft: '2.3rem', width: '100%' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Tenant Organization ID
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%' }}
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="tenant_enterprise_01"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSignInModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ minWidth: 120 }}
            >
              {isLoading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
