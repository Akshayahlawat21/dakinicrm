import React, { useEffect, useRef, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import AgentMessageContent from '../common/AgentMessageContent';
import { Sparkles, X, ArrowUp, Loader2, Bot } from 'lucide-react';

export default function AgentDock() {
  const {
    isAgentDockOpen,
    setIsAgentDockOpen,
    agentMessages,
    agentThinking,
    sendAgentMessage,
  } = useCRM();

  const [inputVal, setInputVal] = useState('');
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

  if (!isAgentDockOpen) return null;

  const handleInputChange = (event) => {
    setInputVal(event.target.value);
    event.target.style.height = 'auto';
    event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
  };

  const handleSend = () => {
    const message = inputVal.trim();
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

  return (
    <aside className="crm-agent-dock" aria-label="Dakini AI CRM assistant">
      <header className="agent-dock-header">
        <div className="agent-header-title">
          <div className="agent-badge-sparkle"><Sparkles size={17} /></div>
          <div>
            <h3 className="agent-title">Dakini AI</h3>
            <span className="agent-subtitle">CRM Assistant</span>
          </div>
        </div>
        <button
          type="button"
          className="agent-close-btn"
          onClick={() => setIsAgentDockOpen(false)}
          aria-label="Close AI assistant"
        >
          <X size={19} />
        </button>
      </header>

      <div className="agent-connection-row">
        <span className="agent-online-dot" />
        <span>Connected to your CRM workspace</span>
        <span className="agent-secure-label">Role-secure data</span>
      </div>

      <section className="agent-dock-body" ref={conversationRef} aria-live="polite">
        {agentMessages.length === 0 && (
          <div className="agent-welcome">
            <div className="agent-welcome-icon"><Bot size={24} /></div>
            <h4>Ask your CRM anything</h4>
            <p>Get answers about leads, deals, pipeline, campaigns, products, and accounts using your authorized CRM data.</p>
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
              <div className={`agent-message-bubble ${msg.sender === 'user' ? 'user-bubble' : 'assistant-bubble'} ${msg.error ? 'error-bubble' : ''}`}>
                <AgentMessageContent text={msg.text} />
              </div>
              <span className="agent-message-time">{msg.time || 'Just now'}</span>
            </div>
          </div>
        ))}

        {agentThinking && (
          <div className="agent-thinking-row">
            <Loader2 size={16} className="animate-spin" />
            <span>Checking your CRM data…</span>
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
            onClick={handleSend}
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
