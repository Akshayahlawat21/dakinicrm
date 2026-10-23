import React, { useState } from 'react';
import { useCRM } from '../context/CRMContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  UserCheck,
  Building2
} from 'lucide-react';

export default function CalendarPage() {
  const { navigateTo } = useCRM();
  const [viewMode, setViewMode] = useState('Week');

  const days = [
    { day: "Mon", date: "6 Oct" },
    { day: "Tue", date: "7 Oct" },
    { day: "Wed", date: "8 Oct" },
    { day: "Thu", date: "9 Oct" },
    { day: "Fri", date: "10 Oct", isToday: true },
    { day: "Sat", date: "11 Oct" },
    { day: "Sun", date: "12 Oct" }
  ];

  const calendarEvents = [
    { id: 1, title: "Discovery Demo with Aarav Patel", company: "Aarav Patel Enterprises", time: "10:00 AM - 10:45 AM", dayIndex: 4, type: "meeting" },
    { id: 2, title: "Architecture Review: TVS Mobility", company: "TVS Mobility Solutions", time: "2:00 PM - 3:00 PM", dayIndex: 4, type: "meeting" },
    { id: 3, title: "Executive Follow-up with Priya Sharma", company: "Acme Corp", time: "11:30 AM - 12:00 PM", dayIndex: 2, type: "meeting" },
    { id: 4, title: "Review SOC2 Security Docs", company: "HDFC Securities", time: "4:00 PM - 4:30 PM", dayIndex: 4, type: "task" }
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
            Calendar & Engagements
          </h1>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Customer demo schedule, executive reviews, and rep cadence tracking
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
            {['Day', 'Week', 'Month'].map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: 6,
                  background: viewMode === m ? '#ffffff' : 'transparent',
                  color: viewMode === m ? '#2563eb' : '#64748b',
                  boxShadow: viewMode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <button className="btn btn-primary">
            <Plus size={16} />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem' }}>
        {/* Calendar Grid */}
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Days Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {days.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: '0.85rem',
                  textAlign: 'center',
                  borderRight: i < 6 ? '1px solid #e2e8f0' : 'none',
                  background: d.isToday ? '#eff6ff' : 'transparent'
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: d.isToday ? '#2563eb' : '#64748b' }}>
                  {d.day}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: d.isToday ? '#2563eb' : '#0f172a' }}>
                  {d.date}
                </div>
              </div>
            ))}
          </div>

          {/* Time Slots Area */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 460 }}>
            {days.map((d, colIdx) => {
              const dayEvents = calendarEvents.filter((e) => e.dayIndex === colIdx);

              return (
                <div
                  key={colIdx}
                  style={{
                    borderRight: colIdx < 6 ? '1px solid #f1f5f9' : 'none',
                    padding: '0.5rem',
                    background: d.isToday ? 'rgba(239, 246, 255, 0.4)' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  {dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        background: evt.type === 'meeting' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : '#f1f5f9',
                        border: evt.type === 'meeting' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                        borderLeft: evt.type === 'meeting' ? '3.5px solid #2563eb' : '3.5px solid #64748b',
                        borderRadius: 8,
                        padding: '0.65rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                      onClick={() => navigateTo('leads')}
                    >
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                        {evt.title}
                      </div>
                      <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.6875rem' }}>
                        {evt.company}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.6875rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} />
                        {evt.time}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Today's Agenda */}
        <div className="crm-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
            Today's Agenda
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ padding: '0.85rem', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', fontWeight: 700, fontSize: '0.8125rem' }}>
                <Video size={15} />
                <span>10:00 AM Discovery Demo</span>
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                Aarav Patel (Aarav Patel Enterprises)
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
                Present freight telematics co-pilot and real-time routing API demo.
              </p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem', width: '100%' }}>
                Join Video Bridge
              </button>
            </div>

            <div style={{ padding: '0.85rem', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 700, fontSize: '0.8125rem' }}>
                <Clock size={15} />
                <span>2:00 PM Architecture Review</span>
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                Rajesh Venkatesh (TVS Mobility)
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
                Confirm AWS India data residency and SAP ERP sync latency.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
