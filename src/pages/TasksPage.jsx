import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  CheckSquare,
  Plus,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  Tag
} from 'lucide-react';

export default function TasksPage() {
  const { tasks, toggleTask, addTask } = useCRM();
  const [quickInput, setQuickInput] = useState('');
  const [recordChip, setRecordChip] = useState('Acme Corp');

  const handleQuickAdd = (e) => {
    if (e.key === 'Enter' && quickInput.trim()) {
      addTask(quickInput, recordChip);
      setQuickInput('');
    }
  };

  const overdueTasks = tasks.filter((t) => t.dueDate === 'Yesterday' || t.priority === 'Urgent');
  const todayTasks = tasks.filter((t) => t.dueDate === 'Today');
  const tomorrowTasks = tasks.filter((t) => t.dueDate === 'Tomorrow');

  const renderTaskGroup = (title, taskList, isRed = false) => {
    if (taskList.length === 0) return null;
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: isRed ? '#dc2626' : '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '0.65rem'
        }}>
          {isRed && <AlertCircle size={15} />}
          <span>{title} ({taskList.length})</span>
        </div>

        <div className="crm-table-container">
          {taskList.map((tsk) => (
            <div
              key={tsk.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #f1f5f9',
                background: tsk.completed ? '#f8fafc' : '#ffffff',
                transition: 'background 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={tsk.completed}
                  onChange={() => toggleTask(tsk.id)}
                  style={{ width: 18, height: 18, accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: tsk.completed ? '#94a3b8' : '#0f172a',
                    textDecoration: tsk.completed ? 'line-through' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>{tsk.title}</span>
                    {tsk.isAiGenerated && (
                      <span className="badge badge-blue" style={{ fontSize: '0.6875rem' }}>
                        <Sparkles size={11} /> AI Suggested
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                    Assigned to: {tsk.owner}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge badge-gray" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={11} /> {tsk.record}
                </span>
                <span className={`badge ${isRed ? 'badge-red' : 'badge-blue'}`}>
                  {tsk.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
            Tasks & Action Queue
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Sales cadences, scheduled customer follow-ups and AI action approvals
          </p>
        </div>
      </div>

      {/* Quick-add Line at top (as requested in spec) */}
      <div className="crm-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Plus size={18} color="#2563eb" />
        <input
          type="text"
          placeholder="Quick-add task: type description and press Enter..."
          className="input-field"
          style={{ border: 'none', boxShadow: 'none', padding: '0.35rem 0', fontSize: '0.9375rem' }}
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={handleQuickAdd}
        />
        <select
          className="input-field"
          style={{ width: 180, fontSize: '0.8125rem' }}
          value={recordChip}
          onChange={(e) => setRecordChip(e.target.value)}
        >
          <option value="Aarav Patel Enterprises">Aarav Patel Enterprises</option>
          <option value="TVS Mobility Solutions">TVS Mobility Solutions</option>
          <option value="Zenith Dynamics">Zenith Dynamics</option>
          <option value="Acme Corp">Acme Corp</option>
          <option value="Internal Work">Internal Work</option>
        </select>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            if (quickInput.trim()) {
              addTask(quickInput, recordChip);
              setQuickInput('');
            }
          }}
        >
          Add
        </button>
      </div>

      {/* Task Groups */}
      {renderTaskGroup("Overdue", overdueTasks, true)}
      {renderTaskGroup("Today", todayTasks)}
      {renderTaskGroup("Tomorrow", tomorrowTasks)}
    </div>
  );
}
