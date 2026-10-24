import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Trash2 } from 'lucide-react';
import BatsAnimation from '../components/ui/BatsAnimation';
import { PumpkinIcon, BatIcon, CandleIcon, SkullIcon } from '../components/ui/HalloweenIcons';
import { useToast } from '../components/ui/ToastContext';
import { purgePoll, purgeAllRecentPolls } from '../firebase/pollService';
import { getRecentPolls } from '../utils/device';
import type { RecentPoll } from '../utils/device';

/** Home screen — host entry point */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [recent, setRecent] = useState<RecentPoll[]>(() => getRecentPolls());
  const [resumeCode, setResumeCode] = useState('');

  const handleResume = (poll: RecentPoll) => {
    navigate(`/host/${poll.pollId}?token=${poll.hostToken}`);
  };

  const handleResumeCode = () => {
    const trimmed = resumeCode.trim();
    if (!trimmed) return;
    // Try to parse as pollId?token=... or just pollId
    const parts = trimmed.split('?token=');
    if (parts.length === 2) {
      navigate(`/host/${parts[0]}?token=${parts[1]}`);
    } else {
      navigate(`/host/${trimmed}`);
    }
  };

  const handlePurgeOne = async (e: React.MouseEvent, poll: RecentPoll) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `PURGE "${poll.title.toUpperCase()}" PERMANENTLY?\n\nThis will destroy this poll, all options, and all votes from Firestore and this device. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await purgePoll(poll.pollId, poll.hostToken);
      setRecent((prev) => prev.filter((p) => p.pollId !== poll.pollId));
      addToast({ message: 'Poll permanently purged from existence.' });
    } catch (err) {
      addToast({ message: `Purge failed: ${(err as Error).message}` });
    }
  };

  const handlePurgeAll = async () => {
    const confirmed = window.confirm(
      'PURGE ALL PAST POLLS PERMANENTLY?\n\nThis will destroy all past polls from Firestore and this device. This cannot be undone.'
    );
    if (!confirmed) return;
    try {
      await purgeAllRecentPolls();
      setRecent([]);
      addToast({ message: 'All past polls permanently purged.' });
    } catch (err) {
      addToast({ message: `Purge all failed: ${(err as Error).message}` });
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', position: 'relative', overflow: 'hidden' }}>
      <BatsAnimation />

      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: 48, position: 'relative', zIndex: 1 }}>
        {/* Geometric pumpkin SVG icon */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true" style={{ marginBottom: 16 }}>
          {/* Pumpkin body (octagon) */}
          <polygon points="24,12 56,12 68,24 72,40 68,56 56,68 24,68 12,56 8,40 12,24" fill="var(--pumpkin)" stroke="var(--bone)" strokeWidth="3" />
          {/* Face */}
          <rect x="26" y="30" width="10" height="8" fill="var(--void)" />
          <rect x="44" y="30" width="10" height="8" fill="var(--void)" />
          <rect x="28" y="46" width="24" height="6" fill="var(--void)" />
          <rect x="34" y="50" width="4" height="6" fill="var(--pumpkin)" />
          <rect x="42" y="50" width="4" height="6" fill="var(--pumpkin)" />
          {/* Stem */}
          <rect x="36" y="4" width="8" height="10" fill="var(--bone)" />
        </svg>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 8vw, 72px)', color: 'var(--bone)', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 0.9, marginBottom: 12 }}>
          HALLOWEEN<br />
          <span style={{ color: 'var(--pumpkin)' }}>POLL</span>
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 18, color: 'var(--ash)', marginTop: 16 }}>
          Let the room decide who's scariest.
        </p>
      </div>

      {/* Primary CTA */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 480 }}>
        <button
          className="btn-primary"
          style={{ fontSize: 20, padding: '16px 48px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          onClick={() => navigate('/create')}
        >
          <Plus size={22} strokeWidth={2.5} /> CREATE A POLL
        </button>

        {/* Resume section */}
        <div style={{ width: '100%', borderTop: '2px solid var(--ash)', paddingTop: 24 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Have a host link? Resume
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Paste host link or poll ID…"
              value={resumeCode}
              onChange={(e) => setResumeCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleResumeCode(); }}
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" onClick={handleResumeCode} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              GO <ArrowRight size={16} />
            </button>
          </div>

          {/* Recent polls */}
          {recent.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                  Recent polls
                </p>
                <button
                  className="btn-ghost"
                  onClick={handlePurgeAll}
                  style={{ fontSize: 10, padding: '3px 8px', borderColor: 'var(--blood)', color: 'var(--blood)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title="Purge all past polls from Firestore and device"
                >
                  <Trash2 size={12} /> PURGE ALL
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recent.map((poll) => (
                  <div
                    key={poll.pollId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--ink)',
                      border: '2px solid var(--ash)',
                      padding: '4px 8px',
                    }}
                  >
                    <button
                      className="btn-ghost"
                      onClick={() => handleResume(poll)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        border: 'none',
                        padding: '6px 4px',
                        background: 'transparent',
                        color: 'var(--bone)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Resume as host"
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                        {poll.title}
                      </span>
                      <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11, fontFamily: 'var(--font-mono)', paddingLeft: 8, whiteSpace: 'nowrap' }}>
                        {new Date(poll.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={(e) => handlePurgeOne(e, poll)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        borderColor: 'var(--blood)',
                        color: 'var(--blood)',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title={`Purge "${poll.title}" everywhere`}
                    >
                      <Trash2 size={12} /> PURGE
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* How it works strip */}
        <div style={{ width: '100%', marginTop: 20, borderTop: '2px solid var(--ash)', paddingTop: 24 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center' }}>
            ✦ HOW THE RITUAL WORKS ✦
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { n: '01', label: 'CREATE', icon: <PumpkinIcon size={26} color="var(--pumpkin)" /> },
              { n: '02', label: 'SCAN',   icon: <BatIcon size={28} color="var(--bone)" /> },
              { n: '03', label: 'VOTE',   icon: <CandleIcon size={26} color="var(--toxic)" /> },
              { n: '04', label: 'REVEAL', icon: <SkullIcon size={26} color="var(--pumpkin)" /> },
            ].map((step) => (
              <div
                key={step.n}
                style={{
                  background: 'var(--ink)',
                  border: '2px solid var(--bone)',
                  boxShadow: '4px 4px 0 var(--bone)',
                  padding: '12px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 112,
                  textAlign: 'center',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--pumpkin)', letterSpacing: '0.1em', fontWeight: 700 }}>
                  {step.n}
                </span>
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {step.icon}
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--bone)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
