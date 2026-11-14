import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCRM } from '../../context/CRMContext';
import AgentMessageContent from '../common/AgentMessageContent';
import AgentToolCalls from '../common/AgentToolCalls';
import AgentLiveProcess from '../common/AgentLiveProcess';
import { Sparkles, X, ArrowUp, Loader2, Bot, RotateCcw, ShieldCheck, Maximize2, Minimize2 } from 'lucide-react';

const MIN_DOCK_WIDTH = 380;
const MAX_DOCK_WIDTH = 960;
const DEFAULT_DOCK_WIDTH = 520;

export default function AgentDock() {
  const {
    isAgentDockOpen,
    setIsAgentDockOpen,
    agentMessages,
    agentThinking,
    agentActiveTask,
    clearAgentMessages,
    sendAgentMessage,
  } = useCRM();

  const [inputVal, setInputVal] = useState('');
  const [dockWidth, setDockWidth] = useState(() => {
    const saved = localStorage.getItem('dakini_agent_dock_width');
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_DOCK_WIDTH;
    return isNaN(parsed) ? DEFAULT_DOCK_WIDTH : Math.max(MIN_DOCK_WIDTH, Math.min(MAX_DOCK_WIDTH, parsed));
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const conversationRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTo({
        top: conversationRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [agentMessages, agentThinking]);

  useEffect(() => {
    if (isAgentDockOpen) inputRef.current?.focus();
  }, [isAgentDockOpen]);

  // Resizable drag handle handlers
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - e.clientX;
      const clampedWidth = Math.max(MIN_DOCK_WIDTH, Math.min(Math.min(MAX_DOCK_WIDTH, windowWidth - 80), newWidth));
      setDockWidth(clampedWidth);
      setIsMaximized(false);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setDockWidth((current) => {
        localStorage.setItem('dakini_agent_dock_width', String(current));
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (!isAgentDockOpen) return null;

  const handleInputChange = (event) => {
    setInputVal(event.target.value);
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
  };

  const handleSend = (overrideText) => {
    const message = (overrideText ?? inputVal).trim();
    if (!message || agentThinking) return;
    sendAgentMessage(message);
    setInputVal('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const effectiveWidth = isMaximized ? 'min(92vw, 1100px)' : `${dockWidth}px`;

  return (
    <aside
      className={`crm-agent-dock ${isResizing ? 'is-resizing' : ''} ${isMaximized ? 'is-maximized' : ''}`}
      style={{ width: effectiveWidth }}
      aria-label="Dakini AI CRM assistant"
    >
      {/* Resizer Handle */}
      <div
        className="agent-dock-resizer"
        onMouseDown={handleMouseDown}
        title="Drag left/right to adjust window size"
      >
        <div className="agent-dock-resizer-line" />
      </div>

      <header className="agent-dock-header">
        <div className="agent-header-title">
          <div className="agent-badge-sparkle"><Sparkles size={17} /></div>
          <div>
            <h3 className="agent-title">Dakini AI</h3>
            <span className="agent-subtitle">Agentic CRM Copilot</span>
          </div>
        </div>
        <div className="agent-header-actions">
          {agentMessages.length > 0 && (
            <button
              type="button"
              className="agent-header-btn"
              onClick={clearAgentMessages}
              title="Clear conversation"
              aria-label="Clear conversation"
              disabled={agentThinking}
            >
              <RotateCcw size={15} />
            </button>
          )}
          <button
            type="button"
            className="agent-header-btn"
            onClick={() => setIsMaximized((prev) => !prev)}
            title={isMaximized ? "Restore window size" : "Expand window"}
            aria-label={isMaximized ? "Restore window size" : "Expand window"}
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            type="button"
            className="agent-close-btn"
            onClick={() => setIsAgentDockOpen(false)}
            aria-label="Close AI assistant"
          >
            <X size={19} />
          </button>
        </div>
      </header>

      <div className="agent-connection-row">
        <span className="agent-online-dot" />
        <span>Connected to CRM workspace</span>
        <span className="agent-secure-label">
          <ShieldCheck size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
          Role-secure tools
        </span>
      </div>

      <section className="agent-dock-body" ref={conversationRef} aria-live="polite">
        {agentMessages.length === 0 && (
          <div className="agent-welcome">
            <div className="agent-welcome-icon"><Bot size={26} /></div>
            <h4>Ask your CRM anything</h4>
            <p>Dakini Copilot executes role-scoped database tools to query leads, pipeline, deals, campaigns, and accounts.</p>
          </div>
        )}

        {agentMessages.map((msg) => (
          <div
            key={msg.id}
            className={`agent-message-row ${msg.sender === 'user' ? 'is-user' : 'is-assistant'}`}
          >
            {msg.sender !== 'user' && (
              <div className="agent-message-avatar"><Sparkles size={13} /></div>
            )}
            <div className="agent-message-content">
              {/* Show tool calls & execution trace for assistant responses */}
              {msg.sender !== 'user' && !msg.error && (
                <AgentToolCalls
                  toolCalls={msg.toolCalls}
                  toolsUsed={msg.toolsUsed}
                  steps={msg.steps}
                  durationMs={msg.durationMs}
                  dataScope={msg.dataScope}
                />
              )}

              <div
                className={`agent-message-bubble ${
                  msg.sender === 'user' ? 'user-bubble' : 'assistant-bubble'
                } ${msg.error ? 'error-bubble' : ''}`}
              >
                <AgentMessageContent text={msg.text} />
              </div>

              <span className="agent-message-time">{msg.time || 'Just now'}</span>
            </div>
          </div>
        ))}

        {/* Live Antigravity-style In-Flight Process & Tool Calling Display */}
        {agentThinking && (
          <div className="agent-message-row is-assistant is-in-flight">
            <div className="agent-message-avatar"><Sparkles size={13} /></div>
            <div className="agent-message-content">
              <AgentLiveProcess
                query={agentActiveTask?.query || (agentMessages[agentMessages.length - 1]?.text ?? '')}
                startedAt={agentActiveTask?.startedAt}
              />
            </div>
          </div>
        )}
      </section>

      <footer className="agent-dock-footer">
        <div className="agent-input-container">
          <textarea
            ref={inputRef}
            className="agent-chat-input"
            placeholder="Ask about your leads, deals, pipeline…"
            value={inputVal}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={4000}
            aria-label="Ask Dakini AI a question"
            disabled={agentThinking}
          />
          <button
            type="button"
            className="agent-send-btn"
            onClick={() => handleSend()}
            disabled={!inputVal.trim() || agentThinking}
            aria-label="Send message"
          >
            {agentThinking ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>
        <div className="agent-input-hint">Enter to send · Shift + Enter for a new line</div>
      </footer>
    </aside>
  );
}
