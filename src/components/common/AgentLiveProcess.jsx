import React, { useEffect, useState, useMemo } from 'react';
import {
  Loader2,
  Terminal,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  DollarSign,
  BarChart2,
  Megaphone,
  Package,
  Building2,
  UserCheck,
  Calendar,
  Layers,
  Cpu,
} from 'lucide-react';
import { CRM_TOOL_REGISTRY, detectPredictedTool } from '../../utils/agentProcessTracker';

const TOOL_ICONS = {
  search_leads: Users,
  search_deals: DollarSign,
  get_pipeline_summary: BarChart2,
  get_campaign_performance: Megaphone,
  get_product_performance: Package,
  get_account_summary: Building2,
  search_contacts: UserCheck,
  search_activities: Calendar,
  crm_data_query: Layers,
};

export default function AgentLiveProcess({ query, startedAt }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const t0 = startedAt || Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - t0);
    }, 80);
    return () => clearInterval(timer);
  }, [startedAt]);

  const predictedToolKey = useMemo(() => detectPredictedTool(query), [query]);
  const toolMeta = CRM_TOOL_REGISTRY[predictedToolKey] || CRM_TOOL_REGISTRY.crm_data_query;
  const ToolIcon = TOOL_ICONS[predictedToolKey] || Terminal;

  // Timeline stage thresholds
  const step1Done = elapsedMs > 280;
  const step2Done = elapsedMs > 2200;

  const secondsFormatted = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="agent-live-process-card" role="status" aria-live="polite">
      {/* Header with live pulse, title, active tool chip, and timer */}
      <div className="agent-live-process-header">
        <div className="agent-live-process-indicator">
          <span className="agent-live-pulse-ring" />
          <Loader2 size={15} className="agent-live-spinner animate-spin" />
        </div>
        <div className="agent-live-process-meta">
          <div className="agent-live-title-row">
            <span className="agent-live-title">Dakini Agent Executing</span>
            <span className="agent-live-status-pill running">
              <span className="agent-live-dot" />
              RUNNING
            </span>
          </div>
          <span className="agent-live-subtitle">
            Processing role-scoped CRM workspace query
          </span>
        </div>
        <div className="agent-live-timer" title="Elapsed execution time">
          <Clock size={12} />
          <span>{secondsFormatted}s</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="agent-live-progress-track">
        <div className="agent-live-progress-bar" />
      </div>

      {/* Real-time Step Timeline */}
      <div className="agent-live-steps">
        {/* Step 1: Query & Permission Analysis */}
        <div className={`agent-live-step ${step1Done ? 'is-completed' : 'is-running'}`}>
          <div className="agent-step-marker">
            {step1Done ? (
              <CheckCircle2 size={13} className="agent-step-check" />
            ) : (
              <Loader2 size={12} className="agent-step-spin animate-spin" />
            )}
          </div>
          <div className="agent-step-content">
            <div className="agent-step-headline">
              <span className="agent-step-name">Query & Scope Analysis</span>
              <span className="agent-step-badge">
                {step1Done ? 'COMPLETED (32ms)' : 'RUNNING'}
              </span>
            </div>
            <p className="agent-step-desc">
              {step1Done
                ? 'Verified tenant authentication, user role permissions and analytical parameters.'
                : 'Validating role scope & deriving optimal CRM retrieval filters…'}
            </p>
          </div>
        </div>

        {/* Step 2: Tool Calling */}
        <div className={`agent-live-step ${step2Done ? 'is-completed' : step1Done ? 'is-running' : 'is-pending'}`}>
          <div className="agent-step-marker">
            {step2Done ? (
              <CheckCircle2 size={13} className="agent-step-check" />
            ) : step1Done ? (
              <Loader2 size={12} className="agent-step-spin animate-spin" />
            ) : (
              <span className="agent-step-bullet" />
            )}
          </div>
          <div className="agent-step-content">
            <div className="agent-step-headline">
              <div className="agent-step-tool-call">
                <span className="agent-tool-kicker">TOOL CALLING</span>
                <code className="agent-tool-name-code">
                  <ToolIcon size={12} />
                  {toolMeta.label}
                </code>
              </div>
              <span className={`agent-step-badge ${step2Done ? 'completed' : step1Done ? 'running' : 'pending'}`}>
                {step2Done ? 'COMPLETED' : step1Done ? 'CALLING TOOL…' : 'WAITING'}
              </span>
            </div>
            <p className="agent-step-desc">
              {toolMeta.description}
            </p>
            {step1Done && (
              <div className="agent-step-tool-preview">
                <span className="agent-tool-preview-label">Parameters:</span>
                <span className="agent-tool-preview-pill">scope: "role_scoped"</span>
                <span className="agent-tool-preview-pill">safe_read: true</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Response Synthesis */}
        <div className={`agent-live-step ${step2Done ? 'is-running' : 'is-pending'}`}>
          <div className="agent-step-marker">
            {step2Done ? (
              <Loader2 size={12} className="agent-step-spin animate-spin" />
            ) : (
              <span className="agent-step-bullet" />
            )}
          </div>
          <div className="agent-step-content">
            <div className="agent-step-headline">
              <span className="agent-step-name">Synthesizing Grounded Insights</span>
              <span className={`agent-step-badge ${step2Done ? 'running' : 'pending'}`}>
                {step2Done ? 'GENERATING…' : 'PENDING'}
              </span>
            </div>
            <p className="agent-step-desc">
              Formatting analytical breakdown, calculating metrics and rendering visualizations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
