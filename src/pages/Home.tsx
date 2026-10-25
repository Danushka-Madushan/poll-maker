import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Trash2, Tv } from 'lucide-react';
import BatsAnimation from '../components/ui/BatsAnimation';
import ConfirmModal from '../components/ui/ConfirmModal';
import { PumpkinIcon, BatIcon, CandleIcon, SkullIcon } from '../components/ui/HalloweenIcons';
import { useToast } from '../components/ui/ToastContext';
import { purgePoll, purgeAllRecentPolls } from '../firebase/pollService';
import { getRecentPolls } from '../utils/device';
import type { RecentPoll } from '../utils/device';

/** Sharp zig-zag jagged teeth edge (Design Guide §5.5) */
const JaggedTeethEdge: React.FC<{ color: string; bg?: string; flip?: boolean; height?: number }> = ({
  color,
  bg = 'transparent',
  flip = false,
  height = 8,
}) => (
  <div
    style={{
      width: '100%',
      height,
      backgroundColor: bg,
      backgroundImage: `linear-gradient(135deg, ${color} 25%, transparent 25%), linear-gradient(225deg, ${color} 25%, transparent 25%)`,
      backgroundSize: `${height * 2}px ${height}px`,
      backgroundRepeat: 'repeat-x',
      transform: flip ? 'scaleY(-1)' : undefined,
      flexShrink: 0,
    }}
  />
);

/** Home screen - host entry point (Design Guide §4.1) */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [recent, setRecent] = useState<RecentPoll[]>(() => getRecentPolls());
  const [resumeCode, setResumeCode] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleResume = (poll: RecentPoll) => {
    navigate(`/host/${poll.pollId}?token=${poll.hostToken}`);
  };

  const handleResumeCode = () => {
    const trimmed = resumeCode.trim();
    if (!trimmed) return;
    // Support full URLs, pollId?token=..., or raw pollId
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        navigate(url.pathname + url.search);
        return;
      }
    } catch {
      // Fallback to string split below
    }
    const parts = trimmed.split('?token=');
    if (parts.length === 2) {
      navigate(`/host/${parts[0]}?token=${parts[1]}`);
    } else {
      navigate(`/host/${trimmed}`);
    }
  };

  const handlePurgeOne = (e: React.MouseEvent, poll: RecentPoll) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: `PURGE "${poll.title.toUpperCase()}"?`,
      message:
        'This will permanently destroy this poll, all options, and all cast votes from Cloud Firestore and this device. This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await purgePoll(poll.pollId, poll.hostToken);
          setRecent((prev) => prev.filter((p) => p.pollId !== poll.pollId));
          addToast({ message: 'Poll permanently purged from existence.' });
        } catch (err) {
          addToast({ message: `Purge failed: ${(err as Error).message}` });
        }
      },
    });
  };

  const handlePurgeAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'PURGE ALL PAST POLLS?',
      message:
        'This will permanently destroy all past polls, options, and ballots from Cloud Firestore and this device. This cannot be undone.',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await purgeAllRecentPolls();
          setRecent([]);
          addToast({ message: 'All past polls permanently purged.' });
        } catch (err) {
          addToast({ message: `Purge all failed: ${(err as Error).message}` });
        }
      },
    });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--void)',
      }}
    >
      {/* Subtle 5% Halftone Pattern Backdrop (Design Guide §5.5) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(var(--bone) 1.5px, transparent 1.5px)',
          backgroundSize: '18px 18px',
          opacity: 0.05,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Ambient Floating Bats (§5.5 - Permitted on Home & Result screens) */}
      <BatsAnimation />

      {/* Top Architectural Hazard Header Bar */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
        <div className="hazard-stripes" style={{ height: 12, width: '100%' }} />
        <div
          style={{
            background: 'var(--ink)',
            borderBottom: '3px solid var(--bone)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span className="blink-dot" style={{ width: 10, height: 10, background: 'var(--pumpkin)', flexShrink: 0 }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(10px, 2.5vw, 12px)',
                color: 'var(--bone)',
                letterSpacing: '0.12em',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              HALLOWEEN LIVE POLLING SYSTEM
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-micro"
              onClick={() => navigate('/display')}
              style={{
                borderColor: 'var(--pumpkin)',
                color: 'var(--pumpkin)',
                background: 'var(--void)',
                gap: 5,
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Launch Big Screen TV display"
              aria-label="Launch Big Screen TV display"
            >
              <Tv size={12} /> BIG SCREEN
            </button>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(9px, 2.2vw, 11px)',
                color: 'var(--ash)',
                letterSpacing: '0.1em',
                whiteSpace: 'nowrap',
              }}
            >
              NO SIGN-UP · INSTANT QR
            </span>
          </div>
        </div>
        <JaggedTeethEdge color="var(--bone)" height={7} />
      </div>

      {/* Main Single-Screen Center Stage */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px 16px',
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 540,
          margin: '0 auto',
          gap: 28,
        }}
      >
        {/* Wordmark + Geometric Emblem Block */}
        <div style={{ textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Framed Brutalist Jack-O'-Lantern Emblem */}
          <div
            style={{
              width: 84,
              height: 84,
              background: 'var(--ink)',
              border: '3px solid var(--bone)',
              boxShadow: '6px 6px 0 var(--pumpkin)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <svg width="60" height="60" viewBox="0 0 80 80" fill="none" aria-hidden="true">
              {/* Pumpkin body (sharp octagon) */}
              <polygon
                points="22,14 58,14 70,26 70,58 58,70 22,70 10,58 10,26"
                fill="var(--pumpkin)"
                stroke="var(--void)"
                strokeWidth="4"
              />
              {/* Angular Eyes & Nose */}
              <polygon points="22,30 35,30 29,40" fill="var(--void)" />
              <polygon points="45,30 58,30 51,40" fill="var(--void)" />
              <polygon points="40,38 35,46 45,46" fill="var(--void)" />
              {/* Jagged Grin */}
              <polygon
                points="20,52 28,58 34,52 40,58 46,52 52,58 60,52 56,63 24,63"
                fill="var(--void)"
              />
              {/* Stem */}
              <polygon points="35,4 45,4 43,14 37,14" fill="var(--bone)" />
            </svg>
          </div>

          {/* Display Wordmark */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(44px, 9vw, 76px)',
              color: 'var(--bone)',
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              lineHeight: 0.9,
              margin: 0,
            }}
          >
            HALLOWEEN
            <br />
            <span style={{ color: 'var(--pumpkin)' }}>POLL</span>
          </h1>

          {/* One-line pitch inside a sharp offset tag (§4.1 & §9) */}
          <div
            style={{
              marginTop: 18,
              background: 'var(--ink)',
              border: '2px solid var(--bone)',
              boxShadow: '4px 4px 0 var(--bone)',
              padding: '6px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ width: 8, height: 8, background: 'var(--pumpkin)', display: 'inline-block' }} />
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 18,
                fontWeight: 500,
                color: 'var(--bone)',
                margin: 0,
              }}
            >
              Let the room decide who’s scariest.
            </p>
            <span style={{ width: 8, height: 8, background: 'var(--pumpkin)', display: 'inline-block' }} />
          </div>
        </div>

        {/* Primary CTA Button (§5.6) */}
        <div style={{ width: '100%' }}>
          <button
            className="btn-primary"
            style={{
              fontSize: 22,
              padding: '18px 32px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              letterSpacing: '0.04em',
            }}
            onClick={() => navigate('/create')}
          >
            <Plus size={24} strokeWidth={3} /> CREATE A POLL
          </button>
        </div>

        {/* Secondary Panel: Resume Host Link & Recent Polls (§4.1) */}
        <div
          style={{
            width: '100%',
            background: 'var(--ink)',
            border: '3px solid var(--bone)',
            boxShadow: '6px 6px 0 var(--bone)',
            overflow: 'hidden',
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              background: 'var(--bone)',
              color: 'var(--void)',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              HAVE A HOST LINK? RESUME
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              HOST COCKPIT
            </span>
          </div>
          <JaggedTeethEdge color="var(--bone)" height={6} />

          <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Input + GO Row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                className="input"
                placeholder="Paste host link or poll ID…"
                value={resumeCode}
                onChange={(e) => setResumeCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleResumeCode();
                }}
                style={{ flex: 1, minHeight: 46 }}
              />
              <button
                className="btn-secondary"
                onClick={handleResumeCode}
                style={{
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 18px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                  minHeight: 46,
                }}
              >
                RESUME <ArrowRight size={16} />
              </button>
            </div>

            {/* Recent Polls Stored on Device */}
            {recent.length > 0 && (
              <div style={{ borderTop: '2px dashed var(--ash)', paddingTop: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--pumpkin)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontWeight: 700,
                    }}
                  >
                    RECENT POLLS ({recent.length})
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={handlePurgeAll}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      border: '2px solid var(--blood)',
                      color: 'var(--blood)',
                      background: 'var(--void)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Purge all past polls from Firestore and device"
                  >
                    <Trash2 size={12} /> PURGE ALL
                  </button>
                </div>

                <div
                  className="no-scrollbar"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    maxHeight: 168,
                    overflowY: 'auto',
                  }}
                >
                  {recent.map((poll) => (
                    <div
                      key={poll.pollId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'var(--void)',
                        border: '2px solid var(--bone)',
                        padding: '6px 8px',
                      }}
                    >
                      <button
                        className="btn-ghost"
                        onClick={() => handleResume(poll)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          border: 'none',
                          padding: '4px 6px',
                          background: 'transparent',
                          color: 'var(--bone)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                        title="Resume as host"
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            background: 'var(--toxic)',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-display)',
                            fontSize: 15,
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {poll.title}
                        </span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: 11,
                            color: 'var(--ash)',
                            fontFamily: 'var(--font-mono)',
                            paddingLeft: 8,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {new Date(poll.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        className="btn-micro"
                        onClick={(e) => handlePurgeOne(e, poll)}
                        style={{
                          borderColor: 'var(--blood)',
                          color: 'var(--blood)',
                          background: 'var(--ink)',
                          flexShrink: 0,
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
        </div>

        {/* "How it works" 4-Step Strip: 1 Create → 2 Scan → 3 Vote → 4 Reveal (§4.1) */}
        <div style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div style={{ height: 2, flex: 1, background: 'var(--ash)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--pumpkin)',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                fontWeight: 700,
              }}
            >
              HOW THE RITUAL WORKS
            </span>
            <div style={{ height: 2, flex: 1, background: 'var(--ash)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { n: '01', label: 'CREATE', accent: 'var(--pumpkin)', icon: <PumpkinIcon size={28} color="var(--pumpkin)" /> },
              { n: '02', label: 'SCAN', accent: 'var(--bone)', icon: <BatIcon size={30} color="var(--bone)" /> },
              { n: '03', label: 'VOTE', accent: 'var(--toxic)', icon: <CandleIcon size={28} color="var(--toxic)" /> },
              { n: '04', label: 'REVEAL', accent: 'var(--pumpkin)', icon: <SkullIcon size={28} color="var(--pumpkin)" /> },
            ].map((step) => (
              <div
                key={step.n}
                style={{
                  position: 'relative',
                  background: 'var(--ink)',
                  border: '3px solid var(--bone)',
                  boxShadow: `4px 4px 0 ${step.accent}`,
                  padding: '22px 6px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 108,
                  textAlign: 'center',
                }}
              >
                {/* Solid Top-Left Step Chip */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    background: step.accent,
                    color: 'var(--void)',
                    borderRight: '2px solid var(--void)',
                    borderBottom: '2px solid var(--void)',
                    padding: '1px 7px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {step.n}
                </div>

                <div
                  style={{
                    width: 42,
                    height: 42,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {step.icon}
                </div>

                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    color: 'var(--bone)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginTop: 6,
                  }}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Hazard Strip Footer */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
        <div className="hazard-stripes" style={{ height: 10, width: '100%' }} />
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel="PURGE"
        cancelLabel="CANCEL"
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default Home;
