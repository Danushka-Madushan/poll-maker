import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BatsAnimation from '../components/ui/BatsAnimation';
import { PumpkinIcon, BatIcon, CandleIcon, SkullIcon } from '../components/ui/HalloweenIcons';
import { getRecentPolls } from '../utils/device';
import type { RecentPoll } from '../utils/device';

/** Home screen — host entry point */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const [recent] = useState<RecentPoll[]>(() => getRecentPolls());
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
          style={{ fontSize: 20, padding: '16px 48px', width: '100%' }}
          onClick={() => navigate('/create')}
        >
          + CREATE A POLL
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
            <button className="btn-secondary" onClick={handleResumeCode} style={{ whiteSpace: 'nowrap' }}>
              GO →
            </button>
          </div>

          {/* Recent polls */}
          {recent.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Recent polls
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recent.map((poll) => (
                  <button
                    key={poll.pollId}
                    className="btn-ghost"
                    onClick={() => handleResume(poll)}
                    style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  >
                    {poll.title}
                    <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>
                      {new Date(poll.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* How it works strip */}
        <div style={{ width: '100%', marginTop: 16, borderTop: '2px solid var(--ash)', paddingTop: 24 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
            HOW IT WORKS
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { n: '1', label: 'CREATE', icon: <PumpkinIcon size={24} color="var(--pumpkin)" /> },
              { n: '2', label: 'SCAN',   icon: <BatIcon size={24} color="var(--bone)" /> },
              { n: '3', label: 'VOTE',   icon: <CandleIcon size={24} color="var(--toxic)" /> },
              { n: '4', label: 'REVEAL', icon: <SkullIcon size={24} color="var(--pumpkin)" /> },
            ].map((step) => (
              <div key={step.n} style={{ textAlign: 'center', padding: '12px 6px', border: '2px solid var(--ash)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div>{step.icon}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ash)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {step.n}. {step.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
