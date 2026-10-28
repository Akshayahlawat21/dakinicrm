import React, { useState, useEffect } from 'react';
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
  Users,
  Trash2,
  Check,
  AlertTriangle,
  Filter,
  Sparkles,
  Phone,
  FileText,
  X,
  RotateCcw
} from 'lucide-react';

const INITIAL_EVENTS = [
  {
    id: 'evt-1',
    title: "Discovery Demo with Aarav Patel",
    company: "Aarav Patel Enterprises",
    time: "10:00 AM - 10:45 AM",
    hour: 10,
    dayIndex: 4,
    dayNumber: 10,
    monthIndex: 9,
    year: 2026,
    type: "meeting",
    attendees: ["Aarav Patel (CTO)", "Marcus Vance"],
    desc: "Present freight telematics co-pilot and real-time routing API demo.",
    videoUrl: "https://meet.google.com/dak-aarav-demo",
    completed: false
  },
  {
    id: 'evt-2',
    title: "Architecture Review: TVS Mobility",
    company: "TVS Mobility Solutions",
    time: "2:00 PM - 3:00 PM",
    hour: 14,
    dayIndex: 4,
    dayNumber: 10,
    monthIndex: 9,
    year: 2026,
    type: "meeting",
    attendees: ["Rajesh Venkatesh", "Elena Rostova"],
    desc: "Confirm AWS India data residency and SAP ERP sync latency.",
    videoUrl: "https://meet.google.com/dak-tvs-arch",
    completed: false
  },
  {
    id: 'evt-3',
    title: "Executive Follow-up with Priya Sharma",
    company: "Acme Corp",
    time: "11:30 AM - 12:00 PM",
    hour: 11,
    dayIndex: 2,
    dayNumber: 8,
    monthIndex: 9,
    year: 2026,
    type: "follow-up",
    attendees: ["Priya Sharma (VP)", "Elena Rostova"],
    desc: "Review procurement checklist and Docusign MSA execution steps.",
    videoUrl: "https://meet.google.com/dak-acme-exec",
    completed: false
  },
  {
    id: 'evt-4',
    title: "Review SOC2 Security Docs",
    company: "HDFC Securities",
    time: "4:00 PM - 4:30 PM",
    hour: 16,
    dayIndex: 4,
    dayNumber: 10,
    monthIndex: 9,
    year: 2026,
    type: "task",
    attendees: ["Sunita Rao (CISO)"],
    desc: "Cross-verify penetration test reports with compliance team.",
    videoUrl: null,
    completed: false
  },
  {
    id: 'evt-5',
    title: "Weekly Enterprise Pipeline Standup",
    company: "Dakini Sales Leadership",
    time: "9:00 AM - 9:45 AM",
    hour: 9,
    dayIndex: 0,
    dayNumber: 6,
    monthIndex: 9,
    year: 2026,
    type: "meeting",
    attendees: ["Elena Rostova", "Marcus Vance", "Engineering Lead"],
    desc: "Review Q4 enterprise deals, commit numbers, and AE quota pacing.",
    videoUrl: "https://meet.google.com/dak-standup",
    completed: true
  },
  {
    id: 'evt-6',
    title: "Contract Legal Terms Review",
    company: "Reliance Logistics",
    time: "3:30 PM - 4:15 PM",
    hour: 15,
    dayIndex: 3,
    dayNumber: 9,
    monthIndex: 9,
    year: 2026,
    type: "review",
    attendees: ["Amit Verma", "Legal Counsel"],
    desc: "Address liability indemnity clauses and custom SLA guarantee.",
    videoUrl: "https://meet.google.com/dak-reliance-legal",
    completed: false
  },
  {
    id: 'evt-7',
    title: "AI Automation Sandbox Walkthrough",
    company: "Tata Consumer Digital",
    time: "1:00 PM - 2:00 PM",
    hour: 13,
    dayIndex: 1,
    dayNumber: 7,
    monthIndex: 9,
    year: 2026,
    type: "demo",
    attendees: ["Vikram Malhotra", "Solutions Architect"],
    desc: "Live walkthrough of Dakini autonomous lead scoring triggers.",
    videoUrl: "https://meet.google.com/dak-tata-sandbox",
    completed: true
  }
];

export default function CalendarPage() {
  const navigate = useNavigate();
  const { leads, addTask } = useCRM();

  const [viewMode, setViewMode] = useState('Week'); // 'Day' | 'Week' | 'Month'
  const [selectedDayIndex, setSelectedDayIndex] = useState(4); // Index 4 is Fri 10 Oct (Today)
  const [meetingAlert, setMeetingAlert] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Follow-ups' | 'Upcoming' | 'Completed' | 'Passed'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Month navigation state (Month 9 is October, 0-indexed)
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date(2026, 9, 1));

  // Load events from localStorage or fallback
  const [events, setEvents] = useState(() => {
    try {
      const saved = localStorage.getItem('dakini_calendar_events_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved calendar events', e);
    }
    return INITIAL_EVENTS;
  });

  // Save to localStorage on any change
  useEffect(() => {
    try {
      localStorage.setItem('dakini_calendar_events_v2', JSON.stringify(events));
    } catch (e) {
      console.warn('Failed to save calendar events', e);
    }
  }, [events]);

  // Form state for creating a follow-up or meeting
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newType, setNewType] = useState('follow-up'); // 'follow-up' | 'meeting' | 'call' | 'demo' | 'task'
  const [newDayIndex, setNewDayIndex] = useState(4);
  const [newHour, setNewHour] = useState(10);
  const [newDuration, setNewDuration] = useState('30m');
  const [newAttendees, setNewAttendees] = useState('Elena Rostova');
  const [newDesc, setNewDesc] = useState('');
  const [newSyncTask, setNewSyncTask] = useState(true);

  const days = [
    { day: "Mon", date: "6 Oct", fullDate: "Monday, 6 October 2026", dayNumber: 6 },
    { day: "Tue", date: "7 Oct", fullDate: "Tuesday, 7 October 2026", dayNumber: 7 },
    { day: "Wed", date: "8 Oct", fullDate: "Wednesday, 8 October 2026", dayNumber: 8 },
    { day: "Thu", date: "9 Oct", fullDate: "Thursday, 9 October 2026", dayNumber: 9 },
    { day: "Fri", date: "10 Oct", isToday: true, fullDate: "Friday, 10 October 2026 (Today)", dayNumber: 10 },
    { day: "Sat", date: "11 Oct", fullDate: "Saturday, 11 October 2026", dayNumber: 11 },
    { day: "Sun", date: "12 Oct", fullDate: "Sunday, 12 October 2026", dayNumber: 12 }
  ];

  // Month navigation actions
  const handlePrevMonth = () => {
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    setSelectedMonthDate(new Date(2026, 9, 1));
    setSelectedDayIndex(4);
    setViewMode('Day');
  };

  const currentMonthYearLabel = selectedMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const currentQuarterLabel = `Q${Math.floor(selectedMonthDate.getMonth() / 3) + 1} FY${selectedMonthDate.getFullYear()}`;

  // Dynamically compute monthDays grid for the selected month & year
  const getDynamicMonthDays = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();

    // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    // Monday-first offset: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const startOffset = (firstDayOfWeek + 6) % 7;

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const prevMonthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'short' });
    const nextMonthName = new Date(year, month + 1, 1).toLocaleString('default', { month: 'short' });

    const cells = [];

    // Preceding days from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        month: prevMonthName,
        isCurrentMonth: false,
        year: month === 0 ? year - 1 : year,
        monthIndex: month === 0 ? 11 : month - 1
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const isToday = (year === 2026 && month === 9 && d === 10);
      cells.push({
        day: d,
        isCurrentMonth: true,
        isToday,
        year,
        monthIndex: month
      });
    }

    // Trailing days from next month to fill 35 or 42 grid cells
    const targetLength = cells.length > 35 ? 42 : 35;
    const remaining = targetLength - cells.length;
    for (let n = 1; n <= remaining; n++) {
      cells.push({
        day: n,
        month: nextMonthName,
        isCurrentMonth: false,
        year: month === 11 ? year + 1 : year,
        monthIndex: month === 11 ? 0 : month + 1
      });
    }

    return cells;
  };

  const monthDays = getDynamicMonthDays(selectedMonthDate);

  // Helper: check if day of event has passed (relative to Today: Fri 10 Oct 2026)
  const isEventPassed = (evt) => {
    const evtYear = evt.year || 2026;
    const evtMonth = evt.monthIndex !== undefined ? evt.monthIndex : 9;
    if (evtYear < 2026) return true;
    if (evtYear > 2026) return false;
    if (evtMonth < 9) return true;
    if (evtMonth > 9) return false;
    if (evt.dayNumber !== undefined && evt.dayNumber !== null) {
      return evt.dayNumber < 10;
    }
    return evt.dayIndex < 4;
  };

  // Helper: toggle completion
  const handleToggleComplete = (id, e) => {
    if (e) e.stopPropagation();
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === id) {
          const updated = !ev.completed;
          setMeetingAlert(updated ? `Marked "${ev.title}" as completed! ✅` : `Reopened "${ev.title}".`);
          setTimeout(() => setMeetingAlert(null), 3000);
          return { ...ev, completed: updated };
        }
        return ev;
      })
    );
  };

  // Helper: delete single event
  const handleDeleteEvent = (id, e) => {
    if (e) e.stopPropagation();
    const target = events.find((ev) => ev.id === id);
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    setMeetingAlert(`Removed "${target?.title || 'Event'}" from calendar. 🗑️`);
    setTimeout(() => setMeetingAlert(null), 3000);
  };

  // Helper: clean up all completed or passed events
  const handleCleanUpPassedAndCompleted = () => {
    const passedOrCompleted = events.filter((ev) => ev.completed || isEventPassed(ev));
    if (passedOrCompleted.length === 0) {
      setMeetingAlert("No passed or completed follow-ups to clean up!");
      setTimeout(() => setMeetingAlert(null), 3000);
      return;
    }
    const count = passedOrCompleted.length;
    setEvents((prev) => prev.filter((ev) => !ev.completed && !isEventPassed(ev)));
    setMeetingAlert(`Successfully cleaned up ${count} passed / completed follow-ups! 🧹`);
    setTimeout(() => setMeetingAlert(null), 3500);
  };

  // Reset to sample defaults
  const handleResetDefaults = () => {
    setEvents(INITIAL_EVENTS);
    setSelectedMonthDate(new Date(2026, 9, 1));
    setMeetingAlert("Reset calendar schedule to default enterprise events.");
    setTimeout(() => setMeetingAlert(null), 3000);
  };

  // Open modal with specific day / hour
  const handleOpenAddModal = (dayIdx = selectedDayIndex, hourVal = 10, customDayNumber = null) => {
    setNewDayIndex(dayIdx);
    setNewHour(hourVal);
    setNewTitle('');
    setNewCompany(leads && leads.length > 0 ? leads[0].company || leads[0].name : 'Enterprise Corp');
    setNewType('follow-up');
    setNewDesc('');
    setIsModalOpen(true);
  };

  // Submit new event
  const handleCreateEventSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please enter a follow-up or meeting title");
      return;
    }

    const matchedDay = days[newDayIndex] || days[4];
    const hourLabel = newHour > 12 ? `${newHour - 12}:00 PM` : `${newHour}:00 ${newHour === 12 ? 'PM' : 'AM'}`;
    const endHour = newHour + (newDuration === '1h' ? 1 : 0);
    const endMinutes = newDuration === '30m' ? '30' : newDuration === '45m' ? '45' : '00';
    const endHourLabel = endHour > 12 ? `${endHour - 12}:${endMinutes} PM` : `${endHour}:${endMinutes} ${endHour === 12 ? 'PM' : 'AM'}`;

    const newEvt = {
      id: `evt-${Date.now()}`,
      title: newTitle.trim(),
      company: newCompany.trim() || 'Enterprise Client',
      time: `${hourLabel} - ${endHourLabel}`,
      hour: Number(newHour),
      dayIndex: Number(newDayIndex),
      dayNumber: matchedDay.dayNumber,
      monthIndex: selectedMonthDate.getMonth(),
      year: selectedMonthDate.getFullYear(),
      type: newType,
      attendees: newAttendees ? newAttendees.split(',').map((s) => s.trim()) : ['Elena Rostova'],
      desc: newDesc.trim() || `Scheduled ${newType} with ${newCompany}`,
      videoUrl: newType === 'meeting' || newType === 'demo' ? `https://meet.google.com/dak-${Math.random().toString(36).substring(7)}` : null,
      completed: false
    };

    setEvents((prev) => [newEvt, ...prev]);

    // Also sync to tasks if requested
    if (newSyncTask && typeof addTask === 'function') {
      addTask(`Follow-up: ${newTitle.trim()}`, newCompany.trim() || 'General', 'High');
    }

    setIsModalOpen(false);
    setMeetingAlert(`Added "${newTitle}" to ${matchedDay.day} ${matchedDay.date}! 📅`);
    setTimeout(() => setMeetingAlert(null), 3500);
  };

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

  // Filtering events based on user selected filter
  const filterEvent = (ev) => {
    if (statusFilter === 'Follow-ups') return ev.type === 'follow-up';
    if (statusFilter === 'Upcoming') return !ev.completed && !isEventPassed(ev);
    if (statusFilter === 'Completed') return ev.completed;
    if (statusFilter === 'Passed') return isEventPassed(ev) && !ev.completed;
    return true; // 'All'
  };

  const filteredEvents = events.filter(filterEvent);
  const currentSelectedDay = days[selectedDayIndex] || days[4];
  const activeDayEvents = filteredEvents.filter((e) => e.dayIndex === selectedDayIndex);

  // Overall counts for badge indicators
  const passedCount = events.filter((e) => isEventPassed(e) && !e.completed).length;
  const completedCount = events.filter((e) => e.completed).length;
  const cleanupCount = events.filter((e) => e.completed || isEventPassed(e)).length;

  const handleJoinCall = (evt) => {
    setMeetingAlert(`Launching encrypted conference for "${evt.title}" (${evt.company})...`);
    setTimeout(() => setMeetingAlert(null), 3500);
  };

  // Color & Badge helper
  const getTypeBadgeStyle = (type, completed, passed) => {
    if (completed) {
      return { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', label: 'COMPLETED' };
    }
    if (passed) {
      return { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'PASSED' };
    }
    switch (type) {
      case 'follow-up':
        return { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', label: 'FOLLOW-UP' };
      case 'call':
        return { bg: '#f0fdf4', color: '#166534', border: '#dcfce7', label: 'CALL' };
      case 'demo':
        return { bg: '#faf5ff', color: '#7e22ce', border: '#f3e8ff', label: 'DEMO' };
      case 'review':
        return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', label: 'REVIEW' };
      default:
        return { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', label: 'MEETING' };
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Feedback Alert Toast */}
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
          justifyContent: 'space-between',
          gap: '0.5rem',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="#059669" />
            <span>{meetingAlert}</span>
          </div>
          <button
            onClick={() => setMeetingAlert(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
              Calendar & Follow-ups
            </h1>
            <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
              {events.length} Events Total
            </span>
            {passedCount > 0 && (
              <span className="badge badge-amber" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                <AlertTriangle size={12} /> {passedCount} Passed
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Schedule client follow-ups, customer demos, and remove passed or completed items
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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

          {/* Clean Up Passed / Completed Follow-ups Action */}
          {cleanupCount > 0 && (
            <button
              onClick={handleCleanUpPassedAndCompleted}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#fef2f2',
                borderColor: '#fecaca',
                color: '#dc2626',
                fontWeight: 700
              }}
              title="Remove all follow-ups whose day has passed or are marked as completed"
            >
              <Trash2 size={14} />
              <span>Clean Up Passed / Done ({cleanupCount})</span>
            </button>
          )}

          {/* Quick Schedule Follow-up / Meeting Button */}
          <button
            className="btn btn-primary"
            onClick={() => handleOpenAddModal(selectedDayIndex, 10)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} />
            <span>+ Add Follow-up</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs Sub-Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 1rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={13} /> Filter:
          </span>
          {['All', 'Follow-ups', 'Upcoming', 'Completed', 'Passed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              style={{
                padding: '0.3rem 0.7rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid',
                borderColor: statusFilter === tab ? '#2563eb' : '#e2e8f0',
                background: statusFilter === tab ? '#eff6ff' : '#ffffff',
                color: statusFilter === tab ? '#2563eb' : '#475569',
                cursor: 'pointer'
              }}
            >
              {tab}
              {tab === 'Passed' && passedCount > 0 && ` (${passedCount})`}
              {tab === 'Completed' && completedCount > 0 && ` (${completedCount})`}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleResetDefaults}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer'
            }}
            title="Reset to default enterprise schedule"
          >
            <RotateCcw size={12} /> Reset Samples
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.25rem' }}>
        {/* Main Calendar View Area */}
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>

          {/* ========================================================
              VIEW 1: WEEK VIEW (7-Column Layout with Interactive Cards)
             ======================================================== */}
          {viewMode === 'Week' && (
            <div>
              {/* Days Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {days.map((d, i) => {
                  const dayEvts = filteredEvents.filter((e) => e.dayIndex === i);
                  const isDayPassed = d.dayNumber < 10;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDayIndex(i)}
                      style={{
                        padding: '0.85rem 0.5rem',
                        textAlign: 'center',
                        borderRight: i < 6 ? '1px solid #e2e8f0' : 'none',
                        background: d.isToday ? '#eff6ff' : selectedDayIndex === i ? '#f1f5f9' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: d.isToday ? '#2563eb' : isDayPassed ? '#94a3b8' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3
                      }}>
                        {d.day}
                        {isDayPassed && <span style={{ fontSize: '0.65rem', color: '#b45309' }}>•</span>}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: d.isToday ? '#2563eb' : isDayPassed ? '#64748b' : '#0f172a' }}>
                        {d.date}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: dayEvts.length > 0 ? '#2563eb' : '#94a3b8', fontWeight: 600 }}>
                        {dayEvts.length} {dayEvts.length === 1 ? 'event' : 'events'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Week Time Slots Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 520 }}>
                {days.map((d, colIdx) => {
                  const dayEvents = filteredEvents.filter((e) => e.dayIndex === colIdx);
                  const isDayPassed = d.dayNumber < 10;

                  return (
                    <div
                      key={colIdx}
                      style={{
                        borderRight: colIdx < 6 ? '1px solid #f1f5f9' : 'none',
                        padding: '0.5rem',
                        background: d.isToday
                          ? 'rgba(239, 246, 255, 0.5)'
                          : isDayPassed
                          ? '#fafafa'
                          : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      {/* Add Slot Button */}
                      <button
                        onClick={() => handleOpenAddModal(colIdx, 10)}
                        style={{
                          background: 'none',
                          border: '1px dashed #cbd5e1',
                          borderRadius: 6,
                          padding: '0.35rem',
                          color: '#64748b',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4
                        }}
                        title={`Add follow-up on ${d.day}`}
                      >
                        <Plus size={11} /> Add
                      </button>

                      {dayEvents.map((evt) => {
                        const passed = isEventPassed(evt);
                        const badge = getTypeBadgeStyle(evt.type, evt.completed, passed);

                        return (
                          <div
                            key={evt.id}
                            style={{
                              background: evt.completed ? '#f8fafc' : badge.bg,
                              border: `1px solid ${badge.border}`,
                              borderLeft: `3.5px solid ${evt.completed ? '#10b981' : passed ? '#f59e0b' : '#2563eb'}`,
                              borderRadius: 8,
                              padding: '0.6rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                              opacity: evt.completed ? 0.75 : 1,
                              transition: 'all 0.15s ease'
                            }}
                            onClick={() => setSelectedDayIndex(colIdx)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                color: badge.color,
                                textTransform: 'uppercase'
                              }}>
                                {badge.label}
                              </span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                {/* Toggle Complete Button */}
                                <button
                                  onClick={(e) => handleToggleComplete(evt.id, e)}
                                  title={evt.completed ? "Mark incomplete" : "Mark completed"}
                                  style={{
                                    border: 'none',
                                    background: evt.completed ? '#10b981' : '#e2e8f0',
                                    color: evt.completed ? '#ffffff' : '#64748b',
                                    borderRadius: 4,
                                    width: 18,
                                    height: 18,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Check size={11} />
                                </button>

                                {/* Delete / Remove Button */}
                                <button
                                  onClick={(e) => handleDeleteEvent(evt.id, e)}
                                  title="Remove follow-up from calendar"
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#94a3b8',
                                    padding: 2,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <div style={{
                              fontWeight: 700,
                              color: evt.completed ? '#64748b' : '#0f172a',
                              textDecoration: evt.completed ? 'line-through' : 'none',
                              marginBottom: 2
                            }}>
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
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 2: DAY VIEW (Hourly Breakdown with Quick Slots)
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
                background: '#f8fafc',
                flexWrap: 'wrap',
                gap: '0.75rem'
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
                      {currentSelectedDay.dayNumber < 10 && ' • (Day Passed)'}
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
              <div style={{ padding: '0.75rem 1.25rem', maxHeight: 580, overflowY: 'auto' }}>
                {dayHours.map((slot) => {
                  const hourEvents = activeDayEvents.filter((e) => e.hour === slot.hour);

                  return (
                    <div
                      key={slot.hour}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '85px 1fr',
                        borderBottom: '1px solid #f1f5f9',
                        minHeight: 64,
                        alignItems: 'start',
                        padding: '0.5rem 0'
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
                            {hourEvents.map((evt) => {
                              const passed = isEventPassed(evt);
                              const badge = getTypeBadgeStyle(evt.type, evt.completed, passed);

                              return (
                                <div
                                  key={evt.id}
                                  style={{
                                    background: evt.completed ? '#f8fafc' : badge.bg,
                                    border: `1px solid ${badge.border}`,
                                    borderLeft: `4px solid ${evt.completed ? '#10b981' : passed ? '#f59e0b' : '#2563eb'}`,
                                    borderRadius: 8,
                                    padding: '0.85rem 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    opacity: evt.completed ? 0.75 : 1
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 3, flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontWeight: 800,
                                        fontSize: '0.875rem',
                                        color: evt.completed ? '#64748b' : '#0f172a',
                                        textDecoration: evt.completed ? 'line-through' : 'none'
                                      }}>
                                        {evt.title}
                                      </span>
                                      <span style={{
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: badge.bg,
                                        color: badge.color,
                                        border: `1px solid ${badge.border}`,
                                        textTransform: 'uppercase'
                                      }}>
                                        {badge.label}
                                      </span>
                                    </div>

                                    <div style={{ fontSize: '0.8125rem', color: '#2563eb', fontWeight: 600 }}>
                                      {evt.company}
                                    </div>

                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                                      {evt.desc}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 6, fontSize: '0.75rem', color: '#475569', flexWrap: 'wrap' }}>
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

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 130 }}>
                                    {/* Mark Complete Button */}
                                    <button
                                      className={`btn btn-sm ${evt.completed ? 'btn-secondary' : 'btn-primary'}`}
                                      onClick={(e) => handleToggleComplete(evt.id, e)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                    >
                                      <Check size={13} />
                                      <span>{evt.completed ? 'Completed ✓' : 'Mark Done'}</span>
                                    </button>

                                    {/* Video call link */}
                                    {evt.videoUrl && !evt.completed && (
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleJoinCall(evt)}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                      >
                                        <Video size={13} />
                                        <span>Join Video</span>
                                      </button>
                                    )}

                                    {/* Remove / Delete Button */}
                                    <button
                                      onClick={(e) => handleDeleteEvent(evt.id, e)}
                                      className="btn btn-secondary btn-sm"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 4,
                                        color: '#dc2626',
                                        borderColor: '#fee2e2'
                                      }}
                                      title="Remove from calendar"
                                    >
                                      <Trash2 size={13} />
                                      <span>Remove</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div
                            onClick={() => handleOpenAddModal(selectedDayIndex, slot.hour)}
                            style={{
                              height: 38,
                              borderRadius: 6,
                              border: '1px dashed #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0 0.75rem',
                              color: '#94a3b8',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#93c5fd';
                              e.currentTarget.style.background = '#f8fafc';
                              e.currentTarget.style.color = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#94a3b8';
                            }}
                          >
                            <span>Available slot</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                              <Plus size={12} /> Schedule Follow-up
                            </span>
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
              VIEW 3: MONTH VIEW (Interactive Monthly Grid & Nav)
             ======================================================== */}
          {viewMode === 'Month' && (
            <div>
              {/* Month Header with Previous / Next Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                    title="Previous Month"
                    onClick={handlePrevMonth}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                    title="Next Month"
                    onClick={handleNextMonth}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginLeft: '0.5rem' }}>
                    {currentMonthYearLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-blue">{currentQuarterLabel}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleJumpToToday}
                  >
                    Jump to Today (10 Oct 2026)
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

              {/* Month Grid Cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0' }}>
                {monthDays.map((cell, idx) => {
                  const eventsOnThisDay = filteredEvents.filter((e) => {
                    if (!cell.isCurrentMonth) return false;
                    const evtMonth = e.monthIndex !== undefined ? e.monthIndex : 9;
                    const evtYear = e.year || 2026;
                    return evtYear === cell.year && evtMonth === cell.monthIndex && e.dayNumber === cell.day;
                  });

                  const isPast = (cell.year < 2026) ||
                                 (cell.year === 2026 && cell.monthIndex < 9) ||
                                 (cell.year === 2026 && cell.monthIndex === 9 && cell.day < 10);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (cell.isCurrentMonth) {
                          if (cell.year === 2026 && cell.monthIndex === 9) {
                            const matchedIdx = days.findIndex((d) => d.dayNumber === cell.day);
                            if (matchedIdx !== -1) {
                              setSelectedDayIndex(matchedIdx);
                              setViewMode('Day');
                              return;
                            }
                          }
                          // Schedule follow-up on this specific day
                          handleOpenAddModal(selectedDayIndex, 10);
                        }
                      }}
                      style={{
                        minHeight: 90,
                        padding: '0.45rem',
                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f1f5f9' : 'none',
                        borderBottom: '1px solid #f1f5f9',
                        background: cell.isToday
                          ? '#eff6ff'
                          : isPast
                          ? '#fafafa'
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
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          background: cell.isToday ? '#2563eb' : 'transparent',
                          color: cell.isToday ? '#ffffff' : cell.isCurrentMonth ? '#0f172a' : '#94a3b8'
                        }}>
                          {cell.day}
                        </span>

                        {cell.month && (
                          <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 600 }}>
                            {cell.month}
                          </span>
                        )}

                        {eventsOnThisDay.length > 0 && (
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
                              background: ev.completed ? '#f1f5f9' : '#dbeafe',
                              color: ev.completed ? '#64748b' : '#1e40af',
                              textDecoration: ev.completed ? 'line-through' : 'none',
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar: Dynamic Day Agenda & Follow-up Actions */}
        <div className="crm-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'fit-content' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                {viewMode === 'Day' ? `${currentSelectedDay.day} ${currentSelectedDay.date} Agenda` : "Today's Agenda"}
              </h3>
              <button
                onClick={() => handleOpenAddModal(selectedDayIndex, 10)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.6875rem' }}
                title="Add follow-up to this day"
              >
                <Plus size={13} /> Follow-up
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Confirmed demos, meetings & customer follow-ups
            </p>
          </div>

          {/* Quick Clean Up button if passed or completed items exist on this day */}
          {activeDayEvents.some((ev) => ev.completed || isEventPassed(ev)) && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: 8,
              padding: '0.6rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.6875rem', color: '#991b1b', fontWeight: 600 }}>
                Clean up passed / done items
              </span>
              <button
                onClick={handleCleanUpPassedAndCompleted}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Clear Now
              </button>
            </div>
          )}

          {/* Agenda List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeDayEvents.length > 0 ? (
              activeDayEvents.map((evt) => {
                const passed = isEventPassed(evt);
                const badge = getTypeBadgeStyle(evt.type, evt.completed, passed);

                return (
                  <div
                    key={evt.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 10,
                      background: evt.completed ? '#f8fafc' : badge.bg,
                      border: `1px solid ${badge.border}`,
                      borderLeft: `4px solid ${evt.completed ? '#10b981' : passed ? '#f59e0b' : '#2563eb'}`,
                      opacity: evt.completed ? 0.75 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: badge.color, fontWeight: 700, fontSize: '0.75rem' }}>
                        {evt.type === 'meeting' ? <Video size={13} /> : evt.type === 'call' ? <Phone size={13} /> : <UserCheck size={13} />}
                        <span style={{ textTransform: 'uppercase' }}>{badge.label}</span>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={(e) => handleToggleComplete(evt.id, e)}
                          title={evt.completed ? "Mark incomplete" : "Mark done"}
                          style={{
                            border: 'none',
                            background: evt.completed ? '#10b981' : '#e2e8f0',
                            color: evt.completed ? '#ffffff' : '#475569',
                            borderRadius: 4,
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteEvent(evt.id, e)}
                          title="Remove follow-up"
                          style={{
                            border: 'none',
                            background: '#fee2e2',
                            color: '#dc2626',
                            borderRadius: 4,
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      color: evt.completed ? '#64748b' : '#0f172a',
                      textDecoration: evt.completed ? 'line-through' : 'none'
                    }}>
                      {evt.title}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, marginTop: 1 }}>
                      {evt.company}
                    </div>

                    <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4 }}>
                      {evt.desc}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.6875rem', color: '#64748b' }}>
                      <Clock size={11} /> {evt.time}
                    </div>

                    {/* Join Video Bridge if meeting */}
                    {evt.videoUrl && !evt.completed && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '0.65rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                        onClick={() => handleJoinCall(evt)}
                      >
                        <Video size={13} />
                        <span>Join Video Bridge</span>
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                border: '1px dashed #e2e8f0',
                borderRadius: 10,
                color: '#94a3b8'
              }}>
                <CalendarIcon size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b' }}>
                  No follow-ups for this day
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                  Stay on top of accounts by scheduling a cadence call.
                </p>
                <button
                  onClick={() => handleOpenAddModal(selectedDayIndex, 10)}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.75rem' }}
                >
                  <Plus size={13} /> Add Follow-up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL: ADD CALENDAR EVENT / CUSTOMER FOLLOW-UP
         ======================================================== */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            maxWidth: 520,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                  Schedule Customer Follow-up / Event
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Creates an engagement event and synchronizes with cadence alerts
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateEventSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Follow-up / Event Title *
                </label>
                <input
                  type="text"
                  className="crm-input"
                  placeholder="e.g. Executive Follow-up on pricing proposal"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Type & Duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Engagement Type
                  </label>
                  <select
                    className="crm-input"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    <option value="follow-up">Follow-up Call / Note</option>
                    <option value="meeting">Discovery / Strategy Meeting</option>
                    <option value="call">Phone Call</option>
                    <option value="demo">Product Demo</option>
                    <option value="task">Internal Task / Review</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Duration
                  </label>
                  <select
                    className="crm-input"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                  >
                    <option value="15m">15 minutes</option>
                    <option value="30m">30 minutes</option>
                    <option value="45m">45 minutes</option>
                    <option value="1h">1 hour</option>
                  </select>
                </div>
              </div>

              {/* Company / Lead */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Related Account / Company
                </label>
                <input
                  type="text"
                  className="crm-input"
                  placeholder="e.g. Aarav Patel Enterprises, Acme Corp"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  list="companies-list"
                />
                <datalist id="companies-list">
                  {leads && leads.map((l) => (
                    <option key={l.id} value={l.company || l.name} />
                  ))}
                </datalist>
              </div>

              {/* Day of Week & Hour */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Scheduled Day
                  </label>
                  <select
                    className="crm-input"
                    value={newDayIndex}
                    onChange={(e) => setNewDayIndex(Number(e.target.value))}
                  >
                    {days.map((d, idx) => (
                      <option key={idx} value={idx}>
                        {d.day} ({d.date}) {d.isToday ? '— Today' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Start Time
                  </label>
                  <select
                    className="crm-input"
                    value={newHour}
                    onChange={(e) => setNewHour(Number(e.target.value))}
                  >
                    {dayHours.map((slot) => (
                      <option key={slot.hour} value={slot.hour}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Agenda / Follow-up Notes
                </label>
                <textarea
                  className="crm-input"
                  rows={2}
                  placeholder="Review contract clauses, discuss pricing tier, or verify API specs..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              {/* Sync to Tasks & To-Dos checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newSyncTask}
                  onChange={(e) => setNewSyncTask(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                />
                <span>Also add this to my <strong>Tasks & To-Dos</strong> queue</span>
              </label>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={15} />
                  <span>Save to Calendar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
