import React, { useState } from 'react';
import {
  Wrench,
  Terminal,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Users,
  DollarSign,
  BarChart2,
  Megaphone,
  Package,
  Building2,
  UserCheck,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { normalizeToolCalls } from '../../utils/agentProcessTracker';

const TOOL_ICONS = {
  search_leads: Users,
  search_deals: DollarSign,
  get_pipeline_summary: BarChart2,
  get_campaign_performance: Megaphone,
  get_product_performance: Package,
  get_account_summary: Building2,
  search_contacts: UserCheck,
  search_activities: Calendar,
};

function getToolIcon(toolName) {
  return TOOL_ICONS[toolName] || Wrench;
}

export default function AgentToolCalls({
  toolCalls = [],
  toolsUsed = [],
  steps = [],
  durationMs = null,
  dataScope = 'role_scoped',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedToolId, setExpandedToolId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Normalize tool calls using shared tracker
  const effectiveToolCalls = React.useMemo(() => {
    return normalizeToolCalls(toolCalls, toolsUsed, durationMs);
  }, [toolCalls, toolsUsed, durationMs]);

  const hasTools = effectiveToolCalls.length > 0;
  const allCompleted = effectiveToolCalls.every((t) => t.status !== 'failed');
  const totalCount = effectiveToolCalls.length;

  const handleCopyArgs = (id, text) => {
    navigator.clipboard?.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const toggleToolDetail = (id) => {
    setExpandedToolId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={`agent-tool-calls-container ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      {/* Top summary bar (Antigravity-style process pill) */}
      <div
        className="agent-tool-calls-summary-bar"
        onClick={() => setIsExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        aria-expanded={isExpanded}
        aria-label="Toggle agent process and tool calling details"
      >
        <div className="agent-tool-summary-left">
          <div className="agent-tool-summary-icon">
            {hasTools ? <Terminal size={13} /> : <ShieldCheck size={13} />}
          </div>
          <div className="agent-tool-summary-text">
            {hasTools ? (
              <>
                <span className="agent-tool-count-label">
                  {totalCount} {totalCount === 1 ? 'tool call' : 'tool calls'}
                </span>
                <span className="agent-tool-divider">·</span>
                <span className="agent-tool-status-text">
                  {allCompleted ? 'Completed' : 'Partial completion'}
                </span>
              </>
            ) : (
              <span className="agent-tool-count-label">Role-verified query · Completed</span>
            )}
          </div>
          {hasTools && (
            <div className="agent-tool-chips-preview">
              {effectiveToolCalls.slice(0, 3).map((tool, idx) => (
                <code key={idx} className="agent-tool-chip">
                  {tool.name}
                </code>
              ))}
              {effectiveToolCalls.length > 3 && (
                <span className="agent-tool-more">+{effectiveToolCalls.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div className="agent-tool-summary-right">
          {hasTools && (
            <span className={`agent-tool-badge ${allCompleted ? 'badge-completed' : 'badge-failed'}`}>
              {allCompleted ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              {allCompleted ? 'COMPLETED' : 'ATTENTION'}
            </span>
          )}
          {durationMs && (
            <span className="agent-tool-duration">
              <Clock size={11} />
              {durationMs}ms
            </span>
          )}
          <span className="agent-tool-toggle-icon">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </div>
      </div>

      {/* Expanded Antigravity-style process and tool trace drawer */}
      {isExpanded && (
        <div className="agent-tool-trace-drawer">
          {/* Metadata banner */}
          <div className="agent-trace-meta-row">
            <span className="agent-trace-tag">
              <ShieldCheck size={11} />
              Scope: {dataScope}
            </span>
            {durationMs && (
              <span className="agent-trace-tag">
                <Clock size={11} />
                Round-trip: {durationMs}ms
              </span>
            )}
            <span className="agent-trace-tag">
              <Layers size={11} />
              Operations: {hasTools ? effectiveToolCalls.length : 1}
            </span>
          </div>

          {/* Process Timeline */}
          <div className="agent-trace-pipeline">
            <div className="agent-trace-pipeline-title">
              <Cpu size={12} />
              <span>Execution Pipeline & Tool Trace</span>
            </div>

            {/* Step 1: Query & security scope analysis */}
            <div className="agent-trace-step completed">
              <div className="agent-trace-step-bullet">
                <CheckCircle2 size={12} className="text-success" />
              </div>
              <div className="agent-trace-step-body">
                <div className="agent-trace-step-header">
                  <span className="agent-trace-step-title">Query & Role Security Scope</span>
                  <span className="agent-trace-step-status-chip">COMPLETED</span>
                </div>
                <p className="agent-trace-step-desc">
                  Validated user identity and bounded data access to authorized role scope.
                </p>
              </div>
            </div>

            {/* Step 2..N: Tool calls */}
            {effectiveToolCalls.map((tool, idx) => {
              const ToolIcon = getToolIcon(tool.name);
              const isToolOpen = expandedToolId === (tool.id || idx);
              const argsObj = tool.arguments && typeof tool.arguments === 'object' ? tool.arguments : {};
              const argKeys = Object.keys(argsObj);
              const hasArgs = argKeys.length > 0;

              return (
                <div
                  key={tool.id || idx}
                  className={`agent-trace-step ${tool.status === 'failed' ? 'failed' : 'completed'} is-tool-step`}
                >
                  <div className="agent-trace-step-bullet">
                    {tool.status === 'failed' ? (
                      <AlertCircle size={12} className="text-danger" />
                    ) : (
                      <CheckCircle2 size={12} className="text-success" />
                    )}
                  </div>
                  <div className="agent-trace-step-body">
                    <div className="agent-trace-step-header">
                      <div className="agent-trace-tool-title">
                        <span className="agent-trace-tool-tag">TOOL CALL</span>
                        <code className="agent-trace-tool-code">
                          <ToolIcon size={12} />
                          {tool.name}
                        </code>
                      </div>
                      <div className="agent-trace-step-header-right">
                        {tool.duration_ms && (
                          <span className="agent-trace-step-duration">{tool.duration_ms}ms</span>
                        )}
                        <span
                          className={`agent-trace-step-status-chip ${
                            tool.status === 'failed' ? 'failed' : 'completed'
                          }`}
                        >
                          {tool.status === 'failed' ? 'FAILED' : 'COMPLETED'}
                        </span>
                      </div>
                    </div>

                    {/* Summary outcome */}
                    {tool.summary && (
                      <p className="agent-trace-step-desc tool-summary-text">
                        {tool.summary}
                      </p>
                    )}

                    {/* Arguments & Output details */}
                    <div className="agent-tool-detail-card">
                      <div className="agent-tool-detail-header">
                        <span className="agent-tool-detail-kicker">Input Arguments</span>
                        <button
                          type="button"
                          className="agent-copy-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyArgs(tool.id || idx, argsObj);
                          }}
                          title="Copy arguments JSON"
                        >
                          {copiedId === (tool.id || idx) ? <Check size={11} /> : <Copy size={11} />}
                          {copiedId === (tool.id || idx) ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      {hasArgs ? (
                        <div className="agent-tool-args-grid">
                          {argKeys.map((k) => (
                            <div key={k} className="agent-tool-arg-chip">
                              <span className="arg-key">{k}:</span>
                              <span className="arg-val">{JSON.stringify(argsObj[k])}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="agent-tool-empty-args">Default role-scoped filter criteria</span>
                      )}

                      {tool.result_count !== undefined && tool.result_count !== null && (
                        <div className="agent-tool-result-footer">
                          <span className="result-count-label">Records retrieved:</span>
                          <strong className="result-count-val">{tool.result_count}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Final Step: Response Synthesis */}
            <div className="agent-trace-step completed">
              <div className="agent-trace-step-bullet">
                <CheckCircle2 size={12} className="text-success" />
              </div>
              <div className="agent-trace-step-body">
                <div className="agent-trace-step-header">
                  <span className="agent-trace-step-title">Response Synthesis & Grounding</span>
                  <span className="agent-trace-step-status-chip">COMPLETED</span>
                </div>
                <p className="agent-trace-step-desc">
                  Structured answers, summary metrics and interactive charts rendered from verified tool results.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
