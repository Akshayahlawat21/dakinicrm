import React, { useState } from 'react';

// ==========================================================================
// 1. Interactive Sparkline
// ==========================================================================
export function Sparkline({ points = [12, 14, 11, 18, 16, 21, 25.5], width = 120, height = 36, color = "#2563eb" }) {
  const safePoints = Array.isArray(points) && points.length ? points.map((value) => Number(value) || 0) : [0];
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const range = max - min || 1;
  const padding = 3;

  const coords = safePoints.map((val, idx) => {
    const x = padding + (safePoints.length < 2 ? 0.5 : idx / (safePoints.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return { x, y, val };
  });

  const pathD = coords.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), "");
  const fillD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#sparklineGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3.5" fill={color} />
    </svg>
  );
}

// ==========================================================================
// 2. Radial Progress Donut (Sales Target 20%)
// ==========================================================================
export function RadialProgressDonut({ percent = 20, size = 74, strokeWidth = 8, color = "#2563eb" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span style={{ position: 'absolute', fontSize: '0.8125rem', fontWeight: 800, color: '#0f172a' }}>
        {percent}%
      </span>
    </div>
  );
}

// ==========================================================================
// 3. Interactive Monthly Revenue Trend Chart (Line / Area with hover tooltip)
// ==========================================================================
export function RevenueTrendChart({ data = [] }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  if (data.some((item) => item.revenue == null)) {
    return <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#64748b' }}>Revenue trend contains multiple currencies. Select a single currency to compare monetary values accurately.</div>;
  }
  const chartData = data.map((item) => ({
    month: item.month,
    label: new Date(`${item.month}T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
    revenue: Number.isFinite(Number(item.revenue)) ? Number(item.revenue) : 0,
    target: item.target == null ? null : Number(item.target)
  }));
  if (!chartData.length) {
    return <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>No revenue trend data available for this organization.</div>;
  }
  const chartWidth = 460;
  const chartHeight = 180;
  const px = 42;
  const py = 20;
  const series = chartData.flatMap((d) => d.target == null ? [d.revenue] : [d.revenue, d.target]);
  const maxVal = Math.max(1, ...series) * 1.12;
  const pointX = (i) => px + (chartData.length <= 1 ? 0.5 : i / (chartData.length - 1)) * (chartWidth - px * 2);
  const pointY = (v) => chartHeight - py - (v / maxVal) * (chartHeight - py * 2);
  const actualPoints = chartData.map((d, i) => ({ x: pointX(i), y: pointY(d.revenue), val: d.revenue }));
  const targetPoints = chartData.filter((d) => d.target != null).map((d) => ({ x: pointX(chartData.indexOf(d)), y: pointY(d.target), val: d.target }));
  const path = (pts) => pts.map((pt, i) => `${i ? 'L' : 'M'} ${pt.x} ${pt.y}`).join(' ');
  const actualPath = path(actualPoints);
  const targetPath = path(targetPoints);
  const area = `${actualPath} L ${actualPoints[actualPoints.length - 1].x} ${chartHeight - py} L ${actualPoints[0].x} ${chartHeight - py} Z`;
  const hovered = hoverIndex == null ? null : actualPoints[hoverIndex];
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 600 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }} />Actual revenue</span>
        {targetPoints.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b' }}><span style={{ width: 12, borderTop: '2px dashed #94a3b8' }} />Target pace</span>}
      </div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} role="img" aria-label="Monthly revenue trend">
        <defs><linearGradient id="revGradientDynamic" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((pct) => <line key={pct} x1={px} y1={chartHeight - py - pct * (chartHeight - py * 2)} x2={chartWidth - px} y2={chartHeight - py - pct * (chartHeight - py * 2)} stroke="#f1f5f9" strokeDasharray="4 4" />)}
        {targetPath && <path d={targetPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" />}
        <path d={area} fill="url(#revGradientDynamic)" />
        <path d={actualPath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {actualPoints.map((pt, idx) => <g key={chartData[idx].month} onMouseEnter={() => setHoverIndex(idx)} onFocus={() => setHoverIndex(idx)} tabIndex={0} style={{ cursor: 'pointer' }}>
          <circle cx={pt.x} cy={pt.y} r={hoverIndex === idx ? 6 : 4} fill="#fff" stroke="#2563eb" strokeWidth="2.5" />
          <text x={pt.x} y={chartHeight - 2} textAnchor="middle" fontSize="10" fill={hoverIndex === idx ? '#2563eb' : '#64748b'} fontWeight={hoverIndex === idx ? '700' : '500'}>{chartData[idx].label}</text>
        </g>)}
      </svg>
      {hovered && <div style={{ textAlign: 'center', color: '#334155', fontSize: '0.75rem', fontWeight: 700, marginTop: 4 }}>{chartData[hoverIndex].label}: ${hovered.val.toLocaleString()}</div>}
    </div>
  );
}
export function PipelineStageChart({ data = [] }) {
  const [activeStage, setActiveStage] = useState(null);
  const palette = ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#cbd5e1"];
  const stages = data.map((item, index) => ({
    name: String(item.stage || 'Unspecified'),
    value: Number(item.value) || 0,
    count: Number(item.opportunity_count) || 0,
    color: palette[index % palette.length]
  }));

  const maxValue = Math.max(1, ...stages.map((stage) => stage.value)) * 1.12;
  const maxBarHeight = 130;

  return (
    <div style={{ width: '100%' }}>
      {stages.length === 0 ? <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>No open pipeline data available.</div> : <><div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 180,
        gap: '0.75rem',
        padding: '0 0.5rem 0.5rem 0.5rem',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {stages.map((stg, i) => {
          const height = (stg.value / maxValue) * maxBarHeight;
          const isHovered = activeStage === i;
          return (
            <div
              key={stg.name}
              onMouseEnter={() => setActiveStage(i)}
              onMouseLeave={() => setActiveStage(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                cursor: 'pointer'
              }}
            >
              <span style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: isHovered ? '#2563eb' : '#64748b',
                marginBottom: 6,
                opacity: isHovered ? 1 : 0.85,
                transition: 'all 0.15s ease'
              }}>
                ${(stg.value / 1000).toFixed(0)}k
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: 38,
                  height: `${height}px`,
                  background: isHovered ? 'linear-gradient(180deg, #38bdf8 0%, #2563eb 100%)' : stg.color,
                  borderRadius: '6px 6px 2px 2px',
                  boxShadow: isHovered ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none',
                  transform: isHovered ? 'scaleY(1.04)' : 'scaleY(1)',
                  transformOrigin: 'bottom',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Stage Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem', padding: '0 0.5rem' }}>
        {stages.map((stg, i) => (
          <div key={stg.name} style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              fontSize: '0.6875rem',
              fontWeight: activeStage === i ? 700 : 600,
              color: activeStage === i ? '#2563eb' : '#475569',
              whiteSpace: 'nowrap'
            }}>
              {stg.name}
            </span>
          </div>
        ))}
      </div></>}
    </div>
  );
}

// ==========================================================================
// 5. Lead Source Donut Chart (Reports Page)
// ==========================================================================
export function LeadSourceDonutChart({ data = [], totalLeads }) {
  const palette = ["#2563eb", "#38bdf8", "#1d4ed8", "#93c5fd", "#0f766e", "#7c3aed", "#64748b"];
  const total = totalLeads == null ? data.reduce((sum, item) => sum + (Number(item.lead_count) || 0), 0) : Number(totalLeads) || 0;
  const rows = data.map((item, index) => {
    const count = Number(item.lead_count) || 0;
    return { label: item.source || 'Unknown', count, percent: total ? count * 100 / total : 0, color: palette[index % palette.length] };
  });
  const size = 150;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {rows.filter((r) => r.count > 0 && total > 0).map((item) => {
            const dash = item.percent / 100 * circumference;
            const circle = <circle key={item.label} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={item.color} strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circumference}`} strokeDashoffset={-offset} />;
            offset += dash;
            return circle;
          })}
          {(!rows.length || total === 0) && <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Total Leads</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 160 }}>
        {!rows.length || total === 0 ? <div style={{ color: '#64748b', fontSize: '0.8125rem' }}>No lead source data available for this period.</div> : rows.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              <span style={{ color: '#334155', fontWeight: 500 }}>{item.label} <span style={{ color: '#64748b' }}>({item.count})</span></span>
            </div>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ConversionFunnelChart({ data = [] }) {
  const palette = ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"];
  const steps = data.map((item, index) => ({
    stage: item.stage || `Stage ${index + 1}`,
    count: Number(item.count) || 0,
    percent: item.conversion_from_previous_percent,
    available: item.available !== false,
    color: palette[index % palette.length]
  }));
  const maxCount = Math.max(1, ...steps.map((s) => s.count));
  if (!steps.length) return <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>No conversion funnel data available for this period.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {steps.map((step) => (
        <div key={step.stage} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
            <span>{step.stage}</span>
            <span style={{ color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>{step.available ? step.count.toLocaleString() : 'N/A'}{step.percent == null ? '' : ` (${step.percent.toFixed ? step.percent.toFixed(1) : step.percent}%)`}</span>
          </div>
          <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${step.available ? Math.max(0, step.count / maxCount * 100) : 0}%`, background: step.color, borderRadius: 6, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
