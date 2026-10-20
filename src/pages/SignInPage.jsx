import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import {
  Sparkles,
  Lock,
  Mail,
  Building2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

export default function SignInPage() {
  const { login, gatewayStatus } = useCRM();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('elena.rostova@dakini.ai');
  const [password, setPassword] = useState('dakini_secure_2026');
  const [tenantId, setTenantId] = useState('tenant_enterprise_01');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await login(email, password, tenantId);
      if (res.success) {
        setSuccessMsg('Authentication verified. Loading dashboard...');
        navigate(from, { replace: true });
      } else {
        setErrorMsg(res.error?.message || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await login(demoEmail, demoPassword, tenantId);
      if (res.success) {
        setSuccessMsg('Authentication verified. Loading dashboard...');
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMsg(res.error?.message || 'Demo login failed.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        padding: '1.5rem',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* Outer Card Container matching Image 2 */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          minHeight: 580,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.15), 0 0 1px 1px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        }}
      >
        {/* Left Side — Deep Royal Blue Splash (Hello Dakini! 👋) */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(145deg, #2563eb 0%, #1d4ed8 50%, #1e3a8a 100%)',
            color: '#ffffff',
            padding: '3rem 2.75rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Geometric Background Waves / Curves */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: 0.18,
            }}
            viewBox="0 0 500 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M-50,150 C150,100 300,280 550,220"
              stroke="#ffffff"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M-50,230 C150,180 300,360 550,300"
              stroke="#ffffff"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M-50,310 C150,260 300,440 550,380"
              stroke="#ffffff"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M-50,390 C150,340 300,520 550,460"
              stroke="#ffffff"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>

          {/* Top Brand Logo Icon */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '2rem',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              {/* Star / Asterisk Glyph matching Image 2 */}
              <span style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1, color: '#ffffff' }}>
                ✳
              </span>
            </div>

            {/* Headline and Description */}
            <h1
              style={{
                fontSize: '2.5rem',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                margin: '0 0 1.25rem 0',
              }}
            >
              Hello<br />Dakini! 👋
            </h1>

            <p
              style={{
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.88)',
                lineHeight: 1.6,
                maxWidth: 340,
                margin: 0,
              }}
            >
              Skip repetitive and manual sales-marketing tasks. Get highly productive through AI automation and save tons of time!
            </p>
          </div>

          {/* Bottom Copyright */}
          <div style={{ position: 'relative', zIndex: 2, marginTop: '2.5rem' }}>
            <div style={{ fontSize: '0.8125rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              © 2026 Dakini AI CRM. All rights reserved.
            </div>
          </div>
        </div>

        {/* Right Side — White Login Form matching Image 2 */}
        <div
          style={{
            padding: '3rem 2.75rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: '#ffffff',
          }}
        >
          {/* Logo Heading */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Dakini AI
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                padding: '0.1rem 0.4rem',
                borderRadius: 4,
              }}
            >
              CRM
            </span>
          </div>

          <h2
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 0.35rem 0',
              letterSpacing: '-0.01em',
            }}
          >
            Welcome Back!
          </h2>

          <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '0 0 1.75rem 0' }}>
            Sign in with your enterprise credentials to access your dashboard.
          </p>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div
              style={{
                marginBottom: '1.25rem',
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
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 8,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#059669',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Email Field with clean underline / border style */}
            <div>
              <label
                htmlFor="signin-email"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: '0.25rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
                <Mail
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label
                  htmlFor="signin-password"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  Password
                </label>
                <span style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                  Default: <code>dakini_secure_2026</code>
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="signin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                  onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                />
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
              </div>
            </div>

            {/* Tenant ID (subtle, default prefilled) */}
            <div>
              <label
                htmlFor="signin-tenant"
                style={{
                  display: 'block',
                  fontSize: '0.71875rem',
                  fontWeight: 600,
                  color: '#64748b',
                  marginBottom: '0.25rem',
                }}
              >
                Tenant Org ID
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signin-tenant"
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="tenant_enterprise_01"
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    borderRadius: 6,
                    fontSize: '0.8125rem',
                    color: '#475569',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <Building2
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
              </div>
            </div>

            {/* Primary Login Button matching Image 2 */}
            <button
              id="signin-submit-btn"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: 44,
                background: '#18181b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.9375rem',
                fontWeight: 700,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.background = '#27272a';
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.currentTarget.style.background = '#18181b';
              }}
            >
              {isLoading ? (
                <span>Logging In...</span>
              ) : (
                <>
                  <span>Login Now</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Quick Demo Login matching Image 2 'Login with Google' secondary button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickDemoLogin('elena.rostova@dakini.ai', 'dakini_secure_2026')}
              style={{
                width: '100%',
                height: 42,
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <Sparkles size={16} color="#2563eb" />
              <span>1-Click Demo Login (Elena Rostova)</span>
            </button>
          </form>

          {/* Forgot Password / Footer Links */}
          <div
            style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            <span>Forgot password? </span>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#0f172a',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
              onClick={() => handleQuickDemoLogin('elena.rostova@dakini.ai', 'dakini_secure_2026')}
            >
              Click here to use default credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
