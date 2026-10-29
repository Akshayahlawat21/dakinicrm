import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  CheckSquare,
  Plus,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  Tag,
  Trash2
} from 'lucide-react';

export default function TasksPage() {
  const { tasks = [], toggleTask, addTask, deleteTask } = useCRM();
  const [quickInput, setQuickInput] = useState('');
  const [recordChip, setRecordChip] = useState('Acme Corp');

  const handleQuickAdd = (e) => {
    if (e.key === 'Enter' && quickInput.trim()) {
      addTask(quickInput, recordChip);
      setQuickInput('');
    }
  };

  const overdueTasks = tasks.filter((t) => !t.completed && (t.dueDate === 'Yesterday' || String(t.priority).toLowerCase() === 'urgent'));
  const todayTasks = tasks.filter((t) => !t.completed && t.dueDate === 'Today');
  const tomorrowTasks = tasks.filter((t) => !t.completed && t.dueDate === 'Tomorrow');
  const upcomingTasks = tasks.filter((t) => !t.completed && !['Yesterday', 'Today', 'Tomorrow'].includes(t.dueDate) && String(t.priority).toLowerCase() !== 'urgent');
  const completedTasks = tasks.filter((t) => t.completed);

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
                {tsk.time && (
                  <span className={`badge ${isRed ? 'badge-red' : 'badge-blue'}`}>
                    {tsk.time}
                  </span>
                )}
                {deleteTask && (
                  <button
                    onClick={() => deleteTask(tsk.id)}
                    title="Delete task"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 4
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
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
      <div className="crm-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Plus size={18} color="#2563eb" />
        <input
          type="text"
          placeholder="Quick-add task: type description and press Enter..."
          className="input-field"
          style={{ border: 'none', boxShadow: 'none', padding: '0.35rem 0', fontSize: '0.9375rem', flex: 1, minWidth: 200 }}
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
      {renderTaskGroup("Upcoming & Open Tasks", upcomingTasks)}
      {renderTaskGroup("Completed", completedTasks)}

      {tasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
          <CheckSquare size={40} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>No Tasks Yet</h3>
          <p style={{ fontSize: '0.875rem' }}>Use the quick-add line above to add a new task or follow-up.</p>
        </div>
      )}
    </div>
  );
}
