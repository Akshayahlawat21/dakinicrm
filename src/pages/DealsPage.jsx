import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCRM } from '../context/CRMContext';
import LoadingSymbol from '../components/common/LoadingSymbol';
import DealsPipelineAnalytics from '../components/common/DealsPipelineAnalytics';
import { matchesDealFilters } from '../utils/dealAnalyticsFilters';
import {
  Handshake,
  Plus,
  DollarSign,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  CheckCircle,
  XCircle,
  Filter,
  ArrowRight,
  Trash2,
  Pencil,
  X,
  ChevronDown,
  Check
} from 'lucide-react';

const CANONICAL_STAGES = ['Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

const normalizeStage = (stg) => {
  if (!stg) return 'Qualified';
  const s = String(stg).toLowerCase().trim();
  if (s === 'discovery' || s === 'qualification' || s === 'qualified') return 'Qualified';
  if (s === 'proposal') return 'Proposal';
  if (s === 'negotiation') return 'Negotiation';
  if (s === 'won' || s.includes('won')) return 'Won';
  if (s === 'lost' || s.includes('lost')) return 'Lost';
  return stg;
};

const resolveColumnBaseStage = (col) => {
  if (!col) return 'Qualified';
  if (col.is_won) return 'Won';
  if (col.is_lost) return 'Lost';
  return normalizeStage(col.parent_base_stage || col.name);
};

export default function DealsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    deals,
    campaigns,
    products,
    leads,
    pipelines,
    pipelineStages,
    createCustomStage,
    updateCustomStage,
    reorderCustomStages,
    deleteCustomStage,
    updateDealStage,
    deleteDeal,
    setIsQuickCreateOpen,
    setQuickCreateType,
    accounts,
    navigateTo,
    isLoadingData,
    currentUser,
  } = useCRM();

  const userRole = (currentUser?.role || currentUser?.roles?.[0] || 'salesperson').toLowerCase();
  const isOwner = userRole.includes('owner') || userRole.includes('admin') || userRole.includes('director');
  const isManager = userRole.includes('manager');
  const canDeleteDeals = isOwner || isManager;

  const [selectedDeal, setSelectedDeal] = useState(null);
  const [permissionError, setPermissionError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [analyticsFilteredDeals, setAnalyticsFilteredDeals] = useState(null);
  const handleFilteredDealsChange = useCallback((rows) => setAnalyticsFilteredDeals(rows), []);
  const visibleDeals = analyticsFilteredDeals || deals;

  // Custom Pipeline Column Modals & Drag State
  const [stageModalMode, setStageModalMode] = useState(null); // 'add' | 'edit' | null
  const [stageModalParent, setStageModalParent] = useState(null);
  const [editingStage, setEditingStage] = useState(null);
  const [stageNameInput, setStageNameInput] = useState('');
  const [stageColorInput, setStageColorInput] = useState('#06b6d4');
  const [stageProbInput, setStageProbInput] = useState(50);
  const [stageScopeInput, setStageScopeInput] = useState('personal');
  const [stageError, setStageError] = useState('');
  const [isSavingStage, setIsSavingStage] = useState(false);

  const [deleteStageTarget, setDeleteStageTarget] = useState(null);
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [isDeletingStage, setIsDeletingStage] = useState(false);

  const [draggedDealId, setDraggedDealId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);
  const [dragOverSubStageId, setDragOverSubStageId] = useState(null);
  const [collapsedSubStages, setCollapsedSubStages] = useState({});
  const [columnSubStageFilter, setColumnSubStageFilter] = useState({});
  const [openColumnMenuColId, setOpenColumnMenuColId] = useState(null);
  const [openCardMenuDealId, setOpenCardMenuDealId] = useState(null);
  const kanbanBoardRef = useRef(null);
  const [kanbanScroll, setKanbanScroll] = useState({ scrollLeft: 0, maxScroll: 0 });

  const toggleSubStageCollapsed = (subId) => {
    setCollapsedSubStages((prev) => ({
      ...prev,
      [subId]: !prev[subId],
    }));
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenColumnMenuColId(null);
      setOpenCardMenuDealId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const syncKanbanScroll = useCallback(() => {
    const el = kanbanBoardRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, Math.round(el.scrollWidth - el.clientWidth));
    const scrollLeft = Math.max(0, Math.min(maxScroll, Math.round(el.scrollLeft)));
    setKanbanScroll((prev) =>
      prev.scrollLeft === scrollLeft && prev.maxScroll === maxScroll
        ? prev
        : { scrollLeft, maxScroll }
    );
  }, []);

  const scrollKanbanBy = useCallback((delta) => {
    const el = kanbanBoardRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const activePipelineObj = pipelines.find((p) => p.is_default) || pipelines[0] || null;
  const activePipelineId = activePipelineObj?.id || null;
  const activeColumns = useMemo(
    () =>
      pipelineStages && pipelineStages.length > 0
        ? pipelineStages
        : [
            { id: 'Qualified', name: 'Qualified', scope: 'org', is_system: true, is_won: false, is_lost: false, win_probability: 50, color: '#3b82f6' },
            { id: 'Proposal', name: 'Proposal', scope: 'org', is_system: true, is_won: false, is_lost: false, win_probability: 75, color: '#8b5cf6' },
            { id: 'Negotiation', name: 'Negotiation', scope: 'org', is_system: true, is_won: false, is_lost: false, win_probability: 85, color: '#f59e0b' },
            { id: 'Won', name: 'Won', scope: 'org', is_system: true, is_won: true, is_lost: false, win_probability: 100, color: '#10b981' },
            { id: 'Lost', name: 'Lost', scope: 'org', is_system: true, is_won: false, is_lost: true, win_probability: 0, color: '#ef4444' },
          ],
    [pipelineStages]
  );

  const selectedStage = useMemo(() => {
    const raw = searchParams.get('stage');
    if (!raw) return null;
    const normalized = normalizeStage(raw);
    if (CANONICAL_STAGES.includes(normalized)) return normalized;
    const matchedCol = activeColumns.find(
      (col) => col.name.toLowerCase() === raw.trim().toLowerCase()
    );
    if (matchedCol) {
      const base = resolveColumnBaseStage(matchedCol);
      return CANONICAL_STAGES.includes(base) ? base : null;
    }
    return null;
  }, [searchParams, activeColumns]);

  const handleSelectStage = useCallback(
    (stage) => {
      const nextParams = new URLSearchParams(searchParams);
      if (!stage) {
        nextParams.delete('stage');
        nextParams.delete('from');
      } else {
        const normalized = normalizeStage(stage);
        if (CANONICAL_STAGES.includes(normalized)) {
          nextParams.set('stage', normalized);
        } else {
          nextParams.delete('stage');
          nextParams.delete('from');
        }
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    try {
      const legacyStage = sessionStorage.getItem('dakini_pipeline_stage');
      if (legacyStage) {
        sessionStorage.removeItem('dakini_pipeline_stage');
        if (!searchParams.get('stage')) {
          const normalized = normalizeStage(legacyStage);
          if (CANONICAL_STAGES.includes(normalized)) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('stage', normalized);
            setSearchParams(nextParams, { replace: true });
          }
        }
      }
    } catch {
      /* storage may be unavailable */
    }
  }, [searchParams, setSearchParams]);

  // Canonical parent stages (always rendered as the core Kanban columns)
  const rootColumns = useMemo(() => {
    const roots = activeColumns.filter((col) => {
      if (col.parent_stage_id) return false;
      if (col.parent_base_stage && col.parent_base_stage.toLowerCase() !== col.name.toLowerCase()) {
        return false;
      }
      return true;
    });

    const orderedRoots = [];
    for (const stg of CANONICAL_STAGES) {
      const match = roots.find((r) => normalizeStage(r.parent_base_stage || r.name) === stg);
      if (match) {
        orderedRoots.push(match);
      } else {
        const fallbackCol = activeColumns.find((c) => normalizeStage(c.name) === stg) || {
          id: stg,
          name: stg,
          scope: 'org',
          is_system: true,
          is_won: stg === 'Won',
          is_lost: stg === 'Lost',
          win_probability: stg === 'Won' ? 100 : stg === 'Lost' ? 0 : 50,
          color: stg === 'Won' ? '#10b981' : stg === 'Lost' ? '#ef4444' : stg === 'Proposal' ? '#8b5cf6' : stg === 'Negotiation' ? '#f59e0b' : '#3b82f6',
        };
        orderedRoots.push(fallbackCol);
      }
    }
    roots.forEach((r) => {
      if (!orderedRoots.some((or) => or.id === r.id)) {
        orderedRoots.push(r);
      }
    });

    return orderedRoots;
  }, [activeColumns]);

  const getSubStagesForColumn = useCallback(
    (parentCol) => {
      if (!parentCol) return [];
      const parentBase = normalizeStage(parentCol.parent_base_stage || parentCol.name).toLowerCase();
      return activeColumns.filter((col) => {
        if (col.id === parentCol.id) return false;
        if (col.parent_stage_id === parentCol.id) return true;
        const colBase = normalizeStage(col.parent_base_stage || '').toLowerCase();
        return colBase === parentBase && col.id !== parentCol.id;
      });
    },
    [activeColumns]
  );

  const dealBelongsToParent = useCallback(
    (deal, parentCol) => {
      if (!deal || !parentCol) return false;
      const dealParentStage = normalizeStage(deal.stage).toLowerCase();
      const parentColBase = resolveColumnBaseStage(parentCol).toLowerCase();
      if (dealParentStage === parentColBase) return true;
      if (deal.display_stage_id && activeColumns.some((c) => c.id === deal.display_stage_id)) {
        const stageObj = activeColumns.find((c) => c.id === deal.display_stage_id);
        if (stageObj) {
          const stageObjBase = resolveColumnBaseStage(stageObj).toLowerCase();
          return stageObjBase === parentColBase;
        }
      }
      return false;
    },
    [activeColumns]
  );

  const displayedColumns = useMemo(() => {
    if (!selectedStage) return rootColumns;
    const target = selectedStage.toLowerCase();
    const matching = rootColumns.filter((col) => {
      const colBase = resolveColumnBaseStage(col).toLowerCase();
      return col.name.toLowerCase() === target || colBase === target;
    });
    return matching.length > 0 ? matching : rootColumns;
  }, [rootColumns, selectedStage]);

  useEffect(() => {
    const el = kanbanBoardRef.current;
    syncKanbanScroll();
    const frameId = window.requestAnimationFrame(syncKanbanScroll);
    window.addEventListener('resize', syncKanbanScroll);

    let observer;
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncKanbanScroll);
      observer.observe(el);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncKanbanScroll);
      observer?.disconnect();
    };
  }, [displayedColumns.length, isLoadingData, syncKanbanScroll]);

  const resolveDealColumnId = (deal) => {
    if (!deal) return activeColumns[0]?.id;
    if (deal.display_stage_id && activeColumns.some((c) => c.id === deal.display_stage_id)) {
      return deal.display_stage_id;
    }
    if (deal.display_stage_name) {
      const byDispName = activeColumns.find(
        (c) => c.name.toLowerCase() === String(deal.display_stage_name).toLowerCase()
      );
      if (byDispName) return byDispName.id;
    }
    const norm = normalizeStage(deal.stage).toLowerCase();
    const byCore =
      activeColumns.find((c) => c.name.toLowerCase() === norm && c.scope === 'org') ||
      activeColumns.find((c) => c.name.toLowerCase() === norm);
    return byCore ? byCore.id : activeColumns[0]?.id;
  };

  const handleSelectDealStage = (deal, col) => {
    if (!deal || !col) return;
    updateDealStage(deal.id, col.name, col.id);
    if (selectedDeal?.id === deal.id) {
      setSelectedDeal({
        ...selectedDeal,
        stage: col.scope === 'personal' ? col.parent_base_stage || 'Qualified' : col.name,
        display_stage_id: col.id,
        display_stage_name: col.name,
        display_probability: col.win_probability,
      });
    }
  };

  const openAddColumnModal = (parentCol) => {
    setStageModalMode('add');
    setStageModalParent(parentCol);
    setEditingStage(null);
    setStageNameInput('');
    const defaultColor = parentCol?.is_won
      ? '#10b981'
      : parentCol?.is_lost
        ? '#ef4444'
        : '#06b6d4';
    setStageColorInput(defaultColor);
    setStageProbInput(parentCol?.is_won ? 100 : parentCol?.is_lost ? 0 : (parentCol?.win_probability ?? 50));
    setStageScopeInput('personal');
    setStageError('');
  };

  const openEditColumnModal = (col) => {
    setStageModalMode('edit');
    setStageModalParent(null);
    setEditingStage(col);
    setStageNameInput(col.name || '');
    setStageColorInput(col.color || '#06b6d4');
    setStageProbInput(col.win_probability ?? 50);
    setStageScopeInput(col.scope || 'personal');
    setStageError('');
  };

  const handleSaveStageModal = async (e) => {
    e.preventDefault();
    if (!activePipelineId || isSavingStage) return;
    const trimmed = stageNameInput.trim();
    if (!trimmed) {
      setStageError('Please enter a column name.');
      return;
    }

    setIsSavingStage(true);
    setStageError('');

    if (stageModalMode === 'add') {
      const resolvedProb = stageModalParent?.is_won
        ? 100
        : stageModalParent?.is_lost
          ? 0
          : (stageProbInput === '' ? 50 : Number(stageProbInput));
      const res = await createCustomStage(activePipelineId, {
        name: trimmed,
        parent_stage_id: stageModalParent?.id || null,
        parent_base_stage: stageModalParent?.parent_base_stage || stageModalParent?.name || 'Qualified',
        color: stageColorInput,
        win_probability: resolvedProb,
        scope: isOwner ? stageScopeInput : 'personal',
      });
      setIsSavingStage(false);
      if (res?.success) {
        setStageModalMode(null);
        if (stageModalParent?.id) {
          const newId = res.data?.id || res.data?.stage?.id;
          if (newId) {
            setColumnSubStageFilter((prev) => ({ ...prev, [stageModalParent.id]: newId }));
          }
        }
      } else {
        setStageError(res?.error?.message || 'Failed to add custom column.');
      }
    } else if (stageModalMode === 'edit' && editingStage) {
      const res = await updateCustomStage(activePipelineId, editingStage.id, {
        name: trimmed,
        color: stageColorInput,
        win_probability: Number(stageProbInput) || 50,
      });
      setIsSavingStage(false);
      if (res?.success) {
        setStageModalMode(null);
      } else {
        setStageError(res?.error?.message || 'Failed to update column.');
      }
    } else {
      setIsSavingStage(false);
    }
  };

  const handleMoveStagePosition = async (col, direction) => {
    if (!activePipelineId || !col) return;
    const ids = activeColumns.map((c) => c.id);
    const idx = ids.indexOf(col.id);
    const targetIdx = idx + direction;
    if (idx < 0 || targetIdx < 0 || targetIdx >= ids.length) return;
    if (activeColumns[targetIdx]?.scope === 'org' && !isOwner) return;

    const swapped = [...ids];
    const tmp = swapped[idx];
    swapped[idx] = swapped[targetIdx];
    swapped[targetIdx] = tmp;
    await reorderCustomStages(activePipelineId, swapped);
  };

  const openDeleteColumnModal = (col) => {
    const candidates = activeColumns.filter((c) => c.id !== col.id);
    const defaultDest =
      (col.parent_stage_id && candidates.find((c) => c.id === col.parent_stage_id)) ||
      (col.parent_base_stage &&
        candidates.find((c) => c.scope === 'org' && c.name.toLowerCase() === col.parent_base_stage.toLowerCase())) ||
      candidates.find((c) => c.scope === 'org' && c.name.toLowerCase() === 'qualified') ||
      candidates[0];
    setDeleteStageTarget(col);
    setReassignTargetId(defaultDest ? defaultDest.id : '');
    setStageError('');
  };

  const handleConfirmDeleteColumn = async () => {
    if (!activePipelineId || !deleteStageTarget || isDeletingStage) return;
    setIsDeletingStage(true);
    setStageError('');
    const targetId = deleteStageTarget.id;
    const res = await deleteCustomStage(activePipelineId, targetId, reassignTargetId || null);
    setIsDeletingStage(false);
    if (res?.success) {
      setDeleteStageTarget(null);
      setColumnSubStageFilter((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k] === targetId) {
            next[k] = 'all';
          }
        }
        return next;
      });
    } else {
      setStageError(res?.error?.message || 'Unable to delete column.');
    }
  };

  const handleDeleteDeal = async (deal) => {
    if (!deal || isDeleting) return;

    if (!canDeleteDeals) {
      setPermissionError("You don't have permission to delete deals. Only Owners and Managers are authorized to delete deals from the active pipeline.");
      return;
    }

    if (window.confirm(`Delete opportunity "${deal.name}"?`)) {
      setIsDeleting(true);
      setPermissionError(null);
      const res = await deleteDeal(deal.id);
      setIsDeleting(false);

      if (res && res.success === false) {
        setPermissionError(res.error?.message || "You don't have permission to delete this deal.");
      } else {
        setSelectedDeal(null);
      }
    }
  };

  const activePipeline = deals
    .filter((d) => {
      const col = activeColumns.find((c) => c.id === resolveDealColumnId(d));
      return col ? !col.is_won && !col.is_lost : !['Lost', 'Won'].includes(normalizeStage(d.stage));
    })
    .reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);

  const wonTotal = deals
    .filter((d) => {
      const col = activeColumns.find((c) => c.id === resolveDealColumnId(d));
      return col ? Boolean(col.is_won) : normalizeStage(d.stage) === 'Won';
    })
    .reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);

  const renderDealCard = (deal, col, subStages = []) => {
    const isStuck = deal.daysInStage >= 5 && !col.is_won && !col.is_lost;
    const isCardSelected = selectedDeal?.id === deal.id;
    const dealSubStage = subStages.find(
      (s) => s.id === deal.display_stage_id || (deal.display_stage_name && s.name.toLowerCase() === deal.display_stage_name.toLowerCase())
    );

    return (
      <div
        key={deal.id}
        draggable
        onDragStart={() => setDraggedDealId(deal.id)}
        onDragEnd={() => {
          setDraggedDealId(null);
          setDragOverColId(null);
          setDragOverSubStageId(null);
        }}
        className={`deal-card ${isStuck ? 'stuck-amber' : ''}`}
        style={{
          border: isCardSelected ? '2px solid var(--primary)' : undefined,
          boxShadow: isCardSelected ? '0 4px 14px var(--primary-glow)' : undefined,
        }}
        onClick={() => setSelectedDeal(deal)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
            {deal.company}
          </span>
          {isStuck && (
            <span className="badge badge-amber" title="Deal stuck for >5 days">
              <AlertTriangle size={11} />
              {deal.daysInStage}d stuck
            </span>
          )}
        </div>

        {/* In-Card Sub-stage Selector Badge & Menu */}
        {subStages.length > 0 && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.45rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: '6px',
                background: dealSubStage ? 'var(--primary-light)' : 'var(--surface-hover)',
                color: dealSubStage ? 'var(--primary)' : 'var(--text-muted)',
                border: `1px solid ${dealSubStage ? 'var(--primary-subtle)' : 'var(--border-default)'}`,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setOpenCardMenuDealId(openCardMenuDealId === deal.id ? null : deal.id);
                setOpenColumnMenuColId(null);
              }}
              title="Change sub-stage or advance deal"
            >
              <span>{dealSubStage ? dealSubStage.name : `General ${col.name}`}</span>
              <ChevronDown size={11} />
            </button>

            {openCardMenuDealId === deal.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '100%',
                  marginTop: 4,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-card)',
                  padding: '0.35rem',
                  zIndex: 100,
                  minWidth: 200,
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.25rem 0.5rem' }}>
                  Sub-stages ({col.name})
                </div>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.35rem 0.5rem',
                    borderRadius: 6,
                    background: !dealSubStage ? 'var(--primary-light)' : 'transparent',
                    color: !dealSubStage ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: !dealSubStage ? 700 : 500,
                    border: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectDealStage(deal, col);
                    setOpenCardMenuDealId(null);
                  }}
                >
                  <span>General {col.name}</span>
                  {!dealSubStage && <Check size={12} color="var(--primary)" />}
                </button>

                {subStages.map((sub) => {
                  const isCurrent = dealSubStage?.id === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.35rem 0.5rem',
                        borderRadius: 6,
                        background: isCurrent ? 'var(--primary-light)' : 'transparent',
                        color: isCurrent ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: isCurrent ? 700 : 500,
                        border: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectDealStage(deal, sub);
                        setOpenCardMenuDealId(null);
                      }}
                    >
                      <span>{sub.name}</span>
                      {isCurrent && <Check size={12} color="var(--primary)" />}
                    </button>
                  );
                })}

                <div style={{ borderTop: '1px solid var(--border-default)', margin: '0.35rem 0', paddingTop: '0.25rem' }}>
                  <div style={{ fontSize: '0.625rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.25rem 0.5rem' }}>
                    Move to Parent Stage
                  </div>
                  {rootColumns
                    .filter((rc) => rc.id !== col.id)
                    .map((targetParent) => (
                      <button
                        key={targetParent.id}
                        type="button"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.35rem 0.5rem',
                          borderRadius: 6,
                          background: 'transparent',
                          color: targetParent.is_won ? 'var(--success, #10b981)' : targetParent.is_lost ? 'var(--danger, #ef4444)' : 'var(--text-main)',
                          fontWeight: 600,
                          border: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectDealStage(deal, targetParent);
                          setOpenCardMenuDealId(null);
                        }}
                      >
                        <ArrowRight size={12} />
                        <span>{targetParent.is_won ? 'Mark Won' : targetParent.is_lost ? 'Mark Lost' : `Move to ${targetParent.name}`}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3, marginBottom: '0.5rem' }}>
          {deal.name}
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
            ${deal.value.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {(deal.display_probability ?? deal.probability) != null
              ? `${deal.display_probability ?? deal.probability}% prob.`
              : normalizeStage(deal.stage) === 'Won'
              ? '100% prob.'
              : normalizeStage(deal.stage) === 'Lost'
              ? '0% prob.'
              : '50% prob.'}
          </span>
        </div>

        {/* Card Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-default)',
          paddingTop: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(deal.owner || 'SR').split(' ').map(n => n[0]).join('')}
            </div>
            <span>{deal.owner}</span>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '0.15rem 0.35rem' }}
            onClick={(e) => {
              e.stopPropagation();
              const curColId = resolveDealColumnId(deal);
              const curIdx = activeColumns.findIndex((c) => c.id === curColId);
              const nextCol = activeColumns[(curIdx + 1) % activeColumns.length];
              if (nextCol) {
                updateDealStage(deal.id, nextCol.name, nextCol.id);
              }
            }}
            title="Advance to next stage"
          >
            <ArrowRight size={13} color="var(--primary)" />
          </button>
        </div>
      </div>
    );
  };

  const totalPipeline = activePipeline + wonTotal;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Deals Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Deals & Active Pipeline
            </h1>
            <span className="badge badge-blue" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}>
              Active Pipeline: ${activePipeline.toLocaleString()}
            </span>
            <span className="badge badge-gray" style={{ fontSize: '0.8125rem', padding: '0.35rem 0.65rem' }}>
              Total: ${totalPipeline.toLocaleString()}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Salesforce-inspired Kanban pipeline with stage velocity & probability tracking
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary-light)', border: '1px solid var(--primary-subtle)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}>
            <TrendingUp size={16} color="var(--primary)" />
            <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>Won this month:</span>
            <strong style={{ color: 'var(--primary)' }}>${wonTotal.toLocaleString()}</strong>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setQuickCreateType('deal');
              setIsQuickCreateOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Add Deal</span>
          </button>
        </div>
      </div>

      {/* Advanced pipeline analytics: shared filters + multi-chart stage drill-down */}
      <DealsPipelineAnalytics
        deals={deals}
        campaigns={campaigns}
        products={products}
        leads={leads}
        onFilteredDealsChange={handleFilteredDealsChange}
        selectedStage={selectedStage}
        onSelectStage={handleSelectStage}
        hideOverview={Boolean(selectedStage && searchParams.get('from') === 'dashboard')}
      />

      {/* User Friendly Permission Alert */}
      {permissionError && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.15rem',
            borderRadius: 10,
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger-text-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.875rem' }}>Permission Denied:</strong>{' '}
              <span style={{ fontSize: '0.85rem' }}>{permissionError}</span>
            </div>
          </div>
          <button
            onClick={() => setPermissionError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--danger-text-dark)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
              padding: '0 4px',
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Selected Deal Stage Path Chevron (Salesforce Path Component) */}
      {selectedDeal && (
        <div className="crm-card" style={{ marginBottom: '1.5rem', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Selected Opportunity</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {selectedDeal.name} (${selectedDeal.value.toLocaleString()})
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn btn-outline btn-sm"
                style={{
                  color: canDeleteDeals ? 'var(--danger)' : 'var(--text-subtle)',
                  borderColor: canDeleteDeals ? 'var(--danger-border)' : 'var(--border-default)',
                  cursor: canDeleteDeals ? 'pointer' : 'not-allowed',
                  opacity: canDeleteDeals ? 1 : 0.65,
                }}
                disabled={isDeleting}
                onClick={() => handleDeleteDeal(selectedDeal)}
                title={canDeleteDeals ? "Delete Opportunity" : "Permission Denied: Only Owners and Managers can delete deals"}
              >
                <Trash2 size={14} /> {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const wonCol = activeColumns.find((c) => c.is_won) || { id: 'Won', name: 'Won', scope: 'org', win_probability: 100 };
                  handleSelectDealStage(selectedDeal, wonCol);
                }}
              >
                <CheckCircle size={14} /> Mark Won
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const lostCol = activeColumns.find((c) => c.is_lost) || { id: 'Lost', name: 'Lost', scope: 'org', win_probability: 0 };
                  handleSelectDealStage(selectedDeal, lostCol);
                }}
              >
                <XCircle size={14} /> Mark Lost
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDeal(null)}>
                Close
              </button>
            </div>

          </div>

          {/* Salesforce Path Chevrons (Canonical Root Stages) */}
          <div className="salesforce-path" style={{ overflowX: 'auto' }}>
            {rootColumns.map((col, idx) => {
              const selectedDealParentStage = normalizeStage(selectedDeal.stage).toLowerCase();
              const colBase = resolveColumnBaseStage(col).toLowerCase();
              const isCurrent = selectedDealParentStage === colBase;

              const currentIdx = rootColumns.findIndex((c) => resolveColumnBaseStage(c).toLowerCase() === selectedDealParentStage);
              const isPast = currentIdx >= 0 && idx < currentIdx;

              const selectedDealSubCol = activeColumns.find(
                (c) => c.id === selectedDeal.display_stage_id || (selectedDeal.display_stage_name && c.name.toLowerCase() === selectedDeal.display_stage_name.toLowerCase())
              );
              const hasSubStage = isCurrent && selectedDealSubCol && selectedDealSubCol.id !== col.id;

              return (
                <div
                  key={col.id}
                  className={`path-step ${isCurrent ? 'current' : isPast ? 'completed' : ''}`}
                  onClick={() => handleSelectDealStage(selectedDeal, col)}
                  title={`Move to ${col.name}`}
                  style={{ cursor: 'pointer' }}
                >
                  {isPast && <CheckCircle size={13} color="var(--primary)" />}
                  <span>{col.name}</span>
                  {hasSubStage && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        marginLeft: '0.35rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.22)',
                        color: 'inherit',
                      }}
                    >
                      {selectedDealSubCol.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoadingData && deals.length === 0 ? (
        <LoadingSymbol message="" />
      ) : (
        <>
          {selectedStage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
                padding: '0.65rem 1rem',
                borderRadius: 10,
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <Filter size={15} color="var(--primary)" />
                <span>
                  Filtered to stage: <strong>{selectedStage}</strong>
                </span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleSelectStage(null)}
              >
                <ChevronLeft size={14} /> Show all stages
              </button>
            </div>
          )}

          {/* Horizontal Kanban Navigation Buttons */}
          {kanbanScroll.maxScroll > 4 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <button
                type="button"
                className="btn btn-outline btn-sm"
                aria-label="Scroll Kanban left"
                title="Scroll pipeline columns left"
                disabled={kanbanScroll.scrollLeft <= 2}
                onClick={() => scrollKanbanBy(-320)}
                style={{
                  padding: '0.4rem 0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  opacity: kanbanScroll.scrollLeft <= 2 ? 0.45 : 1,
                  cursor: kanbanScroll.scrollLeft <= 2 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                aria-label="Scroll Kanban right"
                title="Scroll pipeline columns right"
                disabled={kanbanScroll.scrollLeft >= kanbanScroll.maxScroll - 2}
                onClick={() => scrollKanbanBy(320)}
                style={{
                  padding: '0.4rem 0.65rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  opacity: kanbanScroll.scrollLeft >= kanbanScroll.maxScroll - 2 ? 0.45 : 1,
                  cursor: kanbanScroll.scrollLeft >= kanbanScroll.maxScroll - 2 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Kanban Board */}
          <div
            ref={kanbanBoardRef}
            onScroll={syncKanbanScroll}
            className="deals-kanban-board"
          >
        {displayedColumns.map((col) => {
          const subStages = getSubStagesForColumn(col);
          const allParentDeals = visibleDeals.filter((d) => dealBelongsToParent(d, col));
          const colValue = allParentDeals.reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);
          const colBaseStage = resolveColumnBaseStage(col);
          const isCanonicalCol = CANONICAL_STAGES.includes(colBaseStage);
          const canAddSubColumn = Boolean(activePipelineId);
          const canManageColumn = Boolean(activePipelineId) && !col.is_system && (col.scope === 'personal' || isOwner);
          const isDragTarget = dragOverColId === col.id;

          // Categorize deals into sub-stages vs unassigned deals
          const unassignedDeals = allParentDeals.filter(
            (d) =>
              !subStages.some(
                (s) =>
                  resolveDealColumnId(d) === s.id ||
                  (d.display_stage_name && d.display_stage_name.toLowerCase() === s.name.toLowerCase())
              )
          );
          const unassignedValue = unassignedDeals.reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);
          const isUnassignedCollapsed = Boolean(collapsedSubStages[`${col.id}_general`]);
          const isUnassignedDragTarget = dragOverSubStageId === `${col.id}_general`;

          return (
            <div
              key={col.id}
              className={`kanban-column ${isDragTarget ? 'drag-over' : ''}`}
              style={col.color ? { borderTop: `3px solid ${col.color}` } : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverColId !== col.id) setDragOverColId(col.id);
              }}
              onDragLeave={() => {
                if (dragOverColId === col.id) setDragOverColId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverColId(null);
                setDragOverSubStageId(null);
                if (draggedDealId) {
                  updateDealStage(draggedDealId, col.name, col.id);
                  setDraggedDealId(null);
                }
              }}
            >
              {/* Column Header */}
              <div className="kanban-column-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isCanonicalCol) return;
                        handleSelectStage(selectedStage === colBaseStage ? null : colBaseStage);
                      }}
                      title={
                        !isCanonicalCol
                          ? col.name
                          : selectedStage === colBaseStage
                            ? 'Click to show all stages'
                            : `Show only ${colBaseStage} stage`
                      }
                      style={{
                        background: 'transparent',
                        border: 0,
                        padding: 0,
                        cursor: isCanonicalCol ? 'pointer' : 'default',
                        color: 'inherit',
                        font: 'inherit',
                        display: 'inline-flex',
                        alignItems: 'center',
                        textAlign: 'left',
                      }}
                    >
                      <span className="kanban-column-title">
                        {col.name}
                        <span className="badge badge-gray">{allParentDeals.length}</span>
                      </span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  <span className="kanban-column-total">
                    ${(colValue / 1000).toFixed(0)}k
                  </span>

                  {(canAddSubColumn || canManageColumn) && (
                    <div className="kanban-col-actions">
                      {canAddSubColumn && (
                        <button
                          type="button"
                          className="kanban-icon-btn"
                          title={`Add sub-column under "${col.name}"`}
                          onClick={() => openAddColumnModal(col)}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                      {canManageColumn && (
                        <>
                          <button
                            type="button"
                            className="kanban-icon-btn"
                            title={`Edit "${col.name}"`}
                            onClick={() => openEditColumnModal(col)}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            className="kanban-icon-btn danger"
                            title={`Delete "${col.name}"`}
                            onClick={() => openDeleteColumnModal(col)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cards / Sub-stage Stacks */}
              <div className="kanban-cards-stack">
                {subStages.length > 0 ? (
                  <>
                    {/* Render Each Sub-stage as a Stacked Box Container */}
                    {subStages.map((sub) => {
                      const dealsInSub = allParentDeals.filter(
                        (d) =>
                          resolveDealColumnId(d) === sub.id ||
                          (d.display_stage_name && d.display_stage_name.toLowerCase() === sub.name.toLowerCase())
                      );
                      const subValue = dealsInSub.reduce((acc, d) => acc + (Number(d.value || d.amount) || 0), 0);
                      const isSubCollapsed = Boolean(collapsedSubStages[sub.id]);
                      const isSubDragTarget = dragOverSubStageId === sub.id;
                      const canManageSub =
                        Boolean(activePipelineId) &&
                        !sub.is_system &&
                        (sub.scope === 'personal' || isOwner);

                      return (
                        <div
                          key={sub.id}
                          className={`kanban-substage-box ${isSubDragTarget ? 'drag-over' : ''}`}
                          style={{
                            marginBottom: '0.75rem',
                            borderLeft: sub.color ? `3.5px solid ${sub.color}` : '3.5px solid var(--primary)',
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragOverSubStageId !== sub.id) setDragOverSubStageId(sub.id);
                          }}
                          onDragLeave={(e) => {
                            e.stopPropagation();
                            if (dragOverSubStageId === sub.id) setDragOverSubStageId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverSubStageId(null);
                            setDragOverColId(null);
                            if (draggedDealId) {
                              updateDealStage(draggedDealId, col.name, sub.id);
                              setDraggedDealId(null);
                            }
                          }}
                        >
                          {/* Card-Style Sub-Stage Header (Big like a Deal Card, full text presentation) */}
                          <div
                            className="substage-header"
                            onClick={() => toggleSubStageCollapsed(sub.id)}
                            title="Click to toggle collapse"
                          >
                            {/* Row 1: Sub-stage Tag & Actions / Chevron */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: sub.color || 'var(--primary)',
                                    display: 'inline-block',
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  {col.name} Sub-stage
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                                {canManageSub && (
                                  <>
                                    <button
                                      type="button"
                                      className="kanban-icon-btn"
                                      title={`Edit sub-column "${sub.name}"`}
                                      style={{ width: 22, height: 22, padding: 0 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditColumnModal(sub);
                                      }}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      className="kanban-icon-btn danger"
                                      title={`Delete sub-column "${sub.name}"`}
                                      style={{ width: 22, height: 22, padding: 0, color: 'var(--danger, #ef4444)' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDeleteColumnModal(sub);
                                      }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', marginLeft: '0.15rem' }}>
                                  {isSubCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </div>
                            </div>

                            {/* Row 2: Full Title (All text presented clearly, never truncated with ellipsis) */}
                            <h4 className="substage-card-title">
                              {sub.name}
                            </h4>

                            {/* Row 3: Deal Count & Stage Total Revenue */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.15rem' }}>
                              <span className="badge badge-blue substage-card-badge">
                                {dealsInSub.length} {dealsInSub.length === 1 ? 'deal' : 'deals'}
                              </span>
                              <span className="substage-card-amount">
                                ${subValue.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Sub-stage Box Cards (Full size like southerncompany) */}
                          {!isSubCollapsed && (
                            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', minHeight: 60 }}>
                              {dealsInSub.length === 0 ? (
                                <div
                                  style={{
                                    padding: '1.25rem 0.5rem',
                                    textAlign: 'center',
                                    color: 'var(--text-subtle)',
                                    fontSize: '0.8125rem',
                                    border: '1px dashed var(--border-default)',
                                    borderRadius: 8,
                                    background: 'var(--surface-soft)',
                                  }}
                                >
                                  Drop deals here
                                </div>
                              ) : (
                                dealsInSub.map((deal) => renderDealCard(deal, col, subStages))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Unassigned Deals Container */}
                    {unassignedDeals.length > 0 && (
                      <div
                        className={`kanban-substage-box ${isUnassignedDragTarget ? 'drag-over' : ''}`}
                        style={{ marginBottom: '0.75rem' }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragOverSubStageId !== `${col.id}_general`) setDragOverSubStageId(`${col.id}_general`);
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          if (dragOverSubStageId === `${col.id}_general`) setDragOverSubStageId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverSubStageId(null);
                          setDragOverColId(null);
                          if (draggedDealId) {
                            updateDealStage(draggedDealId, col.name, col.id);
                            setDraggedDealId(null);
                          }
                        }}
                      >
                        {/* Card-Style General Sub-Stage Header */}
                        <div
                          className="substage-header"
                          onClick={() => toggleSubStageCollapsed(`${col.id}_general`)}
                          title="Click to toggle collapse"
                        >
                          {/* Row 1: General Pool Tag & Chevron */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              General Pool
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                              {isUnassignedCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>

                          {/* Row 2: Full Title */}
                          <h4 className="substage-card-title" style={{ color: 'var(--text-muted)' }}>
                            General {col.name}
                          </h4>

                          {/* Row 3: Deal Count & Stage Total Revenue */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.15rem' }}>
                            <span className="badge badge-gray substage-card-badge">
                              {unassignedDeals.length} {unassignedDeals.length === 1 ? 'deal' : 'deals'}
                            </span>
                            <span className="substage-card-amount" style={{ color: 'var(--text-muted)' }}>
                              ${unassignedValue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {!isUnassignedCollapsed && (
                          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {unassignedDeals.map((deal) => renderDealCard(deal, col, subStages))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Add Sub-stage Button at Bottom of Column */}
                    {canAddSubColumn && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          padding: '0.45rem',
                          borderStyle: 'dashed',
                          borderColor: 'var(--border-default)',
                          color: 'var(--text-muted)',
                          marginTop: '0.25rem',
                        }}
                        onClick={() => openAddColumnModal(col)}
                      >
                        <Plus size={13} />
                        <span>Add Sub-stage to {col.name}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {/* Columns without sub-stages: Render Standard Flat Stack */}
                    {allParentDeals.length === 0 ? (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-subtle)', fontSize: '0.8125rem' }}>
                        No deals in this stage
                      </div>
                    ) : (
                      allParentDeals.map((deal) => renderDealCard(deal, col, []))
                    )}

                    {canAddSubColumn && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          padding: '0.45rem',
                          borderStyle: 'dashed',
                          borderColor: 'var(--border-default)',
                          color: 'var(--text-muted)',
                          marginTop: '0.5rem',
                        }}
                        onClick={() => openAddColumnModal(col)}
                      >
                        <Plus size={13} />
                        <span>Add Sub-stage...</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {/* Add / Edit Custom Stage Column Modal */}
      {stageModalMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setStageModalMode(null)}
        >
          <div
            className="crm-card"
            style={{ width: '100%', maxWidth: 440, padding: '1.35rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {stageModalMode === 'add'
                  ? `Add Sub-column under "${stageModalParent?.name || 'Qualified'}"`
                  : `Edit Column "${editingStage?.name || ''}"`}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.25rem' }}
                onClick={() => setStageModalMode(null)}
              >
                <X size={16} />
              </button>
            </div>

            {stageModalMode === 'add' && stageModalParent && (
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--info-text)',
                  background: 'var(--info-bg)',
                  border: '1px solid var(--info-border)',
                  borderRadius: 8,
                  padding: '0.55rem 0.75rem',
                  marginBottom: '0.9rem',
                }}
              >
                Deals placed here automatically roll up to{' '}
                <strong>{stageModalParent.parent_base_stage || stageModalParent.name}</strong> for org reporting.
                If deleted later, deals safely return to <strong>{stageModalParent.name}</strong>.
              </div>
            )}

            <form onSubmit={handleSaveStageModal} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                  Column Name *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={stageNameInput}
                  onChange={(e) => setStageNameInput(e.target.value)}
                  placeholder="e.g. High Qualified, Legal Review"
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                    Accent Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', paddingTop: 4 }}>
                    {['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setStageColorInput(hex)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: hex,
                          border: stageColorInput === hex ? '2.5px solid var(--text-main)' : '2px solid var(--bg-card)',
                          boxShadow: '0 0 0 1px var(--border-default)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                    Win Probability (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input-field"
                    value={stageProbInput}
                    onChange={(e) => setStageProbInput(e.target.value)}
                  />
                </div>
              </div>

              {stageModalMode === 'add' && isOwner && (
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                    Column Visibility Scope
                  </label>
                  <select
                    className="input-field"
                    value={stageScopeInput}
                    onChange={(e) => setStageScopeInput(e.target.value)}
                  >
                    <option value="personal">Personal (Only my Kanban board)</option>
                    <option value="org">Organization-wide (Shared with team)</option>
                  </select>
                </div>
              )}

              {stageModalMode === 'edit' && editingStage && (
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                    Column Position on Board
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleMoveStagePosition(editingStage, -1)}
                    >
                      <ChevronLeft size={14} /> Move Left
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleMoveStagePosition(editingStage, 1)}
                    >
                      Move Right <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {stageError && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--danger-text)', fontWeight: 500 }}>
                  {stageError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStageModalMode(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSavingStage}>
                  {isSavingStage ? 'Saving...' : stageModalMode === 'add' ? 'Create Sub-column' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Column Deletion & Deal Reassignment Modal */}
      {deleteStageTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setDeleteStageTarget(null)}
        >
          <div
            className="crm-card"
            style={{ width: '100%', maxWidth: 440, padding: '1.35rem', background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Delete {deleteStageTarget.parent_stage_id || deleteStageTarget.parent_base_stage ? 'Sub-column' : 'Column'} "{deleteStageTarget.name}"
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.25rem' }}
                onClick={() => setDeleteStageTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.9rem', lineHeight: 1.5 }}>
              All deals currently inside <strong>{deleteStageTarget.name}</strong> will be safely reassigned before deletion. Zero deals will be deleted or lost.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-body)', display: 'block', marginBottom: 4 }}>
                Move Deals To Stage
              </label>
              <select
                className="input-field"
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
              >
                {activeColumns
                  .filter(
                    (c) =>
                      c.id !== deleteStageTarget.id &&
                      (deleteStageTarget.scope === 'personal' || c.scope === 'org')
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.scope === 'org' ? '(Core Stage)' : '(Personal)'}
                    </option>
                  ))}
              </select>
            </div>

            {stageError && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--danger-text)', fontWeight: 500, marginBottom: '0.75rem' }}>
                {stageError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeleteStageTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none' }}
                onClick={handleConfirmDeleteColumn}
                disabled={isDeletingStage}
              >
                {isDeletingStage ? 'Moving Deals...' : 'Confirm Safe Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
