import React, { useState } from 'react';

// ==========================================================================
// 1. Interactive Sparkline
// ==========================================================================
export function Sparkline({ points = [12, 14, 11, 18, 16, 21, 25.5], width = 120, height = 36, color = "#2563eb" }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padding = 3;

  const coords = points.map((val, idx) => {
    const x = padding + (idx / (points.length - 1)) * (width - padding * 2);
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
export function RevenueTrendChart() {
  const [hoverIndex, setHoverIndex] = useState(5);

  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const actualValues = [4200, 5600, 7100, 9400, 16800, 25500];
  const targetValues = [5000, 7500, 10000, 14000, 19000, 26000];

  const maxVal = 28000;
  const chartHeight = 170;
  const chartWidth = 460;
  const paddingX = 40;
  const paddingY = 20;

  const actualPoints = actualValues.map((val, idx) => {
    const x = paddingX + (idx / (actualValues.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (val / maxVal) * (chartHeight - paddingY * 2);
    return { x, y, val };
  });

  const targetPoints = targetValues.map((val, idx) => {
    const x = paddingX + (idx / (targetValues.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (val / maxVal) * (chartHeight - paddingY * 2);
    return { x, y, val };
  });

  // Generate smooth curve path
  const createSmoothPath = (pts) => {
    return pts.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, "");
  };

  const actualPath = createSmoothPath(actualPoints);
  const targetPath = createSmoothPath(targetPoints);
  const actualArea = `${actualPath} L ${actualPoints[actualPoints.length - 1].x} ${chartHeight - paddingY} L ${actualPoints[0].x} ${chartHeight - paddingY} Z`;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb' }}></span>
          <span style={{ color: '#475569', fontWeight: 600 }}>Actual Revenue</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 10, height: 2, background: '#94a3b8' }}></span>
          <span style={{ color: '#64748b' }}>Target Pace</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        <defs>
          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = chartHeight - paddingY - pct * (chartHeight - paddingY * 2);
          return (
            <line
              key={i}
              x1={paddingX}
              y1={y}
              x2={chartWidth - paddingX}
              y2={y}
              stroke="#f1f5f9"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Target Dotted Line */}
        <path d={targetPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" />

        {/* Area fill */}
        <path d={actualArea} fill="url(#revGradient)" />

        {/* Actual Line */}
        <path d={actualPath} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

        {/* Data points & Interaction */}
        {actualPoints.map((pt, idx) => (
          <g key={idx} onMouseEnter={() => setHoverIndex(idx)} style={{ cursor: 'pointer' }}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoverIndex === idx ? 6 : 4}
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="2.5"
              style={{ transition: 'r 0.15s ease' }}
            />
            {/* Month labels */}
            <text
              x={pt.x}
              y={chartHeight - 2}
              textAnchor="middle"
              fontSize="11"
              fill={hoverIndex === idx ? "#2563eb" : "#64748b"}
              fontWeight={hoverIndex === idx ? "700" : "500"}
            >
              {months[idx]}
            </text>
          </g>
        ))}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoverIndex !== null && (
        <div style={{
          position: 'absolute',
          top: actualPoints[hoverIndex].y - 38,
          left: `calc(${(actualPoints[hoverIndex].x / chartWidth) * 100}% - 48px)`,
          background: '#0f172a',
          color: '#ffffff',
          padding: '0.25rem 0.55rem',
          borderRadius: 6,
          fontSize: '0.75rem',
          fontWeight: 700,
          pointerEvents: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
          zIndex: 10
        }}>
          ${actualValues[hoverIndex].toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// 4. Pipeline by Stage Bar Chart (Salesforce Stages)
// ==========================================================================
export function PipelineStageChart() {
  const [activeStage, setActiveStage] = useState(null);

  const stages = [
    { name: "New", value: 18000, count: 6, color: "#93c5fd" },
    { name: "Qualified", value: 37000, count: 5, color: "#60a5fa" },
    { name: "Proposal", value: 48000, count: 3, color: "#3b82f6" },
    { name: "Negotiation", value: 38000, count: 2, color: "#2563eb" },
    { name: "Won", value: 25500, count: 1, color: "#1d4ed8" },
    { name: "Lost", value: 8000, count: 2, color: "#cbd5e1" }
  ];

  const maxValue = 55000;
  const maxBarHeight = 130;

  return (
    <div style={{ width: '100%' }}>
      <div style={{
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
      </div>
    </div>
  );
}

// ==========================================================================
// 5. Lead Source Donut Chart (Reports Page)
// ==========================================================================
export function LeadSourceDonutChart() {
  const data = [
    { label: "Website Demo", value: 42, color: "#2563eb" },
    { label: "Outbound SDR", value: 28, color: "#38bdf8" },
    { label: "Partner Referral", value: 18, color: "#1d4ed8" },
    { label: "Paid Search", value: 12, color: "#93c5fd" }
  ];

  const size = 150;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {data.map((item, idx) => {
            const strokeDasharray = `${(item.value / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -currentOffset;
            currentOffset += (item.value / 100) * circumference;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>248</span>
          <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>Total Leads</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 160 }}>
        {data.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />
              <span style={{ color: '#334155', fontWeight: 500 }}>{item.label}</span>
            </div>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================================================
// 6. Enterprise Conversion Funnel Chart
// ==========================================================================
export function ConversionFunnelChart() {
  const steps = [
    { stage: "Website Inquiries", count: 1420, pct: "100%", width: "100%", color: "#93c5fd" },
    { stage: "Marketing Qualified Leads (MQL)", count: 480, pct: "33.8%", width: "80%", color: "#60a5fa" },
    { stage: "Sales Qualified Leads (SQL)", count: 128, pct: "26.6%", width: "62%", color: "#3b82f6" },
    { stage: "Open Pipeline Deals", count: 42, pct: "32.8%", width: "45%", color: "#2563eb" },
    { stage: "Closed Won Accounts", count: 18, pct: "42.8%", width: "30%", color: "#1d4ed8" }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {steps.map((st) => (
        <div key={st.stage} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
            <span>{st.stage}</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>{st.count.toLocaleString()} ({st.pct})</span>
          </div>
          <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: st.width,
                background: st.color,
                borderRadius: 6,
                transition: 'width 0.6s ease'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
