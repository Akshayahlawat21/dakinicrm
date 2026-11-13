import React from 'react';

const CHART_COLORS = ['#6d5ce8', '#16a085', '#e09b35', '#df6685', '#3996c9', '#8b6bb5'];

function renderInline(text, keyPrefix) {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  return String(text).split(tokenPattern).map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith('**') && token.endsWith('**')) return <strong key={key}>{token.slice(2, -2)}</strong>;
    if (token.startsWith('`') && token.endsWith('`')) return <code key={key}>{token.slice(1, -1)}</code>;
    if (token.startsWith('*') && token.endsWith('*')) return <em key={key}>{token.slice(1, -1)}</em>;
    return token;
  });
}

function isTableRow(line) { return line.includes('|') && line.trim().startsWith('|'); }
function isTableDivider(line) { return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim()); }
function splitTableRow(line) { return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()); }

function normalizeChart(raw) {
  const chart = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const type = String(chart.type || chart.chartType || '').toLowerCase();
  const labels = Array.isArray(chart.labels) ? chart.labels : Array.isArray(chart.data) ? chart.data.map((item) => String(item.label ?? item.name ?? item.x ?? '')) : [];
  let series = Array.isArray(chart.series) ? chart.series : Array.isArray(chart.datasets) ? chart.datasets : [];
  if (!series.length && Array.isArray(chart.data) && chart.data.length && typeof chart.data[0] === 'object') {
    const keys = Object.keys(chart.data[0]).filter((key) => !['label', 'name', 'x'].includes(key));
    series = keys.map((key) => ({ name: key, label: key, data: chart.data.map((item) => Number(item[key]) || 0) }));
  }
  series = series.slice(0, 5).map((item) => ({
    name: String(item.name || item.label || 'Value'),
    data: (Array.isArray(item.data) ? item.data : []).slice(0, 20).map((value) => Number(value) || 0),
  }));
  if (!['bar', 'pie', 'line'].includes(type) || !labels.length || !series.length) return null;
  if (type === 'pie' && series.length > 1) series = [series[0]];
  return { type, title: String(chart.title || 'CRM data visualization'), labels: labels.slice(0, 20).map(String), series };
}

function ChartTable({ chart }) {
  return (
    <div className="agent-chart-data-wrap">
      <table className="agent-answer-table agent-chart-data-table">
        <thead><tr><th>Category</th>{chart.series.map((s, i) => <th key={i}>{s.name}</th>)}</tr></thead>
        <tbody>{chart.labels.map((label, row) => <tr key={row}><td>{label}</td>{chart.series.map((s, col) => <td key={col}>{(s.data[row] ?? 0).toLocaleString()}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ChartBlock({ raw }) {
  let chart;
  try { chart = normalizeChart(raw); } catch { return null; }
  if (!chart) return null;
  const maxValue = Math.max(1, ...chart.series.flatMap((s) => s.data.map((v) => Math.max(0, v))));
  const values = chart.series[0].data;
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  const points = values.map((value, index) => `${36 + (index * 328) / Math.max(1, values.length - 1)},${118 - (Math.max(0, value) / maxValue) * 94}`).join(' ');
  let pieOffset = 0;
  const circumference = 2 * Math.PI * 44;

  return (
    <section className="agent-chart-card" aria-label={`${chart.type} chart: ${chart.title}`}>
      <div className="agent-chart-heading"><span className="agent-chart-kicker">DATA VISUALIZATION</span><strong>{chart.title}</strong></div>
      {chart.type === 'bar' && (
        <div className="agent-bar-chart">
          {chart.labels.map((label, index) => (
            <div className="agent-bar-row" key={index}>
              <span className="agent-bar-label" title={label}>{label}</span>
              <div className="agent-bar-track"><div className="agent-bar-fill" style={{ width: `${Math.max(0, values[index] || 0) / maxValue * 100}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} /></div>
              <strong className="agent-bar-value">{(values[index] || 0).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      )}
      {chart.type === 'line' && (
        <div className="agent-line-chart">
          <svg viewBox="0 0 400 145" role="img" aria-label={`${chart.series[0].name} trend`}>
            {[24, 71, 118].map((y) => <line key={y} x1="30" y1={y} x2="370" y2={y} className="agent-chart-gridline" />)}
            <polyline points={points} className="agent-line-path" />
            {values.map((value, index) => <circle key={index} cx={36 + (index * 328) / Math.max(1, values.length - 1)} cy={118 - (Math.max(0, value) / maxValue) * 94} r="4" className="agent-line-point" />)}
          </svg>
          <div className="agent-line-labels">{chart.labels.map((label, index) => <span key={index}>{label}</span>)}</div>
        </div>
      )}
      {chart.type === 'pie' && (
        <div className="agent-pie-layout">
          <svg className="agent-pie-chart" viewBox="0 0 120 120" role="img" aria-label="Distribution chart">
            <circle cx="60" cy="60" r="44" fill="none" stroke="var(--border-default)" strokeWidth="18" />
            {values.map((value, index) => {
              const amount = total ? Math.max(0, value) / total * circumference : 0;
              const circle = <circle key={index} cx="60" cy="60" r="44" fill="none" stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth="18" strokeDasharray={`${amount} ${circumference - amount}`} strokeDashoffset={-pieOffset} transform="rotate(-90 60 60)" />;
              pieOffset += amount;
              return circle;
            })}
            <text x="60" y="57" textAnchor="middle" className="agent-pie-total">{total.toLocaleString()}</text>
            <text x="60" y="70" textAnchor="middle" className="agent-pie-caption">Total</text>
          </svg>
          <div className="agent-pie-legend">{chart.labels.map((label, index) => <div key={index}><span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /><span>{label}</span><strong>{(values[index] || 0).toLocaleString()}</strong></div>)}</div>
        </div>
      )}
      <details className="agent-chart-details"><summary>View data table</summary><ChartTable chart={chart} /></details>
    </section>
  );
}

export default function AgentMessageContent({ text }) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const chartFence = line.trim().match(/^```(?:crm-chart|chart|json)\s*$/i);
    if (chartFence) {
      index += 1;
      const jsonLines = [];
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) jsonLines.push(lines[index++]);
      if (index < lines.length) index += 1;
      const chart = <ChartBlock raw={jsonLines.join('\n')} />;
      if (chart) blocks.push(React.cloneElement(chart, { key: `chart-${blocks.length}` }));
      else if (jsonLines.length) blocks.push(<pre className="agent-code-block" key={`code-${blocks.length}`}>{jsonLines.join('\n')}</pre>);
      continue;
    }

    if (isTableRow(line) && lines[index + 1] && isTableDivider(lines[index + 1])) {
      const headers = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && isTableRow(lines[index])) rows.push(splitTableRow(lines[index++]));
      blocks.push(<div className="agent-table-wrap" key={`table-${blocks.length}`}><table className="agent-answer-table"><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInline(cell, `th-${cellIndex}`)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] || '—', `td-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const HeadingTag = heading[1].length === 1 ? 'h3' : heading[1].length === 2 ? 'h4' : 'h5';
      blocks.push(<HeadingTag key={`heading-${blocks.length}`}>{renderInline(heading[2], `heading-${blocks.length}`)}</HeadingTag>);
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const listType = unordered ? 'ul' : 'ol';
      const items = [];
      while (index < lines.length) {
        const itemMatch = lines[index].match(listType === 'ul' ? /^\s*[-*•]\s+(.+)$/ : /^\s*\d+[.)]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1]); index += 1;
      }
      const ListTag = listType;
      blocks.push(<ListTag key={`list-${blocks.length}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `list-${itemIndex}`)}</li>)}</ListTag>);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      if (/^#{1,3}\s+/.test(lines[index]) || /^\s*[-*•]\s+/.test(lines[index]) || /^\s*\d+[.)]\s+/.test(lines[index])) break;
      if ((isTableRow(lines[index]) && lines[index + 1] && isTableDivider(lines[index + 1])) || /^```(?:crm-chart|chart|json)\s*$/i.test(lines[index].trim())) break;
      paragraph.push(lines[index].trim()); index += 1;
    }
    blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInline(paragraph.join(' '), `paragraph-${blocks.length}`)}</p>);
  }
  return <div className="agent-rich-text">{blocks}</div>;
}
