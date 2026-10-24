import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUploader from '../components/ui/ImageUploader';
import { useToast } from '../components/ui/ToastContext';
import { createPoll } from '../firebase/pollService';
import type { DraftOption, DraftPoll, PollSettings } from '../types/poll';
import { DEFAULT_SETTINGS } from '../types/poll';
import { generateId, orderToLabel } from '../utils/code';
import { saveDraft, loadDraft, clearDraft, saveRecentPoll } from '../utils/device';

const MAX_OPTIONS = 12;
const MIN_OPTIONS = 2;

function newOption(order: number): DraftOption {
  return { id: generateId(), title: '', imageDataUrl: '', label: orderToLabel(order) };
}

/** Phone mock preview of the voting screen */
const PhonePreview: React.FC<{ draft: DraftPoll }> = ({ draft }) => (
  <div style={{
    border: '4px solid var(--bone)',
    width: '100%',
    maxWidth: 320,
    minHeight: 560,
    margin: '0 auto',
    background: 'var(--void)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  }}>
    {/* Phone top bar */}
    <div style={{ height: 8, background: 'var(--bone)' }} />

    {/* Poll title */}
    <div style={{ padding: '12px 12px 8px', borderBottom: '2px solid var(--ash)' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--bone)', textTransform: 'uppercase' }}>
        {draft.title || 'POLL TITLE'}
      </p>
      {draft.subtitle && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ash)', marginTop: 4 }}>
          {draft.subtitle}
        </p>
      )}
    </div>

    {/* Options preview */}
    <div style={{ padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, flex: 1 }}>
      {draft.options.slice(0, 8).map((opt) => (
        <div key={opt.id} style={{ position: 'relative', aspectRatio: '1/1', border: '2px solid var(--bone)', overflow: 'hidden', background: 'var(--ink)' }}>
          {opt.imageDataUrl
            ? <img src={opt.imageDataUrl} alt={opt.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ash)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>IMG</div>
          }
          <div style={{ position: 'absolute', top: 0, left: 0, background: 'var(--bone)', color: 'var(--void)', fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 5px' }}>{opt.label}</div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--void)', color: 'var(--bone)', fontFamily: 'var(--font-display)', fontSize: 9, padding: '3px 5px', textTransform: 'uppercase', borderTop: '1px solid var(--bone)' }}>
            {opt.title || '—'}
          </div>
        </div>
      ))}
    </div>

    {/* CTA bar */}
    <div style={{ padding: 8, borderTop: '2px solid var(--ash)', background: 'var(--ink)' }}>
      <div style={{ background: 'var(--ash)', color: 'var(--void)', fontFamily: 'var(--font-display)', fontSize: 13, textAlign: 'center', padding: '10px', textTransform: 'uppercase', opacity: 0.6 }}>
        CAST YOUR VOTE
      </div>
    </div>
  </div>
);

const PollMaker: React.FC = () => {
  const navigate = useNavigate();
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
  const draftTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-save draft every 3 seconds
  useEffect(() => {
    draftTimer.current = setInterval(() => {
      saveDraft({ title, subtitle, options, settings });
    }, 3000);
    return () => { if (draftTimer.current) clearInterval(draftTimer.current); };
  }, [title, subtitle, options, settings]);

  const relabel = (opts: DraftOption[]) =>
    opts.map((o, i) => ({ ...o, order: i, label: orderToLabel(i) }));

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
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

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { pollId, hostToken } = await createPoll({
        title: title.trim(),
        subtitle: subtitle.trim(),
        settings,
        options: options.map((o) => ({ title: o.title.trim(), imageUrl: o.imageDataUrl })),
      });
      saveRecentPoll({ pollId, hostToken, title: title.trim(), createdAt: Date.now() });
      clearDraft();
      navigate(`/host/${pollId}?token=${hostToken}`);
    } catch (err) {
      console.error('Create poll error:', err);
      addToast({ message: 'Failed to create poll. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const draft: DraftPoll = { title, subtitle, options, settings };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)' }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid var(--bone)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn-ghost" onClick={() => navigate('/')} aria-label="Back to home">← BACK</button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--bone)', margin: 0 }}>POLL MAKER</h1>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)' }}>DRAFT AUTOSAVED</span>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', minHeight: 'calc(100vh - 73px)' }}>
        {/* LEFT — Builder */}
        <div style={{ padding: 32, borderRight: '3px solid var(--bone)', overflowY: 'auto' }}>

          {/* Poll details */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Poll Title *
            </label>
            <input
              className={`input ${errors.title ? 'input-error' : ''}`}
              value={title}
              maxLength={80}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => { const n = {...p}; delete n.title; return n; }); }}
              placeholder="Best Costume 2026"
            />
            {errors.title && <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4 }}>{errors.title}</p>}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', marginTop: 4 }}>{title.length}/80</p>

            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginTop: 16 }}>
              Subtitle (optional)
            </label>
            <input
              className="input"
              value={subtitle}
              maxLength={120}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Vote for your favourite Halloween costume!"
            />
          </div>

          {/* Options grid */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--bone)' }}>OPTIONS ({options.length}/{MAX_OPTIONS})</h2>
              {errors.options && <span style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{errors.options}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {options.map((opt, idx) => (
                <div key={opt.id} style={{ border: `3px solid ${errors[`opt_${opt.id}`] || errors[`opt_img_${opt.id}`] ? 'var(--blood)' : 'var(--bone)'}`, background: 'var(--ink)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Label */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--pumpkin)' }}>OPTION {opt.label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => moveOption(opt.id, -1)} disabled={idx === 0} aria-label="Move up">↑</button>
                      <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => moveOption(opt.id, 1)} disabled={idx === options.length - 1} aria-label="Move down">↓</button>
                      <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => duplicateOption(opt.id)} aria-label="Duplicate">⧉</button>
                      <button className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12, borderColor: 'var(--blood)', color: 'var(--blood)' }} onClick={() => removeOption(opt.id)} disabled={options.length <= MIN_OPTIONS} aria-label="Remove">×</button>
                    </div>
                  </div>

                  {/* Image upload */}
                  <div style={{ aspectRatio: '1/1' }}>
                    <ImageUploader
                      value={opt.imageDataUrl}
                      onChange={(url) => { updateOption(opt.id, { imageDataUrl: url }); setErrors((p) => { const n = {...p}; delete n[`opt_img_${opt.id}`]; return n; }); }}
                      onError={(msg) => addToast({ message: msg })}
                    />
                  </div>
                  {errors[`opt_img_${opt.id}`] && (
                    <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 11, margin: 0 }}>
                      {errors[`opt_img_${opt.id}`]}
                    </p>
                  )}

                  {/* Title input */}
                  <input
                    className={`input ${errors[`opt_${opt.id}`] ? 'input-error' : ''}`}
                    style={{ fontSize: 14 }}
                    value={opt.title}
                    maxLength={40}
                    onChange={(e) => updateOption(opt.id, { title: e.target.value })}
                    placeholder="Option title…"
                    aria-label={`Option ${opt.label} title`}
                  />
                  {errors[`opt_${opt.id}`] && (
                    <p style={{ color: 'var(--blood)', fontFamily: 'var(--font-mono)', fontSize: 11, margin: 0 }}>
                      {errors[`opt_${opt.id}`]}
                    </p>
                  )}
                </div>
              ))}

              {/* Add option button */}
              {options.length < MAX_OPTIONS && (
                <button
                  className="option-card-empty"
                  onClick={addOption}
                  aria-label="Add option"
                  style={{ minHeight: 120 }}
                >
                  <span style={{ fontSize: 32 }}>+</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>ADD OPTION</span>
                </button>
              )}
            </div>
          </div>

          {/* Settings */}
          <div style={{ borderTop: '3px solid var(--ash)', paddingTop: 16 }}>
            <button
              className="btn-ghost"
              onClick={() => setSettingsOpen((v) => !v)}
              style={{ width: '100%', justifyContent: 'space-between' }}
              aria-expanded={settingsOpen}
            >
              <span>⚙ SETTINGS</span>
              <span>{settingsOpen ? '▲' : '▼'}</span>
            </button>

            {settingsOpen && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              </div>
            )}
          </div>

          {/* Create button */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '3px solid var(--bone)' }}>
            <button
              className="btn-primary"
              style={{ width: '100%', fontSize: 20, padding: '18px 24px' }}
              onClick={handleCreate}
              disabled={submitting || options.length < MIN_OPTIONS}
            >
              {submitting ? 'CREATING…' : '🎃 CREATE POLL'}
            </button>
            {options.length < MIN_OPTIONS && (
              <p style={{ color: 'var(--ash)', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                Add at least {MIN_OPTIONS} options to create a poll
              </p>
            )}
          </div>
        </div>

        {/* RIGHT — Live preview */}
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'sticky', top: 0, height: 'calc(100vh - 73px)', overflowY: 'auto' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            AUDIENCE PREVIEW
          </p>
          <PhonePreview draft={draft} />
        </div>
      </div>

      {/* Mobile styles */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 60%"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="position: sticky"] {
            position: static !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PollMaker;
