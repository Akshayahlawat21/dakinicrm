import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Video,
  UserCheck,
  Building2,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Users
} from 'lucide-react';

export default function CalendarPage() {
  const navigate = useNavigate();
  const { leads } = useCRM();
  const [viewMode, setViewMode] = useState('Week'); // 'Day' | 'Week' | 'Month'
  const [selectedDayIndex, setSelectedDayIndex] = useState(4); // Index 4 is Fri 10 Oct (Today)
  const [meetingAlert, setMeetingAlert] = useState(null);

  const days = [
    { day: "Mon", date: "6 Oct", fullDate: "Monday, 6 October 2026", dayNumber: 6 },
    { day: "Tue", date: "7 Oct", fullDate: "Tuesday, 7 October 2026", dayNumber: 7 },
    { day: "Wed", date: "8 Oct", fullDate: "Wednesday, 8 October 2026", dayNumber: 8 },
    { day: "Thu", date: "9 Oct", fullDate: "Thursday, 9 October 2026", dayNumber: 9 },
    { day: "Fri", date: "10 Oct", isToday: true, fullDate: "Friday, 10 October 2026 (Today)", dayNumber: 10 },
    { day: "Sat", date: "11 Oct", fullDate: "Saturday, 11 October 2026", dayNumber: 11 },
    { day: "Sun", date: "12 Oct", fullDate: "Sunday, 12 October 2026", dayNumber: 12 }
  ];

  const calendarEvents = [
    {
      id: 1,
      title: "Discovery Demo with Aarav Patel",
      company: "Aarav Patel Enterprises",
      time: "10:00 AM - 10:45 AM",
      hour: 10,
      dayIndex: 4,
      dayNumber: 10,
      type: "meeting",
      attendees: ["Aarav Patel (CTO)", "Marcus Vance"],
      desc: "Present freight telematics co-pilot and real-time routing API demo.",
      videoUrl: "https://meet.google.com/dak-aarav-demo"
    },
    {
      id: 2,
      title: "Architecture Review: TVS Mobility",
      company: "TVS Mobility Solutions",
      time: "2:00 PM - 3:00 PM",
      hour: 14,
      dayIndex: 4,
      dayNumber: 10,
      type: "meeting",
      attendees: ["Rajesh Venkatesh", "Elena Rostova"],
      desc: "Confirm AWS India data residency and SAP ERP sync latency.",
      videoUrl: "https://meet.google.com/dak-tvs-arch"
    },
    {
      id: 3,
      title: "Executive Follow-up with Priya Sharma",
      company: "Acme Corp",
      time: "11:30 AM - 12:00 PM",
      hour: 11,
      dayIndex: 2,
      dayNumber: 8,
      type: "meeting",
      attendees: ["Priya Sharma (VP)", "Elena Rostova"],
      desc: "Review procurement checklist and Docusign MSA execution steps.",
      videoUrl: "https://meet.google.com/dak-acme-exec"
    },
    {
      id: 4,
      title: "Review SOC2 Security Docs",
      company: "HDFC Securities",
      time: "4:00 PM - 4:30 PM",
      hour: 16,
      dayIndex: 4,
      dayNumber: 10,
      type: "task",
      attendees: ["Sunita Rao (CISO)"],
      desc: "Cross-verify penetration test reports with compliance team.",
      videoUrl: null
    },
    {
      id: 5,
      title: "Weekly Enterprise Pipeline Standup",
      company: "Dakini Sales Leadership",
      time: "9:00 AM - 9:45 AM",
      hour: 9,
      dayIndex: 0,
      dayNumber: 6,
      type: "meeting",
      attendees: ["Elena Rostova", "Marcus Vance", "Engineering Lead"],
      desc: "Review Q4 enterprise deals, commit numbers, and AE quota pacing.",
      videoUrl: "https://meet.google.com/dak-standup"
    },
    {
      id: 6,
      title: "Contract Legal Terms Review",
      company: "Reliance Logistics",
      time: "3:30 PM - 4:15 PM",
      hour: 15,
      dayIndex: 3,
      dayNumber: 9,
      type: "meeting",
      attendees: ["Amit Verma", "Legal Counsel"],
      desc: "Address liability indemnity clauses and custom SLA guarantee.",
      videoUrl: "https://meet.google.com/dak-reliance-legal"
    },
    {
      id: 7,
      title: "AI Automation Sandbox Walkthrough",
      company: "Tata Consumer Digital",
      time: "1:00 PM - 2:00 PM",
      hour: 13,
      dayIndex: 1,
      dayNumber: 7,
      type: "meeting",
      attendees: ["Vikram Malhotra", "Solutions Architect"],
      desc: "Live walkthrough of Dakini autonomous lead scoring triggers.",
      videoUrl: "https://meet.google.com/dak-tata-sandbox"
    }
  ];

  // Month grid for October 2026:
  // Oct 1, 2026 is Thursday (so Mon, Tue, Wed of week 1 are Sep 28, 29, 30)
  // 31 days in October. Total 35 cells (5 weeks * 7 days).
  const monthDays = [
    { day: 28, isCurrentMonth: false, month: 'Sep' },
    { day: 29, isCurrentMonth: false, month: 'Sep' },
    { day: 30, isCurrentMonth: false, month: 'Sep' },
    { day: 1, isCurrentMonth: true },
    { day: 2, isCurrentMonth: true },
    { day: 3, isCurrentMonth: true },
    { day: 4, isCurrentMonth: true },
    { day: 5, isCurrentMonth: true },
    { day: 6, isCurrentMonth: true, hasEvents: true },
    { day: 7, isCurrentMonth: true, hasEvents: true },
    { day: 8, isCurrentMonth: true, hasEvents: true },
    { day: 9, isCurrentMonth: true, hasEvents: true },
    { day: 10, isCurrentMonth: true, isToday: true, hasEvents: true },
    { day: 11, isCurrentMonth: true },
    { day: 12, isCurrentMonth: true },
    { day: 13, isCurrentMonth: true },
    { day: 14, isCurrentMonth: true, hasEvents: true, extraTitle: "11:00 AM QBR Demo" },
    { day: 15, isCurrentMonth: true },
    { day: 16, isCurrentMonth: true },
    { day: 17, isCurrentMonth: true },
    { day: 18, isCurrentMonth: true },
    { day: 19, isCurrentMonth: true, hasEvents: true, extraTitle: "3:00 PM Procurement Sync" },
    { day: 20, isCurrentMonth: true },
    { day: 21, isCurrentMonth: true },
    { day: 22, isCurrentMonth: true },
    { day: 23, isCurrentMonth: true, hasEvents: true, extraTitle: "10:30 AM Board Security Review" },
    { day: 24, isCurrentMonth: true },
    { day: 25, isCurrentMonth: true },
    { day: 26, isCurrentMonth: true },
    { day: 27, isCurrentMonth: true },
    { day: 28, isCurrentMonth: true, hasEvents: true, extraTitle: "2:00 PM Final Sign-off" },
    { day: 29, isCurrentMonth: true },
    { day: 30, isCurrentMonth: true },
    { day: 31, isCurrentMonth: true },
    { day: 1, isCurrentMonth: false, month: 'Nov' }
  ];

  // Hours for Day view (8:00 AM to 6:00 PM)
  const dayHours = [
    { hour: 8, label: "8:00 AM" },
    { hour: 9, label: "9:00 AM" },
    { hour: 10, label: "10:00 AM" },
    { hour: 11, label: "11:00 AM" },
    { hour: 12, label: "12:00 PM" },
    { hour: 13, label: "1:00 PM" },
    { hour: 14, label: "2:00 PM" },
    { hour: 15, label: "3:00 PM" },
    { hour: 16, label: "4:00 PM" },
    { hour: 17, label: "5:00 PM" },
    { hour: 18, label: "6:00 PM" }
  ];

  const currentSelectedDay = days[selectedDayIndex] || days[4];
  const activeDayEvents = calendarEvents.filter((e) => e.dayIndex === selectedDayIndex);

  const handleJoinCall = (evt) => {
    setMeetingAlert(`Launching encrypted conference for "${evt.title}" (${evt.company})...`);
    setTimeout(() => setMeetingAlert(null), 3500);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Meeting Alert Banner */}
      {meetingAlert && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          marginBottom: '1rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Video size={16} color="#059669" />
          <span>{meetingAlert}</span>
        </div>
      )}

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
          {/* Day / Week / Month Toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, border: '1px solid #e2e8f0' }}>
            {['Day', 'Week', 'Month'].map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === m ? '#ffffff' : 'transparent',
                  color: viewMode === m ? '#2563eb' : '#64748b',
                  boxShadow: viewMode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setMeetingAlert("New calendar event scheduler initialized. Select meeting type & invitees.");
              setTimeout(() => setMeetingAlert(null), 3000);
            }}
          >
            <Plus size={16} />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.25rem' }}>
        {/* Main Calendar View Area */}
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* ========================================================
              VIEW 1: WEEK VIEW (Default 7-Column Layout)
             ======================================================== */}
          {viewMode === 'Week' && (
            <div>
              {/* Days Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {days.map((d, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedDayIndex(i);
                    }}
                    style={{
                      padding: '0.85rem',
                      textAlign: 'center',
                      borderRight: i < 6 ? '1px solid #e2e8f0' : 'none',
                      background: d.isToday ? '#eff6ff' : selectedDayIndex === i ? '#f1f5f9' : 'transparent',
                      cursor: 'pointer'
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

              {/* Week Time Slots Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 490 }}>
                {days.map((d, colIdx) => {
                  const dayEvents = calendarEvents.filter((e) => e.dayIndex === colIdx);

                  return (
                    <div
                      key={colIdx}
                      style={{
                        borderRight: colIdx < 6 ? '1px solid #f1f5f9' : 'none',
                        padding: '0.5rem',
                        background: d.isToday ? 'rgba(239, 246, 255, 0.45)' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      {dayEvents.map((evt) => (
                        <div
                          key={evt.id}
                          style={{
                            background: evt.type === 'meeting' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : '#f8fafc',
                            border: evt.type === 'meeting' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                            borderLeft: evt.type === 'meeting' ? '3.5px solid #2563eb' : '3.5px solid #64748b',
                            borderRadius: 8,
                            padding: '0.65rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                          }}
                          onClick={() => {
                            setSelectedDayIndex(colIdx);
                          }}
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
          )}

          {/* ========================================================
              VIEW 2: DAY VIEW (Hourly Breakdown & Slot Scheduler)
             ======================================================== */}
          {viewMode === 'Day' && (
            <div>
              {/* Day View Header & Switcher */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem' }}
                    onClick={() => setSelectedDayIndex((prev) => (prev > 0 ? prev - 1 : 6))}
                    title="Previous Day"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem' }}
                    onClick={() => setSelectedDayIndex((prev) => (prev < 6 ? prev + 1 : 0))}
                    title="Next Day"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div style={{ marginLeft: '0.5rem' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                      {currentSelectedDay.fullDate}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {activeDayEvents.length} {activeDayEvents.length === 1 ? 'event' : 'events'} scheduled
                    </div>
                  </div>
                </div>

                {/* Day Switcher Pills */}
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {days.map((d, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDayIndex(idx)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: selectedDayIndex === idx ? '#2563eb' : '#e2e8f0',
                        background: selectedDayIndex === idx ? '#eff6ff' : '#ffffff',
                        color: selectedDayIndex === idx ? '#2563eb' : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {d.day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Hourly Timeline */}
              <div style={{ padding: '0.75rem 1.25rem', maxHeight: 560, overflowY: 'auto' }}>
                {dayHours.map((slot) => {
                  const hourEvents = activeDayEvents.filter((e) => e.hour === slot.hour);

                  return (
                    <div
                      key={slot.hour}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '85px 1fr',
                        borderBottom: '1px solid #f1f5f9',
                        minHeight: 58,
                        alignItems: 'start',
                        padding: '0.4rem 0'
                      }}
                    >
                      {/* Hour Label */}
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', paddingTop: '0.4rem' }}>
                        {slot.label}
                      </div>

                      {/* Hour Content */}
                      <div>
                        {hourEvents.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {hourEvents.map((evt) => (
                              <div
                                key={evt.id}
                                style={{
                                  background: evt.type === 'meeting' ? '#eff6ff' : '#f8fafc',
                                  border: evt.type === 'meeting' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                  borderLeft: evt.type === 'meeting' ? '4px solid #2563eb' : '4px solid #64748b',
                                  borderRadius: 8,
                                  padding: '0.85rem 1rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '1rem'
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 3 }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#0f172a' }}>
                                      {evt.title}
                                    </span>
                                    <span style={{
                                      fontSize: '0.6875rem',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: evt.type === 'meeting' ? '#dbeafe' : '#e2e8f0',
                                      color: evt.type === 'meeting' ? '#1e40af' : '#475569',
                                      textTransform: 'uppercase'
                                    }}>
                                      {evt.type}
                                    </span>
                                  </div>

                                  <div style={{ fontSize: '0.8125rem', color: '#2563eb', fontWeight: 600 }}>
                                    {evt.company}
                                  </div>

                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                                    {evt.desc}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 6, fontSize: '0.75rem', color: '#475569' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Clock size={12} /> {evt.time}
                                    </span>
                                    {evt.attendees && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Users size={12} /> {evt.attendees.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 120 }}>
                                  {evt.videoUrl && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleJoinCall(evt)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                    >
                                      <Video size={13} />
                                      <span>Join Video</span>
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => navigate('/leads')}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                  >
                                    <ExternalLink size={13} />
                                    <span>View Record</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{
                            height: 38,
                            borderRadius: 6,
                            border: '1px dashed #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: '0.75rem',
                            color: '#94a3b8',
                            fontSize: '0.75rem'
                          }}>
                            Available slot
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 3: MONTH VIEW (October 2026 Grid)
             ======================================================== */}
          {viewMode === 'Month' && (
            <div>
              {/* Month Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem' }}
                    title="Previous Month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem' }}
                    title="Next Month"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginLeft: '0.5rem' }}>
                    October 2026
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-blue">Q4 FY2026</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedDayIndex(4);
                      setViewMode('Day');
                    }}
                  >
                    Jump to Today (10 Oct)
                  </button>
                </div>
              </div>

              {/* Month Day Names */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => (
                  <div key={idx} style={{ padding: '0.65rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month 35 Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0' }}>
                {monthDays.map((cell, idx) => {
                  const eventsOnThisDay = calendarEvents.filter((e) => e.dayNumber === cell.day && cell.isCurrentMonth);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (cell.isCurrentMonth) {
                          const matchedIdx = days.findIndex((d) => d.dayNumber === cell.day);
                          if (matchedIdx !== -1) {
                            setSelectedDayIndex(matchedIdx);
                          }
                          setViewMode('Day');
                        }
                      }}
                      style={{
                        minHeight: 90,
                        padding: '0.45rem',
                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f1f5f9' : 'none',
                        borderBottom: idx < 28 ? '1px solid #f1f5f9' : 'none',
                        background: cell.isToday
                          ? '#eff6ff'
                          : cell.isCurrentMonth
                          ? '#ffffff'
                          : '#fcfcfc',
                        cursor: cell.isCurrentMonth ? 'pointer' : 'default',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: cell.isToday ? 800 : cell.isCurrentMonth ? 700 : 400,
                          width: 20,
                          height: 20,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          background: cell.isToday ? '#2563eb' : 'transparent',
                          color: cell.isToday ? '#ffffff' : cell.isCurrentMonth ? '#0f172a' : '#94a3b8'
                        }}>
                          {cell.day}
                        </span>

                        {cell.hasEvents && (
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#2563eb',
                            display: 'inline-block'
                          }} />
                        )}
                      </div>

                      {/* Event pills on this day */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {eventsOnThisDay.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            style={{
                              fontSize: '0.625rem',
                              padding: '2px 4px',
                              borderRadius: 4,
                              background: '#dbeafe',
                              color: '#1e40af',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title={ev.title}
                          >
                            {ev.time.split(' - ')[0]} {ev.company}
                          </div>
                        ))}

                        {eventsOnThisDay.length > 2 && (
                          <div style={{ fontSize: '0.625rem', color: '#2563eb', fontWeight: 700 }}>
                            +{eventsOnThisDay.length - 2} more
                          </div>
                        )}

                        {cell.extraTitle && (
                          <div
                            style={{
                              fontSize: '0.625rem',
                              padding: '2px 4px',
                              borderRadius: 4,
                              background: '#f1f5f9',
                              color: '#475569',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {cell.extraTitle}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar: Selected / Today's Agenda */}
        <div className="crm-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              {viewMode === 'Day' ? `${currentSelectedDay.day} ${currentSelectedDay.date} Agenda` : "Today's Agenda"}
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Confirmed demos & executive reviews
            </p>
          </div>

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
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: '0.5rem', width: '100%' }}
                onClick={() => handleJoinCall({ title: "Discovery Demo", company: "Aarav Patel Enterprises" })}
              >
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

            <div style={{ padding: '0.85rem', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontWeight: 700, fontSize: '0.8125rem' }}>
                <Clock size={15} />
                <span>4:00 PM Review SOC2 Security Docs</span>
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                Sunita Rao (HDFC Securities)
              </div>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
                Cross-verify penetration test reports with compliance team.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
