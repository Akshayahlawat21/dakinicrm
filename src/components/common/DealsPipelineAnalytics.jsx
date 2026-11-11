import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '../../context/CRMContext';
import { matchesDealFilters, resolveDealAttribution } from '../../utils/dealAnalyticsFilters';
import { RotateCcw, ChevronLeft } from 'lucide-react';

const STAGES = ['Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const COLORS = { Qualified: '#2563eb', Proposal: '#7c3aed', Negotiation: '#f59e0b', Won: '#10b981', Lost: '#ef4444' };
const stageOf = (value) => {
  const s = String(value || '').toLowerCase().trim();
  if (['discovery','qualification','qualified'].includes(s)) return 'Qualified';
  if (s === 'proposal') return 'Proposal';
  if (s === 'negotiation') return 'Negotiation';
  if (s.includes('won')) return 'Won';
  if (s.includes('lost')) return 'Lost';
  return 'Qualified';
};
const amountOf = (d) => Number(d.value ?? d.amount ?? d.deal_value ?? 0) || 0;
const dateOf = (d) => d.created_at || d.createdAt || d.created_date || d.close_date || d.updated_at || '';
const textOf = (...values) => values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? '';

function Donut({ rows, total }) {
  let cursor = 0;
  const segments = rows.map(r => {
    const start = cursor; cursor += total ? r.count / total * 100 : 0;
    return `${r.color} ${start}% ${cursor}%`;
  });
  return <div style={{display:'flex',alignItems:'center',gap:22,flexWrap:'wrap'}}>
    <div style={{width:174,height:174,borderRadius:'50%',background:total ? `conic-gradient(${segments.join(',')})` : '#e2e8f0',position:'relative',flexShrink:0}}>
      <div style={{position:'absolute',inset:27,borderRadius:'50%',background:'#fff',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <strong style={{fontSize:28,color:'#0f172a'}}>{total.toLocaleString()}</strong><span style={{fontSize:12,color:'#64748b'}}>Total deals</span>
      </div>
    </div>
    <div style={{display:'grid',gap:9,flex:'1 1 180px'}}>{rows.map(r=><div key={r.stage} style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:13}}><span style={{display:'flex',alignItems:'center',gap:8}}><i style={{width:10,height:10,borderRadius:3,background:r.color}}/>{r.stage}</span><b>{r.count} · {total ? Math.round(r.count/total*100) : 0}%</b></div>)}</div>
  </div>;
}
function Pie({ rows, total }) {
  let cursor = 0;
  const stops = rows.map(r=>{const a=cursor;cursor += total ? r.count/total*100 : 0;return `${r.color} ${a}% ${cursor}%`;});
  return <div style={{display:'flex',alignItems:'center',gap:22,flexWrap:'wrap'}}>
    <div style={{width:174,height:174,borderRadius:'50%',background:total?`conic-gradient(${stops.join(',')})`:'#e2e8f0',flexShrink:0}}/>
    <div style={{display:'grid',gap:9,flex:'1 1 180px'}}>{rows.map(r=><div key={r.stage} style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:13}}><span style={{display:'flex',alignItems:'center',gap:8}}><i style={{width:10,height:10,borderRadius:3,background:r.color}}/>{r.stage}</span><b>{r.count}</b></div>)}</div>
  </div>;
}
function Funnel({ rows, total, onSelect }) {
  const max = Math.max(1, ...rows.map(r=>r.count));
  return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(155px, .8fr)',gap:18,alignItems:'center'}}>
    <div style={{display:'grid',justifyItems:'center',gap:5,minWidth:0}}>
      {rows.map((r,i)=>{
        const width = Math.max(42, 100 - i*13);
        return <button key={r.stage} onClick={()=>onSelect(r.stage)} title={`View ${r.stage} deals`} style={{width:`${width}%`,minWidth:130,maxWidth:520,minHeight:47,border:0,clipPath:'polygon(0 0,100% 0,92% 100%,8% 100%)',background:r.color,color:'#fff',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'8px 24px',textShadow:'0 1px 2px rgba(0,0,0,.22)'}}>
          <span style={{fontSize:13}}>{r.count.toLocaleString()}</span><span style={{fontSize:12,opacity:.98}}>{Math.round(total ? r.count/total*100 : 0)}%</span>
        </button>;
      })}
    </div>
    <div style={{display:'grid',gap:8}}>
      {rows.map(r=><button key={r.stage} onClick={()=>onSelect(r.stage)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,border:'1px solid #e2e8f0',background:'#fff',borderRadius:9,padding:'10px 11px',cursor:'pointer',textAlign:'left'}}>
        <span style={{display:'flex',alignItems:'center',gap:8,fontSize:12,fontWeight:700,color:'#334155'}}><i style={{width:9,height:9,borderRadius:3,background:r.color}}/>{r.stage}</span><b style={{fontSize:13,color:'#0f172a'}}>{r.count.toLocaleString()}</b>
      </button>)}
    </div>
  </div>;
}
function Bars({ rows, total, onSelect }) {
  return <div style={{display:'grid',gap:13}}>{rows.map(r=><button key={r.stage} onClick={()=>onSelect(r.stage)} style={{border:0,background:'transparent',padding:0,cursor:'pointer',textAlign:'left'}}>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700,color:'#334155',marginBottom:5}}><span>{r.stage}</span><span>{r.count} deals · {Math.round(total ? r.count/total*100 : 0)}%</span></div>
    <div style={{height:15,borderRadius:20,background:'#eef2f7',overflow:'hidden'}}><div style={{height:'100%',width:`${total ? (r.count/total)*100 : 0}%`,background:r.color,borderRadius:20,transition:'width .3s'}}/></div>
  </button>)}</div>;
}

export default function DealsPipelineAnalytics({ deals = [], campaigns = [], products = [], leads = [], onFilteredDealsChange }) {
  const { setAssistantContext } = useCRM();
  const [campaignId,setCampaignId] = useState('all');
  const [productId,setProductId] = useState('all');
  const [dateRange,setDateRange] = useState('all');
  const [chart,setChart] = useState('Bar');
  const [selectedStage,setSelectedStage] = useState(() => {
    try { const v=sessionStorage.getItem('dakini_pipeline_stage'); sessionStorage.removeItem('dakini_pipeline_stage'); return STAGES.includes(v)?v:null; } catch { return null; }
  });
  useEffect(() => { setAssistantContext({ campaign_id: campaignId, product_id: productId, date_range: dateRange, stage: selectedStage || 'all', source_page: 'deals_pipeline' }); }, [campaignId, productId, dateRange, selectedStage, setAssistantContext]);

  const filtered = useMemo(() => {
    const leadById = new Map(leads.map((lead) => [String(lead.id), lead]));
    return deals.filter((deal) => matchesDealFilters(deal, {
      campaignId, productId, dateRange, leadById, leads, campaigns, products
    }));
  }, [deals, leads, campaignId, productId, dateRange, campaigns, products]);
  useEffect(() => {
    onFilteredDealsChange?.(filtered);
  }, [filtered, onFilteredDealsChange]);

  const rows = useMemo(() => {
    const acc = Object.fromEntries(STAGES.map(stage => [stage, { stage, count: 0, value: 0, color: COLORS[stage] }]));
    for (const deal of filtered) {
      const stage = stageOf(deal.stage);
      acc[stage].count += 1;
      acc[stage].value += amountOf(deal);
    }
    return STAGES.map(stage => acc[stage]);
  }, [filtered]);
  const total = filtered.length;
  const totalValue = filtered.reduce((s,d)=>s+amountOf(d),0);
  const currentRows = rows.filter(r=>r.stage===selectedStage);
  const stageDeals = selectedStage ? filtered.filter(d=>stageOf(d.stage)===selectedStage) : [];
  const fmt = n => Number(n||0).toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});

  const selectStage = stage => { setSelectedStage(stage); };
  return <section className="crm-card" style={{margin:'0 0 1.35rem',padding:'1.25rem',border:'1px solid #dbe4f0',boxShadow:'0 8px 24px rgba(15,23,42,.045)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',marginBottom:16}}>
      <div><h2 style={{fontSize:18,fontWeight:800,color:'#0f172a',margin:0}}>Pipeline analytics</h2><p style={{fontSize:12,color:'#64748b',margin:'5px 0 0'}}>Explore stage distribution, deal value and filtered opportunities</p></div>
      <button className="btn btn-outline btn-sm" onClick={()=>{setCampaignId('all');setProductId('all');setDateRange('all');setSelectedStage(null);}}><RotateCcw size={13}/> Reset filters</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginBottom:16}}>
      <label style={{fontSize:11,fontWeight:700,color:'#64748b'}}>CAMPAIGN<select value={campaignId} onChange={e=>setCampaignId(e.target.value)} style={selectStyle}><option value="all">All campaigns</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label style={{fontSize:11,fontWeight:700,color:'#64748b'}}>PRODUCT<select value={productId} onChange={e=>setProductId(e.target.value)} style={selectStyle}><option value="all">All products</option>{products.map(p=><option key={p.id} value={p.id}>{p.name || p.product_name}</option>)}</select></label>
      <label style={{fontSize:11,fontWeight:700,color:'#64748b'}}>DATE RANGE<select value={dateRange} onChange={e=>setDateRange(e.target.value)} style={selectStyle}><option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></label>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,marginBottom:18}}>
      {[['Total deals',total],['Open deals',rows.filter(r=>!['Won','Lost'].includes(r.stage)).reduce((s,r)=>s+r.count,0)],['Won deals',rows.find(r=>r.stage==='Won')?.count||0],['Total deal value',fmt(totalValue)]].map(([label,value])=><div key={label} style={{background:'#f8fafc',border:'1px solid #e8eef6',borderRadius:10,padding:'11px 13px'}}><div style={{fontSize:11,color:'#64748b',fontWeight:600}}>{label}</div><strong style={{display:'block',fontSize:20,color:'#0f172a',marginTop:4}}>{value}</strong></div>)}
    </div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}>
      <div style={{fontSize:14,fontWeight:800,color:'#0f172a'}}>Deals by pipeline stage</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{['Funnel','Pie','Donut','Bar'].map(v=><button key={v} onClick={()=>setChart(v)} style={{border:chart===v?'1px solid #2563eb':'1px solid #dbe3ee',background:chart===v?'#eff6ff':'#fff',color:chart===v?'#1d4ed8':'#475569',borderRadius:8,padding:'7px 11px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{v}</button>)}</div>
    </div>
    {total===0 ? <div style={{padding:28,textAlign:'center',background:'#f8fafc',borderRadius:10,color:'#64748b',fontSize:13}}>No deals match the selected filters. Try another campaign, product or date range.</div> :
      chart==='Funnel' ? <Funnel rows={rows} total={total} onSelect={selectStage}/> : chart==='Pie' ? <Pie rows={rows} total={total}/> : chart==='Donut' ? <Donut rows={rows} total={total}/> : <Bars rows={rows} total={total} onSelect={selectStage}/>}
    <div style={{display:'flex',gap:7,flexWrap:'wrap',marginTop:18}}>
      {rows.map(r=><button key={r.stage} onClick={()=>selectStage(r.stage)} style={{border:selectedStage===r.stage?`2px solid ${r.color}`:'1px solid #e2e8f0',background:selectedStage===r.stage?`${r.color}12`:'#fff',borderRadius:9,padding:'8px 11px',cursor:'pointer',display:'flex',alignItems:'center',gap:7}}><i style={{width:8,height:8,borderRadius:4,background:r.color}}/><span style={{fontSize:12,fontWeight:700,color:'#334155'}}>{r.stage}</span><b style={{fontSize:12,color:'#0f172a'}}>{r.count}</b></button>)}
    </div>
    {selectedStage && <div style={{marginTop:18,border:'1px solid #dbeafe',borderRadius:12,overflow:'hidden'}}>
      <div style={{background:'#eff6ff',padding:'12px 15px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div><div style={{fontSize:11,color:'#1d4ed8',fontWeight:800,textTransform:'uppercase'}}>Stage details</div><strong style={{fontSize:17,color:'#0f172a'}}>{selectedStage} · {currentRows[0]?.count||0} deals</strong></div>
        <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedStage(null)}><ChevronLeft size={14}/> Back to all stages</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,padding:13}}>
        <div><small style={{color:'#64748b'}}>Deals in stage</small><div style={{fontSize:22,fontWeight:800}}>{currentRows[0]?.count||0}</div></div>
        <div><small style={{color:'#64748b'}}>Stage deal value</small><div style={{fontSize:22,fontWeight:800}}>{fmt(currentRows[0]?.value||0)}</div></div>
        <div><small style={{color:'#64748b'}}>Share of filtered deals</small><div style={{fontSize:22,fontWeight:800}}>{total?((currentRows[0]?.count||0)/total*100).toFixed(1):'0.0'}%</div></div>
      </div>
      <div style={{overflowX:'auto',padding:'0 13px 13px'}}><table className="crm-table" style={{minWidth:620,width:'100%'}}><thead><tr><th>Deal</th><th>Company</th><th>Owner</th><th>Value</th><th>Campaign</th><th>Product</th></tr></thead><tbody>
        {stageDeals.length===0?<tr><td colSpan="6" style={{textAlign:'center',padding:18,color:'#64748b'}}>No deals in this stage.</td></tr>:stageDeals.map(d=>{
          const attribution = resolveDealAttribution(d, {
            leadById: new Map(leads.map((lead) => [String(lead.id), lead])),
            leads, campaigns, products
          });
          return <tr key={d.id}>
            <td style={{fontWeight:700}}>{d.name||'Untitled deal'}</td>
            <td>{d.company||'—'}</td>
            <td>{d.owner||d.owner_name||'—'}</td>
            <td>{fmt(amountOf(d))}</td>
            <td>{attribution.campaignName || '—'}</td>
            <td>{attribution.productName || '—'}</td>
          </tr>;
        })}
      </tbody></table></div>
    </div>}
  </section>;
}
const selectStyle = {display:'block',width:'100%',marginTop:6,padding:'10px 11px',border:'1px solid #dbe3ee',borderRadius:8,background:'#fff',color:'#0f172a',fontSize:13,outline:'none'};
