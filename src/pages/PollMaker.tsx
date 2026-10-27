import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Save,
  Sliders,
  Flame,
} from 'lucide-react';
import ImageUploader from '../components/ui/ImageUploader';
import { useToast } from '../components/ui/ToastContext';
import { PumpkinIcon } from '../components/ui/HalloweenIcons';
import { createPoll, getPoll, updatePollDraft } from '../firebase/pollService';
import type { DraftOption, DraftPoll, PollSettings } from '../types/poll';
import { DEFAULT_SETTINGS } from '../types/poll';
import { generateId, orderToLabel } from '../utils/code';
import { saveDraft, loadDraft, clearDraft, saveRecentPoll } from '../utils/device';

const MIN_OPTIONS = 2;

function newOption(order: number): DraftOption {
  return { id: generateId(), title: '', imageDataUrl: '', label: orderToLabel(order) };
}

/** Retro-arcade Halloween phone mock preview of the voting screen */
const PhonePreview: React.FC<{ draft: DraftPoll }> = ({ draft }) => (
  <div style={{
    border: '6px solid var(--bone)',
    boxShadow: '10px 10px 0 var(--bone)',
    width: '100%',
    maxWidth: 320,
    minHeight: 580,
    margin: '0 auto',
    background: 'var(--void)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  }}>
    {/* Retro speaker notch & camera dot */}
    <div style={{ height: 20, background: 'var(--ink)', borderBottom: '2px solid var(--bone)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <div style={{ width: 40, height: 4, background: 'var(--ash)' }} />
      <div style={{ width: 6, height: 6, background: 'var(--pumpkin)' }} />
    </div>

    {/* Phone top hazard stripes */}
    <div className="hazard-stripes" style={{ height: 4, width: '100%' }} />

    {/* Poll title */}
    <div style={{ padding: '10px 12px', borderBottom: '2px solid var(--bone)', background: 'var(--ink)' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--bone)', textTransform: 'uppercase', margin: 0 }}>
        {draft.title || 'POLL TITLE'}
      </p>
      {draft.subtitle && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ash)', marginTop: 4, margin: '4px 0 0' }}>
          {draft.subtitle}
        </p>
      )}
    </div>

    {/* Options preview */}
    <div style={{ padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, overflowY: 'auto' }}>
      {draft.options.slice(0, 8).map((opt) => (
        <div key={opt.id} style={{ position: 'relative', aspectRatio: '1/1', border: '2px solid var(--bone)', overflow: 'hidden', background: 'var(--ink)', boxShadow: '2px 2px 0 var(--bone)' }}>
          {opt.imageDataUrl
            ? <img src={opt.imageDataUrl} alt={opt.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ash)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>IMG</div>
          }
          <div style={{ position: 'absolute', top: 0, left: 0, background: 'var(--bone)', color: 'var(--void)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 900, padding: '2px 4px' }}>{opt.label}</div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--void)', color: 'var(--bone)', fontFamily: 'var(--font-display)', fontSize: 9, padding: '3px 4px', textTransform: 'uppercase', borderTop: '1px solid var(--bone)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {opt.title || '—'}
          </div>
        </div>
      ))}
    </div>

    {/* CTA bar */}
    <div style={{ padding: 10, borderTop: '2px solid var(--bone)', background: 'var(--ink)' }}>
      <div style={{ background: 'var(--pumpkin)', color: 'var(--void)', fontFamily: 'var(--font-display)', fontSize: 12, textAlign: 'center', padding: '10px', textTransform: 'uppercase', boxShadow: '3px 3px 0 var(--bone)', fontWeight: 900 }}>
        CAST YOUR VOTE
      </div>
    </div>
  </div>
);

const PollMaker: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPollId = searchParams.get('edit');
  const editToken = searchParams.get('token');
  const isEditing = Boolean(editPollId && editToken);

  const { addToast } = useToast();
  const [title, setTitle] = useState(() => loadDraft<DraftPoll>()?.title ?? '');
  const [subtitle, setSubtitle] = useState(() => loadDraft<DraftPoll>()?.subtitle ?? '');
  const [options, setOptions] = useState<DraftOption[]>(() => {
    const draft = loadDraft<DraftPoll>();
    return draft && draft.options.length >= 2 ? draft.options : [newOption(0), newOption(1)];
  });
  const [settings, setSettings] = useState<PollSettings>(() => loadDraft<DraftPoll>()?.settings ?? DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const draftTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing poll for editing if in edit mode
  useEffect(() => {
    if (!editPollId) return;
    getPoll(editPollId).then((existing) => {
      if (!existing) return;
      if (existing.status !== 'lobby') {
        addToast({ message: 'Poll has already started and cannot be edited.' });
        return;
      }
      setTitle(existing.title);
      setSubtitle(existing.subtitle || '');
      setSettings(existing.settings);
      if (existing.options && existing.options.length > 0) {
        setOptions(
          existing.options.map((o) => ({
            id: o.id,
            title: o.title,
            imageDataUrl: o.imageUrl,
            label: o.label,
          }))
        );
      }
    }).catch(console.error);
  }, [editPollId, addToast]);

  // Auto-save draft every 3 seconds (only when not in edit mode)
  useEffect(() => {
    if (isEditing) return;
    draftTimer.current = setInterval(() => {
      saveDraft({ title, subtitle, options, settings });
    }, 3000);
    return () => { if (draftTimer.current) clearInterval(draftTimer.current); };
  }, [title, subtitle, options, settings, isEditing]);

  const relabel = (opts: DraftOption[]) =>
    opts.map((o, i) => ({ ...o, order: i, label: orderToLabel(i) }));

  const addOption = () => {
    setOptions((prev) => relabel([...prev, newOption(prev.length)]));
  };

  const removeOption = (id: string) => {
    const idx = options.findIndex((o) => o.id === id);
    const removed = options[idx];
    const next = relabel(options.filter((o) => o.id !== id));
    setOptions(next);
    addToast({
      message: `Option ${removed.label} removed.`,
      actionLabel: 'UNDO',
      onAction: () => setOptions((prev) => relabel([
        ...prev.slice(0, idx),
        removed,
        ...prev.slice(idx),
      ])),
      duration: 5000,
    });
  };

  const duplicateOption = (id: string) => {
    const src = options.find((o) => o.id === id);
    if (!src) return;
    const dup = { ...src, id: generateId(), title: src.title + ' (copy)' };
    const idx = options.findIndex((o) => o.id === id);
    setOptions((prev) => relabel([...prev.slice(0, idx + 1), dup, ...prev.slice(idx + 1)]));
  };

  const updateOption = (id: string, patch: Partial<DraftOption>) => {
    setOptions((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o));
    setErrors((prev) => { const n = { ...prev }; delete n[`opt_${id}`]; return n; });
  };

  const moveOption = (id: string, dir: -1 | 1) => {
    const idx = options.findIndex((o) => o.id === id);
    if (idx + dir < 0 || idx + dir >= options.length) return;
    const next = [...options];
    [next[idx], next[idx + dir]] = [next[idx + dir], next[idx]];
    setOptions(relabel(next));
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    const next = [...options];
    const [moved] = next.splice(draggedIdx, 1);
    next.splice(targetIdx, 0, moved);
    setOptions(relabel(next));
    setDraggedIdx(null);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Poll title is required.';
    if (options.length < MIN_OPTIONS) errs.options = `Add at least ${MIN_OPTIONS} options.`;
    for (const opt of options) {
      if (!opt.title.trim()) errs[`opt_${opt.id}`] = 'Needs a title';
      if (!opt.imageDataUrl) errs[`opt_img_${opt.id}`] = 'Needs an image';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isEditing && editPollId && editToken) {
        await updatePollDraft(editPollId, editToken, {
          title: title.trim(),
          subtitle: subtitle.trim(),
          settings,
          options: options.map((o) => ({ title: o.title.trim(), imageUrl: o.imageDataUrl })),
        });
        addToast({ message: 'Poll options updated!' });
        navigate(`/host/${editPollId}?token=${editToken}`);
      } else {
        const { pollId, hostToken } = await createPoll({
          title: title.trim(),
          subtitle: subtitle.trim(),
          settings,
          options: options.map((o) => ({ title: o.title.trim(), imageUrl: o.imageDataUrl })),
        });
        saveRecentPoll({ pollId, hostToken, title: title.trim(), createdAt: Date.now() });
        clearDraft();
        navigate(`/host/${pollId}?token=${hostToken}`);
      }
    } catch (err) {
      console.error('Save/Create poll error:', err);
      addToast({ message: `Failed: ${(err as Error).message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const draft: DraftPoll = { title, subtitle, options, settings };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)' }}>
      {/* Top accent hazard stripes */}
      <div className="hazard-stripes" style={{ height: 6, width: '100%' }} />

      {/* Header */}
      <div className="pollmaker-header" style={{ borderBottom: '3px solid var(--bone)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--ink)' }}>
        <button className="btn-ghost" onClick={() => navigate('/')} aria-label="Back to home" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> BACK
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PumpkinIcon size={26} color="var(--pumpkin)" />
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--bone)', margin: 0, textTransform: 'uppercase', lineHeight: 1 }}>
              {isEditing ? 'EDIT POLL OPTIONS' : 'POLL MAKER'}
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '4px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ✦ SUMMON YOUR CONTEST ✦
            </p>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--ash)', background: 'var(--void)', color: 'var(--toxic)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span className="blink-dot" style={{ width: 8, height: 8 }} />
            CRYPT AUTOSAVE
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="pollmaker-grid" style={{ display: 'grid', gridTemplateColumns: '60% 40%', minHeight: 'calc(100vh - 81px)' }}>
        {/* LEFT — Builder */}
        <div className="pollmaker-builder-col" style={{ padding: 32, borderRight: '3px solid var(--bone)', overflowY: 'auto' }}>

          {/* STEP 1: Contest Details */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ background: 'var(--pumpkin)', color: 'var(--void)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 900, padding: '4px 8px' }}>
                01
              </span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--bone)', margin: 0, textTransform: 'uppercase' }}>
                CONTEST DETAILS
              </h2>
            </div>

            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Poll Title *
            </label>
            <input
              className={`input ${errors.title ? 'input-error' : ''}`}
              value={title}
              maxLength={80}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => { const n = {...p}; delete n.title; return n; }); }}
              placeholder="e.g. Best Costume 2026"
            />
            {errors.title && <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4 }}>{errors.title}</p>}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', marginTop: 4 }}>{title.length}/80 characters</p>

            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginTop: 16 }}>
              Subtitle (optional)
            </label>
            <input
              className="input"
              value={subtitle}
              maxLength={120}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Vote for your favourite Halloween disguise!"
            />
          </div>

          {/* STEP 2: Contestants */}
          <div style={{ marginBottom: 36, borderTop: '2px solid var(--ash)', paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'var(--toxic)', color: 'var(--void)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 900, padding: '4px 8px' }}>
                  02
                </span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--bone)', margin: 0, textTransform: 'uppercase' }}>
                  CONTESTANTS ({options.length})
                </h2>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                MIN {MIN_OPTIONS} REQUIRED · UNLIMITED OPTIONS
              </span>
            </div>
            {errors.options && <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 12 }}>{errors.options}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {options.map((opt, idx) => (
                <div
                  key={opt.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  style={{
                    border: `3px solid ${errors[`opt_${opt.id}`] || errors[`opt_img_${opt.id}`] ? 'var(--blood)' : 'var(--bone)'}`,
                    background: 'var(--ink)',
                    boxShadow: '4px 4px 0 var(--bone)',
                    display: 'flex',
                    flexDirection: 'column',
                    opacity: draggedIdx === idx ? 0.4 : 1,
                    transition: 'box-shadow 120ms linear, transform 120ms linear',
                  }}
                >
                  {/* Card header strip */}
                  <div style={{ background: 'var(--void)', padding: '6px 8px', borderBottom: '2px solid var(--bone)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{ cursor: 'grab', userSelect: 'none', color: 'var(--ash)', display: 'flex', alignItems: 'center' }}
                        title="Drag to reorder"
                      >
                        <GripVertical size={14} />
                      </span>
                      <span style={{ background: 'var(--bone)', color: 'var(--void)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 900, padding: '2px 6px' }}>
                        {opt.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button className="btn-micro" onClick={() => moveOption(opt.id, -1)} disabled={idx === 0} aria-label="Move up" title="Move up">
                        <ChevronUp size={13} />
                      </button>
                      <button className="btn-micro" onClick={() => moveOption(opt.id, 1)} disabled={idx === options.length - 1} aria-label="Move down" title="Move down">
                        <ChevronDown size={13} />
                      </button>
                      <button className="btn-micro" onClick={() => duplicateOption(opt.id)} aria-label="Duplicate" title="Duplicate">
                        <Copy size={13} />
                      </button>
                      <button className="btn-micro" style={{ borderColor: 'var(--blood)', color: 'var(--blood)' }} onClick={() => removeOption(opt.id)} disabled={options.length <= MIN_OPTIONS} aria-label="Remove" title="Remove">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {/* Image upload */}
                    <div style={{ aspectRatio: '1/1', border: '2px solid var(--bone)', overflow: 'hidden' }}>
                      <ImageUploader
                        value={opt.imageDataUrl}
                        errorMessage={errors[`opt_img_${opt.id}`]}
                        onChange={(url) => {
                          updateOption(opt.id, { imageDataUrl: url });
                          setErrors((p) => { const n = {...p}; delete n[`opt_img_${opt.id}`]; return n; });
                        }}
                        onError={(msg) => {
                          setErrors((p) => ({ ...p, [`opt_img_${opt.id}`]: msg }));
                          addToast({ message: msg });
                        }}
                      />
                    </div>
                    {errors[`opt_img_${opt.id}`] && (
                      <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 11, margin: 0, fontWeight: 700 }}>
                        {errors[`opt_img_${opt.id}`]}
                      </p>
                    )}

                    {/* Title input */}
                    <input
                      className={`input ${errors[`opt_${opt.id}`] ? 'input-error' : ''}`}
                      style={{ fontSize: 13, padding: '6px 8px' }}
                      value={opt.title}
                      maxLength={40}
                      onChange={(e) => updateOption(opt.id, { title: e.target.value })}
                      placeholder="Contestant name…"
                      aria-label={`Option ${opt.label} title`}
                    />
                    {errors[`opt_${opt.id}`] && (
                      <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 11, margin: 0 }}>
                        {errors[`opt_${opt.id}`]}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Add option button (Unlimited options) */}
              <button
                onClick={addOption}
                aria-label="Add contestant"
                style={{
                  border: '3px dashed var(--bone)',
                  background: 'rgba(26,22,32,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  minHeight: 280,
                  height: '100%',
                  cursor: 'pointer',
                  color: 'var(--bone)',
                  boxShadow: '4px 4px 0 rgba(244,238,223,0.2)',
                  transition: 'all 120ms linear',
                  padding: 16,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--pumpkin)';
                  e.currentTarget.style.color = 'var(--pumpkin)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--bone)';
                  e.currentTarget.style.color = 'var(--bone)';
                }}
              >
                <Plus size={36} strokeWidth={2.5} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em', fontWeight: 700 }}>
                  SUMMON CONTESTANT
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ash)' }}>
                  (Click to add option {orderToLabel(options.length)})
                </span>
              </button>
            </div>
          </div>

          {/* STEP 3: Settings */}
          <div style={{ borderTop: '2px solid var(--ash)', paddingTop: 24, marginBottom: 24 }}>
            <button
              className="btn-ghost"
              onClick={() => setSettingsOpen((v) => !v)}
              style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--ink)', border: '2px solid var(--bone)', display: 'flex', alignItems: 'center' }}
              aria-expanded={settingsOpen}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'var(--witch)', color: 'var(--bone)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 900, padding: '4px 8px' }}>
                  03
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sliders size={16} color="var(--pumpkin)" /> RULES OF THE RITUAL
                </span>
              </div>
              {settingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {settingsOpen && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--ink)', border: '2px solid var(--bone)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Votes per person selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Votes per person</label>
                  <select
                    className="input"
                    value={settings.votesPerPerson || 1}
                    onChange={(e) => setSettings((s) => ({ ...s, votesPerPerson: Number(e.target.value) }))}
                    style={{ background: 'var(--void)', color: 'var(--bone)' }}
                  >
                    <option value={1}>1 vote per person (default)</option>
                    <option value={2}>2 votes per person</option>
                    <option value={3}>3 votes per person</option>
                    <option value={4}>4 votes per person</option>
                    <option value={5}>5 votes per person</option>
                  </select>
                </div>

                {[
                  { key: 'allowChangeVote',          label: 'Allow changing vote until poll stops' },
                  { key: 'showLiveCountsHost',        label: 'Show live vote counts on host screen' },
                  { key: 'showLiveCountsBigScreen',   label: 'Show live counts on big screen (spoils reveal!)' },
                  { key: 'requireNickname',           label: 'Require a nickname from audience' },
                  { key: 'shuffleOptions',            label: 'Shuffle option order per voter (reduces first-pick bias)' },
                ] .map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--bone)' }}>
                    <input
                      type="checkbox"
                      checked={settings[key as keyof PollSettings] as boolean}
                      onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: 'var(--pumpkin)', cursor: 'pointer' }}
                    />
                    {label}
                  </label>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tie rule</label>
                  <select
                    className="input"
                    value={settings.tieRule}
                    onChange={(e) => setSettings((s) => ({ ...s, tieRule: e.target.value as PollSettings['tieRule'] }))}
                    style={{ background: 'var(--void)', color: 'var(--bone)' }}
                  >
                    <option value="co-winners">Show co-winners</option>
                    <option value="host-picks">Host picks winner</option>
                    <option value="sudden-death">Sudden-death revote</option>
                  </select>
                </div>

                {/* Special Votes (Jury Ballot) */}
                <div style={{ borderTop: '1px dashed var(--ash)', paddingTop: 14 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.enableSpecialVotes ?? false}
                      onChange={(e) => setSettings((s) => ({ ...s, enableSpecialVotes: e.target.checked }))}
                      style={{ width: 18, height: 18, accentColor: 'var(--pumpkin)', cursor: 'pointer', marginTop: 2 }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--pumpkin)', display: 'block', fontFamily: 'var(--font-body)', fontSize: 15 }}>
                        ENABLE SPECIAL VOTES (JURY BALLOT)
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', display: 'block', marginTop: 2 }}>
                        Normal votes count as 1 pt. After voting closes, host enters physical Jury votes (5 pts each) before revealing final results.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Create button */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '3px solid var(--bone)' }}>
            <button
              className="btn-primary"
              style={{ width: '100%', fontSize: 20, padding: '18px 24px', boxShadow: '8px 8px 0 var(--bone)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              onClick={handleSubmit}
              disabled={submitting || options.length < MIN_OPTIONS}
            >
              {submitting ? (
                'SAVING…'
              ) : isEditing ? (
                <>
                  <Save size={20} /> SAVE CHANGES
                </>
              ) : (
                <>
                  <Flame size={20} /> CREATE POLL
                </>
              )}
            </button>
            {options.length < MIN_OPTIONS && (
              <p style={{ color: 'var(--ash)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                Add at least {MIN_OPTIONS} options to summon the contest
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — Live preview */}
        <div className="pollmaker-preview-col" style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'sticky', top: 0, height: 'calc(100vh - 81px)', overflowY: 'auto', background: 'rgba(26,22,32,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="blink-dot" style={{ width: 8, height: 8 }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              LIVE AUDIENCE PREVIEW
            </p>
          </div>
          <PhonePreview draft={draft} />
        </div>
      </div>

    </div>
  );
};

export default PollMaker;
