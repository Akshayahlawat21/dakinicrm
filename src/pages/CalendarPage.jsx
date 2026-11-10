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

// Real-world Today Reference (System date: 28 October 2026)
const TODAY = new Date();

// Helper to calculate Indian Financial Year Quarter:
// Q1: Apr–Jun, Q2: Jul–Sep, Q3: Oct–Dec, Q4: Jan–Mar
const getIndianFiscalQuarter = (dateObj) => {
  const m = dateObj.getMonth(); // 0 = Jan ... 11 = Dec
  const y = dateObj.getFullYear();
  const nextYShort = String(y + 1).slice(-2);
  const curYShort = String(y).slice(-2);
  const prevYShort = String(y - 1).slice(-2);

  if (m >= 3 && m <= 5) return `Q1 FY${curYShort}-${nextYShort} (Apr–Jun)`;
  if (m >= 6 && m <= 8) return `Q2 FY${curYShort}-${nextYShort} (Jul–Sep)`;
  if (m >= 9 && m <= 11) return `Q3 FY${curYShort}-${nextYShort} (Oct–Dec)`;
  return `Q4 FY${prevYShort}-${curYShort} (Jan–Mar)`;
};

const INITIAL_EVENTS = [
  {
    id: 'evt-1',
    title: "Discovery Demo with Aarav Patel",
    company: "Aarav Patel Enterprises",
    time: "10:00 AM - 10:45 AM",
    hour: 10,
    dayNumber: 28,
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
    dayNumber: 28,
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
    title: "Review SOC2 Security Docs",
    company: "HDFC Securities",
    time: "4:00 PM - 4:30 PM",
    hour: 16,
    dayNumber: 28,
    monthIndex: 9,
    year: 2026,
    type: "task",
    attendees: ["Sunita Rao (CISO)"],
    desc: "Cross-verify penetration test reports with compliance team.",
    videoUrl: null,
    completed: false
  },
  {
    id: 'evt-4',
    title: "Executive Follow-up with Priya Sharma",
    company: "Acme Corp",
    time: "11:30 AM - 12:00 PM",
    hour: 11,
    dayNumber: 27,
    monthIndex: 9,
    year: 2026,
    type: "follow-up",
    attendees: ["Priya Sharma (VP)", "Elena Rostova"],
    desc: "Review procurement checklist and Docusign MSA execution steps.",
    videoUrl: "https://meet.google.com/dak-acme-exec",
    completed: false
  },
  {
    id: 'evt-5',
    title: "Weekly Enterprise Pipeline Standup",
    company: "Dakini Sales Leadership",
    time: "9:00 AM - 9:45 AM",
    hour: 9,
    dayNumber: 26,
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
    dayNumber: 29,
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
    dayNumber: 30,
    monthIndex: 9,
    year: 2026,
    type: "demo",
    attendees: ["Vikram Malhotra", "Solutions Architect"],
    desc: "Live walkthrough of Dakini autonomous lead scoring triggers.",
    videoUrl: "https://meet.google.com/dak-tata-sandbox",
    completed: false
  }
];

export default function CalendarPage() {
  const navigate = useNavigate();
  const { leads, addTask } = useCRM();

  const [viewMode, setViewMode] = useState('Week'); // 'Day' | 'Week' | 'Month'
  const [meetingAlert, setMeetingAlert] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Follow-ups' | 'Upcoming' | 'Completed' | 'Passed'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dynamic Current Week Start (Monday of current week)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const day = TODAY.getDay();
    const mondayOffset = (day + 6) % 7; // Monday = 0
    const monday = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Selected Day index within the active week (0 to 6, default to Today's day of week)
  const todayWeekIndex = (TODAY.getDay() + 6) % 7;
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayWeekIndex);

  // Month navigation state
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));

  // Load events from localStorage or fallback
  const [events, setEvents] = useState(() => {
    try {
      const saved = localStorage.getItem('dakini_calendar_events_v3');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved calendar events', e);
    }
    return INITIAL_EVENTS;
  });

  // Save to localStorage on any change
  useEffect(() => {
    try {
      localStorage.setItem('dakini_calendar_events_v3', JSON.stringify(events));
    } catch (e) {
      console.warn('Failed to save calendar events', e);
    }
  }, [events]);

  // Form state for creating a follow-up or meeting
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newType, setNewType] = useState('follow-up'); // 'follow-up' | 'meeting' | 'call' | 'demo' | 'task'
  const [newDayIndex, setNewDayIndex] = useState(todayWeekIndex);
  const [newHour, setNewHour] = useState(10);
  const [newDuration, setNewDuration] = useState('30m');
  const [newAttendees, setNewAttendees] = useState('Elena Rostova');
  const [newDesc, setNewDesc] = useState('');
  const [newSyncTask, setNewSyncTask] = useState(true);

  // Dynamically generate the 7 days of the active week from currentWeekStart
  const days = React.useMemo(() => {
    const daysArr = [];
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const fullDayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate() + i);
      const isToday = (
        d.getDate() === TODAY.getDate() &&
        d.getMonth() === TODAY.getMonth() &&
        d.getFullYear() === TODAY.getFullYear()
      );

      const monthShort = d.toLocaleString('en-IN', { month: 'short' });
      const fullMonth = d.toLocaleString('en-IN', { month: 'long' });

      daysArr.push({
        dateObj: d,
        day: dayNames[i],
        date: `${d.getDate()} ${monthShort}`,
        dayNumber: d.getDate(),
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        isToday,
        fullDate: `${fullDayNames[i]}, ${d.getDate()} ${fullMonth} ${d.getFullYear()}${isToday ? ' (Today)' : ''}`,
        dayIndex: i
      });
    }
    return daysArr;
  }, [currentWeekStart]);

  // Week navigation
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
  };

  // Month navigation
  const handlePrevMonth = () => {
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Jump to Today
  const handleJumpToToday = () => {
    const day = TODAY.getDay();
    const mondayOffset = (day + 6) % 7;
    const monday = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    setCurrentWeekStart(monday);
    setSelectedMonthDate(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
    setSelectedDayIndex(mondayOffset);
    setMeetingAlert(`Navigated to Today: ${TODAY.getDate()} ${TODAY.toLocaleString('en-IN', { month: 'short' })} ${TODAY.getFullYear()}! 📍`);
    setTimeout(() => setMeetingAlert(null), 3000);
  };

  const currentMonthYearLabel = selectedMonthDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const currentFiscalQuarterLabel = getIndianFiscalQuarter(selectedMonthDate);

  // Dynamic Month Days grid with Indian calendar leap year support
  const monthDays = React.useMemo(() => {
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth();

    // First day of month (0 = Sun ... 6 = Sat)
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    // Monday-first offset
    const startOffset = (firstDayOfWeek + 6) % 7;

    // JavaScript Date automatically accounts for leap years in February!
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const prevMonthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'short' });
    const nextMonthName = new Date(year, month + 1, 1).toLocaleString('en-IN', { month: 'short' });

    const cells = [];

    // Preceding trailing days from previous month
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
      const isToday = (
        year === TODAY.getFullYear() &&
        month === TODAY.getMonth() &&
        d === TODAY.getDate()
      );

      cells.push({
        day: d,
        isCurrentMonth: true,
        isToday,
        year,
        monthIndex: month
      });
    }

    // Trailing days from next month to complete 35 or 42 grid slots
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
  }, [selectedMonthDate]);

  // Helper: check if day of event has passed relative to Real-world Today
  const isEventPassed = (evt) => {
    if (evt.completed) return false;
    const evtYear = evt.year || TODAY.getFullYear();
    const evtMonth = evt.monthIndex !== undefined ? evt.monthIndex : TODAY.getMonth();
    const evtDay = evt.dayNumber !== undefined ? evt.dayNumber : TODAY.getDate();

    const evtDate = new Date(evtYear, evtMonth, evtDay);
    const todayDate = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

    return evtDate < todayDate;
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
    setSelectedMonthDate(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
    setMeetingAlert("Reset calendar schedule to Indian real-world dates.");
    setTimeout(() => setMeetingAlert(null), 3000);
  };

  // Open modal with specific day / hour
  const handleOpenAddModal = (dayIdx = selectedDayIndex, hourVal = 10) => {
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

    const matchedDay = days[newDayIndex] || days[0];
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
      dayNumber: matchedDay.dayNumber,
      monthIndex: matchedDay.monthIndex,
      year: matchedDay.year,
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
  const currentSelectedDay = days[selectedDayIndex] || days[0];

  // Match events for selected day
  const activeDayEvents = filteredEvents.filter((e) => {
    const eYear = e.year || TODAY.getFullYear();
    const eMonth = e.monthIndex !== undefined ? e.monthIndex : TODAY.getMonth();
    const eDay = e.dayNumber;
    return (
      eYear === currentSelectedDay.year &&
      eMonth === currentSelectedDay.monthIndex &&
      eDay === currentSelectedDay.dayNumber
    );
  });

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
      return { bg: 'var(--success-bg)', color: 'var(--success-text-dark)', border: 'var(--success-border)', label: 'COMPLETED' };
    }
    if (passed) {
      return { bg: 'var(--warning-bg)', color: 'var(--warning-text-dark)', border: 'var(--warning-border)', label: 'PASSED' };
    }
    switch (type) {
      case 'follow-up':
        return { bg: 'var(--warning-bg)', color: 'var(--warning-text)', border: 'var(--warning-border)', label: 'FOLLOW-UP' };
      case 'call':
        return { bg: 'var(--success-bg)', color: 'var(--success-text-dark)', border: 'var(--success-border)', label: 'CALL' };
      case 'demo':
        return { bg: 'var(--purple-bg)', color: 'var(--purple-text)', border: 'rgba(168, 85, 247, 0.28)', label: 'DEMO' };
      case 'review':
        return { bg: 'var(--surface-soft)', color: 'var(--text-body)', border: 'var(--border-default)', label: 'REVIEW' };
      default:
        return { bg: 'var(--primary-light)', color: 'var(--primary-dark)', border: 'rgba(59, 130, 246, 0.28)', label: 'MEETING' };
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Feedback Alert Toast */}
      {meetingAlert && (
        <div style={{
          background: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          color: 'var(--success-text-dark)',
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
            <Sparkles size={16} color="var(--success-text)" />
            <span>{meetingAlert}</span>
          </div>
          <button
            onClick={() => setMeetingAlert(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success-text-dark)' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Calendar & Follow-ups
            </h1>
            <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
              {events.length} Events Total
            </span>
            <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>
              Today: {TODAY.getDate()} {TODAY.toLocaleString('en-IN', { month: 'short' })} {TODAY.getFullYear()}
            </span>
            {passedCount > 0 && (
              <span className="badge badge-amber" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                <AlertTriangle size={12} /> {passedCount} Passed
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Real-world Indian calendar scheduling, customer demos, and executive cadences
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Day / Week / Month Toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-alt)', borderRadius: 8, padding: 3, border: '1px solid var(--border-default)' }}>
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
                  background: viewMode === m ? 'var(--bg-card)' : 'transparent',
                  color: viewMode === m ? 'var(--primary)' : 'var(--text-muted)',
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
                background: 'var(--danger-bg)',
                borderColor: 'var(--danger-border)',
                color: 'var(--danger-text)',
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
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 10,
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                borderColor: statusFilter === tab ? 'var(--primary)' : 'var(--border-default)',
                background: statusFilter === tab ? 'var(--primary-light)' : 'var(--bg-card)',
                color: statusFilter === tab ? 'var(--primary)' : 'var(--text-body)',
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
            onClick={handleJumpToToday}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', fontWeight: 600 }}
          >
            Jump to Today
          </button>
          <button
            onClick={handleResetDefaults}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
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
              VIEW 1: WEEK VIEW (Real-world Week Navigation & Slots)
             ======================================================== */}
          {viewMode === 'Week' && (
            <div>
              {/* Week Navigation Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.25rem',
                borderBottom: '1px solid var(--border-default)',
                background: 'var(--surface-soft)',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                    title="Previous Week"
                    onClick={handlePrevWeek}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                    title="Next Week"
                    onClick={handleNextWeek}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginLeft: '0.5rem' }}>
                    Week of {days[0].date} – {days[6].date} {days[6].year}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-blue">
                    {getIndianFiscalQuarter(days[0].dateObj)}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleJumpToToday}
                  >
                    Today ({TODAY.getDate()} {TODAY.toLocaleString('en-IN', { month: 'short' })})
                  </button>
                </div>
              </div>

              {/* Days Columns Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-default)', background: 'var(--surface-soft)' }}>
                {days.map((d, i) => {
                  const dayEvts = filteredEvents.filter((e) => {
                    const eYear = e.year || TODAY.getFullYear();
                    const eMonth = e.monthIndex !== undefined ? e.monthIndex : TODAY.getMonth();
                    return eYear === d.year && eMonth === d.monthIndex && e.dayNumber === d.dayNumber;
                  });

                  const isPassed = new Date(d.year, d.monthIndex, d.dayNumber) < new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDayIndex(i)}
                      style={{
                        padding: '0.85rem 0.5rem',
                        textAlign: 'center',
                        borderRight: i < 6 ? '1px solid var(--border-default)' : 'none',
                        background: d.isToday
                          ? 'var(--primary-light)'
                          : selectedDayIndex === i
                          ? 'var(--surface-alt)'
                          : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: d.isToday ? 'var(--primary)' : isPassed ? 'var(--text-subtle)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 3
                      }}>
                        {d.day}
                        {d.isToday && (
                          <span style={{ fontSize: '0.625rem', padding: '1px 4px', borderRadius: 3, background: '#2563eb', color: '#fff', fontWeight: 800 }}>
                            TODAY
                          </span>
                        )}
                        {isPassed && <span style={{ fontSize: '0.65rem', color: 'var(--warning-text)' }}>•</span>}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: d.isToday ? 'var(--primary)' : isPassed ? 'var(--text-muted)' : 'var(--text-main)' }}>
                        {d.date}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: dayEvts.length > 0 ? 'var(--primary)' : 'var(--text-subtle)', fontWeight: 600 }}>
                        {dayEvts.length} {dayEvts.length === 1 ? 'event' : 'events'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Week Time Slots Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 520 }}>
                {days.map((d, colIdx) => {
                  const dayEvents = filteredEvents.filter((e) => {
                    const eYear = e.year || TODAY.getFullYear();
                    const eMonth = e.monthIndex !== undefined ? e.monthIndex : TODAY.getMonth();
                    return eYear === d.year && eMonth === d.monthIndex && e.dayNumber === d.dayNumber;
                  });

                  const isPassed = new Date(d.year, d.monthIndex, d.dayNumber) < new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());

                  return (
                    <div
                      key={colIdx}
                      style={{
                        borderRight: colIdx < 6 ? '1px solid var(--border-default)' : 'none',
                        padding: '0.5rem',
                        background: d.isToday
                          ? 'var(--primary-light)'
                          : isPassed
                          ? 'var(--surface-soft)'
                          : 'var(--bg-card)',
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
                          border: '1px dashed var(--border-strong)',
                          borderRadius: 6,
                          padding: '0.35rem',
                          color: 'var(--text-muted)',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4
                        }}
                        title={`Add follow-up on ${d.day} ${d.date}`}
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
                              background: evt.completed ? 'var(--surface-soft)' : badge.bg,
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
                                    background: evt.completed ? '#10b981' : 'var(--surface-alt)',
                                    color: evt.completed ? '#ffffff' : 'var(--text-muted)',
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
                                    color: 'var(--text-subtle)',
                                    padding: 2,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-subtle)')}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <div style={{
                              fontWeight: 700,
                              color: evt.completed ? 'var(--text-muted)' : 'var(--text-main)',
                              textDecoration: evt.completed ? 'line-through' : 'none',
                              marginBottom: 2
                            }}>
                              {evt.title}
                            </div>

                            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.6875rem' }}>
                              {evt.company}
                            </div>

                            <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
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
              VIEW 2: DAY VIEW (Real-world Hourly Timeline)
             ======================================================== */}
          {viewMode === 'Day' && (
            <div>
              {/* Day View Header & Switcher */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border-default)',
                background: 'var(--surface-soft)',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                    onClick={() => setSelectedDayIndex((prev) => (prev > 0 ? prev - 1 : 6))}
                    title="Previous Day"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.35rem 0.5rem', cursor: 'pointer' }}
                    onClick={() => setSelectedDayIndex((prev) => (prev < 6 ? prev + 1 : 0))}
                    title="Next Day"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div style={{ marginLeft: '0.5rem' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {currentSelectedDay.fullDate}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {activeDayEvents.length} {activeDayEvents.length === 1 ? 'event' : 'events'} scheduled
                      {isEventPassed({ dayNumber: currentSelectedDay.dayNumber, monthIndex: currentSelectedDay.monthIndex, year: currentSelectedDay.year }) && ' • (Day Passed)'}
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
                        borderColor: selectedDayIndex === idx ? 'var(--primary)' : 'var(--border-default)',
                        background: selectedDayIndex === idx ? 'var(--primary-light)' : 'var(--bg-card)',
                        color: selectedDayIndex === idx ? 'var(--primary)' : 'var(--text-body)',
                        cursor: 'pointer'
                      }}
                    >
                      {d.day} {d.dayNumber}
                      {d.isToday && ' •'}
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
                        borderBottom: '1px solid var(--border-default)',
                        minHeight: 64,
                        alignItems: 'start',
                        padding: '0.5rem 0'
                      }}
                    >
                      {/* Hour Label */}
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', paddingTop: '0.4rem' }}>
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
                                    background: evt.completed ? 'var(--surface-soft)' : badge.bg,
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
                                        color: evt.completed ? 'var(--text-muted)' : 'var(--text-main)',
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

                                    <div style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                                      {evt.company}
                                    </div>

                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                      {evt.desc}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: 6, fontSize: '0.75rem', color: 'var(--text-body)', flexWrap: 'wrap' }}>
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



                                    {/* Remove / Delete Button */}
                                    <button
                                      onClick={(e) => handleDeleteEvent(evt.id, e)}
                                      className="btn btn-secondary btn-sm"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 4,
                                        color: 'var(--danger-text)',
                                        borderColor: 'var(--danger-border)'
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
                              border: '1px dashed var(--border-default)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0 0.75rem',
                              color: 'var(--text-subtle)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary)';
                              e.currentTarget.style.background = 'var(--surface-soft)';
                              e.currentTarget.style.color = 'var(--primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-default)';
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--text-subtle)';
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
              VIEW 3: MONTH VIEW (Indian Calendar & Leap Year Support)
             ======================================================== */}
          {viewMode === 'Month' && (
            <div>
              {/* Month Header with Previous / Next Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border-default)',
                background: 'var(--surface-soft)',
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
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginLeft: '0.5rem' }}>
                    {currentMonthYearLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-blue">{currentFiscalQuarterLabel}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleJumpToToday}
                  >
                    Jump to Today ({TODAY.getDate()} {TODAY.toLocaleString('en-IN', { month: 'short' })})
                  </button>
                </div>
              </div>

              {/* Month Day Names */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--surface-soft)', borderBottom: '1px solid var(--border-default)' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => (
                  <div key={idx} style={{ padding: '0.65rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)' }}>
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Month Grid Cells with accurate leap year / month boundaries */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-default)' }}>
                {monthDays.map((cell, idx) => {
                  const eventsOnThisDay = filteredEvents.filter((e) => {
                    if (!cell.isCurrentMonth) return false;
                    const evtMonth = e.monthIndex !== undefined ? e.monthIndex : TODAY.getMonth();
                    const evtYear = e.year || TODAY.getFullYear();
                    return evtYear === cell.year && evtMonth === cell.monthIndex && e.dayNumber === cell.day;
                  });

                  const cellDate = new Date(cell.year, cell.monthIndex, cell.day);
                  const todayDate = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
                  const isPast = cellDate < todayDate;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (cell.isCurrentMonth) {
                          // Jump to this week if it matches
                          const matchedIdx = days.findIndex((d) => d.dayNumber === cell.day && d.monthIndex === cell.monthIndex && d.year === cell.year);
                          if (matchedIdx !== -1) {
                            setSelectedDayIndex(matchedIdx);
                            setViewMode('Day');
                            return;
                          }
                          // Or open follow-up modal
                          handleOpenAddModal(selectedDayIndex, 10);
                        }
                      }}
                      style={{
                        minHeight: 90,
                        padding: '0.45rem',
                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-default)' : 'none',
                        borderBottom: '1px solid var(--border-default)',
                        background: cell.isToday
                          ? 'var(--primary-light)'
                          : isPast
                          ? 'var(--surface-soft)'
                          : cell.isCurrentMonth
                          ? 'var(--bg-card)'
                          : 'var(--surface-soft)',
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
                          color: cell.isToday ? '#ffffff' : cell.isCurrentMonth ? 'var(--text-main)' : 'var(--text-subtle)'
                        }}>
                          {cell.day}
                        </span>

                        {cell.month && (
                          <span style={{ fontSize: '0.625rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                            {cell.month}
                          </span>
                        )}

                        {eventsOnThisDay.length > 0 && (
                          <span style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'var(--primary)',
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
                              background: ev.completed ? 'var(--surface-alt)' : 'var(--primary-light)',
                              color: ev.completed ? 'var(--text-muted)' : 'var(--primary-dark)',
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
                          <div style={{ fontSize: '0.625rem', color: 'var(--primary)', fontWeight: 700 }}>
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
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {viewMode === 'Day' ? `${currentSelectedDay.day} ${currentSelectedDay.date} Agenda` : `Agenda: ${currentSelectedDay.day} ${currentSelectedDay.date}`}
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
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Confirmed demos, meetings & customer follow-ups
            </p>
          </div>

          {/* Quick Clean Up button if passed or completed items exist on this day */}
          {activeDayEvents.some((ev) => ev.completed || isEventPassed(ev)) && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 8,
              padding: '0.6rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--danger-text-dark)', fontWeight: 600 }}>
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
                      background: evt.completed ? 'var(--surface-soft)' : badge.bg,
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
                            background: evt.completed ? '#10b981' : 'var(--surface-alt)',
                            color: evt.completed ? '#ffffff' : 'var(--text-body)',
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
                            background: 'var(--danger-bg)',
                            color: 'var(--danger-text)',
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
                      color: evt.completed ? 'var(--text-muted)' : 'var(--text-main)',
                      textDecoration: evt.completed ? 'line-through' : 'none'
                    }}>
                      {evt.title}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginTop: 1 }}>
                      {evt.company}
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-body)', marginTop: 4 }}>
                      {evt.desc}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      <Clock size={11} /> {evt.time}
                    </div>


                  </div>
                );
              })
            ) : (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                border: '1px dashed var(--border-default)',
                borderRadius: 10,
                color: 'var(--text-subtle)'
              }}>
                <CalendarIcon size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  No follow-ups for this day
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 4 }}>
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
            background: 'var(--bg-card)',
            borderRadius: 16,
            maxWidth: 520,
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-soft)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Schedule Customer Follow-up / Event
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Creates an engagement event and synchronizes with cadence alerts
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateEventSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 4 }}>
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 4 }}>
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 4 }}>
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
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 4 }}>
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 4 }}>
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 4 }}>
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
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-body)', marginBottom: 4 }}>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-body)', cursor: 'pointer' }}>
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
