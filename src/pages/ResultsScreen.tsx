import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RotateCcw, Download, FileImage, Plus, Check } from 'lucide-react';
import BatsAnimation from '../components/ui/BatsAnimation';
import { PumpkinIcon, SkullIcon, GhostIcon, CandleIcon, BatIcon } from '../components/ui/HalloweenIcons';
import {
  subscribeToPoll,
  subscribeToOptions,
  subscribeToParticipants,
  subscribeToVotes,
  computeResults,
  exportResultsCSV,
  getMyVote,
} from '../firebase/pollService';
import { exportResultPNG } from '../utils/canvasExport';
import type { Poll, PollOption, Participant, Vote } from '../types/poll';
import { getDeviceToken } from '../utils/device';
import { playCreak, playSting, playTick } from '../utils/audio';

/** Straight-line geometric crown SVG (Design Guide §5.5) */
const GeometricCrownSVG: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = 'currentColor',
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <polygon points="2,19 2,6 7,12 12,4 17,12 22,6 22,19" />
    <rect x="2" y="20" width="20" height="3" />
  </svg>
);

/** Sharp zig-zag jagged teeth edge (Design Guide §5.5) */
const JaggedTeethEdge: React.FC<{ color: string; bg?: string; flip?: boolean; height?: number }> = ({
  color,
  bg = 'transparent',
  flip = false,
  height = 7,
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

const ResultsScreen: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const deviceToken = getDeviceToken();

  const [poll, setPoll] = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [myVoteIds, setMyVoteIds] = useState<string[]>([]);
  const [revealStep, setRevealStep] = useState(-1);
  const hasStartedReveal = useRef(false);

  useEffect(() => {
    if (!pollId) return;
    const u1 = subscribeToPoll(pollId, setPoll);
    const u2 = subscribeToOptions(pollId, setOptions);
    const u3 = subscribeToParticipants(pollId, setParticipants);
    const u4 = subscribeToVotes(pollId, setVotes);
    getMyVote(pollId, deviceToken).then((v) => setMyVoteIds(v?.optionIds ?? []));
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [pollId, deviceToken]);

  const result = useMemo(() => {
    if (options.length === 0) return null;
    return computeResults(votes, options, participants.length, poll?.decidedWinnerId);
  }, [votes, options, participants.length, poll?.decidedWinnerId]);

  // Auto-start reveal sequence once results are loaded
  useEffect(() => {
    if (result && !hasStartedReveal.current && poll?.status === 'revealed') {
      hasStartedReveal.current = true;
      const isReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!isReduced) playCreak();
      setRevealStep(isReduced ? 999 : 0);
    }
  }, [result, poll?.status]);

  // Reveal animation sequence (last place upward, winner slams in last — §4.7)
  useEffect(() => {
    if (revealStep < 0 || revealStep >= 999 || !result) return;

    const totalSteps = result.tallies.length + 1;
    if (revealStep < totalSteps) {
      if (revealStep > 0) playTick();
      const t = setTimeout(() => setRevealStep((s) => s + 1), revealStep === 0 ? 1500 : 850);
      return () => clearTimeout(t);
    }
    if (revealStep === totalSteps) {
      setTimeout(() => playSting(), 200);
    }
  }, [revealStep, result]);

  if (!pollId) return null;

  const replayReveal = () => {
    hasStartedReveal.current = false;
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isReduced) playCreak();
    setRevealStep(isReduced ? 999 : 0);
  };

  // Subtle 5% Halftone Pattern Backdrop (Design Guide §5.5)
  const halftoneBackdrop = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'radial-gradient(var(--bone) 1.5px, transparent 1.5px)',
        backgroundSize: '18px 18px',
        opacity: 0.05,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );

  if (!poll || !result || !options.length) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--void)',
          position: 'relative',
        }}
      >
        {halftoneBackdrop}
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', fontSize: 20 }}>
          SUMMONING FINAL TALLIES…
        </p>
      </div>
    );
  }

  if (poll.status !== 'revealed') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'var(--void)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {halftoneBackdrop}
        <div className="hazard-stripes" style={{ height: 10, width: '100%' }} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              border: '4px solid var(--bone)',
              background: 'var(--ink)',
              maxWidth: 420,
              width: '100%',
              boxShadow: '8px 8px 0 var(--bone)',
              overflow: 'hidden',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                background: 'var(--bone)',
                color: 'var(--void)',
                padding: '8px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.12em',
              }}
            >
              SEALED BY THE HOST
            </div>
            <JaggedTeethEdge color="var(--bone)" height={7} />
            <div style={{ padding: '28px 24px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <SkullIcon size={48} color="var(--pumpkin)" />
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  color: 'var(--bone)',
                  margin: '0 0 12px',
                  textTransform: 'uppercase',
                }}
              >
                RESULTS NOT YET REVEALED
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ash)', margin: 0 }}>
                The host hasn’t lifted the veil yet. Stay tuned.
              </p>
            </div>
          </div>
        </div>
        <div className="hazard-stripes" style={{ height: 10, width: '100%' }} />
      </div>
    );
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sortedAsc = [...result.tallies].reverse();
  const visibleCount = reducedMotion ? sortedAsc.length : Math.max(0, revealStep - 1);
  const winnerVisible = reducedMotion || revealStep > result.tallies.length;

  // Displayed list: once revealed, show in natural rank order (#1 first) or keep bottom-up build
  const visibleTallies = [...sortedAsc.slice(0, visibleCount)].reverse();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--void)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {halftoneBackdrop}
      <BatsAnimation />

      {/* Reveal Step 0 — Fullscreen Black Cut ("AND THE WINNER IS…" — §4.7) */}
      {!reducedMotion && revealStep === 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--void)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            zIndex: 100,
            padding: 24,
          }}
        >
          <div className="hazard-stripes" style={{ height: 16, width: '100%', maxWidth: 600 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <PumpkinIcon size={44} color="var(--pumpkin)" />
            <BatIcon size={44} color="var(--bone)" />
            <PumpkinIcon size={44} color="var(--pumpkin)" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(40px, 8vw, 88px)',
              color: 'var(--bone)',
              textAlign: 'center',
              lineHeight: 0.92,
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            AND THE
            <br />
            <span style={{ color: 'var(--pumpkin)' }}>WINNER IS…</span>
          </h1>
          <div className="hazard-stripes" style={{ height: 16, width: '100%', maxWidth: 600 }} />
        </div>
      )}

      {/* Top Sticky Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20 }}>
        <div className="hazard-stripes" style={{ height: 6, width: '100%' }} />
        <div
          style={{
            borderBottom: '3px solid var(--bone)',
            background: 'var(--ink)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 200px' }}>
            <PumpkinIcon size={24} color="var(--pumpkin)" />
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--pumpkin)',
                  letterSpacing: '0.14em',
                  fontWeight: 700,
                }}
              >
                FINAL STANDINGS
              </span>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(18px, 3.5vw, 26px)',
                  color: 'var(--bone)',
                  margin: 0,
                  textTransform: 'uppercase',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {poll.title}
              </h1>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="results-header-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              onClick={replayReveal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                height: 36,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                background: 'var(--void)',
                border: '2px solid var(--bone)',
              }}
            >
              <RotateCcw size={14} /> REPLAY
            </button>
            <button
              className="btn-ghost"
              onClick={() => exportResultsCSV({ ...poll, options } as Poll, result)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                height: 36,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                background: 'var(--void)',
                border: '2px solid var(--bone)',
              }}
            >
              <Download size={14} /> CSV
            </button>
            <button
              className="btn-ghost"
              onClick={() => exportResultPNG({ ...poll, options } as Poll, result)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                height: 36,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                background: 'var(--void)',
                border: '2px solid var(--bone)',
              }}
            >
              <FileImage size={14} /> PNG CARD
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                height: 36,
                fontSize: 13,
              }}
            >
              <Plus size={15} /> NEW POLL
            </button>
          </div>
        </div>
        <JaggedTeethEdge color="var(--bone)" height={6} />
      </header>

      {/* Main Content Container */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 760,
          margin: '0 auto',
          padding: '20px 16px 40px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Zero Votes Edge Case (§4.7 & §9) */}
        {result.totalVotes === 0 ? (
          <div
            style={{
              border: '4px solid var(--pumpkin)',
              background: 'var(--ink)',
              boxShadow: '8px 8px 0 var(--pumpkin)',
              padding: '48px 24px',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <GhostIcon size={56} color="var(--pumpkin)" />
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(32px, 6vw, 56px)',
                color: 'var(--pumpkin)',
                margin: '0 0 12px',
                lineHeight: 0.95,
              }}
            >
              NOBODY VOTED. SPOOKY.
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                color: 'var(--ash)',
                marginBottom: 28,
              }}
            >
              THE DEAD REMAIN SILENT.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}
            >
              <Plus size={18} /> CREATE NEW POLL
            </button>
          </div>
        ) : (
          <>
            {/* Suspense Banner while counting up toward the Winner */}
            {!winnerVisible && (
              <div
                style={{
                  border: '3px dashed var(--pumpkin)',
                  background: 'var(--ink)',
                  boxShadow: '6px 6px 0 var(--pumpkin)',
                  padding: '20px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <SkullIcon size={36} color="var(--pumpkin)" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="blink-dot" style={{ background: 'var(--pumpkin)' }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: 'var(--pumpkin)',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                    }}
                  >
                    UNMASKING THE WINNER…
                  </span>
                </div>
              </div>
            )}

            {/* ================= WINNER HERO ALTAR BLOCK (§4.7) ================= */}
            {winnerVisible && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {result.isTie && (
                  <div
                    style={{
                      border: '3px solid var(--witch)',
                      background: 'var(--ink)',
                      boxShadow: '5px 5px 0 var(--witch)',
                      padding: '10px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 20,
                        color: 'var(--bone)',
                        margin: 0,
                        letterSpacing: '0.04em',
                      }}
                    >
                      A TIE. THE DEAD CANNOT DECIDE.
                    </p>
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      result.winners.length > 1
                        ? 'repeat(auto-fit, minmax(260px, 1fr))'
                        : '1fr',
                    gap: 20,
                  }}
                >
                  {result.winners.map((wId) => {
                    const opt = options.find((o) => o.id === wId);
                    const tally = result.tallies.find((t) => t.optionId === wId);
                    const isMine = myVoteIds.includes(wId);
                    if (!opt || !tally) return null;

                    return (
                      <div
                        key={wId}
                        style={{
                          background: 'var(--ink)',
                          border: '4px solid var(--pumpkin)',
                          boxShadow: '8px 8px 0 var(--pumpkin)',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Full-Width Orange Winner Banner (Void text on Pumpkin — §4.7 & §5.2) */}
                        <div
                          style={{
                            background: 'var(--pumpkin)',
                            color: 'var(--void)',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(18px, 3vw, 24px)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          <GeometricCrownSVG size={22} color="var(--void)" />
                          <span>{result.isTie ? 'TIE · CO-WINNER' : '1ST PLACE · WINNER'}</span>
                          <GeometricCrownSVG size={22} color="var(--void)" />
                        </div>
                        <JaggedTeethEdge color="var(--pumpkin)" height={8} />

                        {/* Winner Body: Portrait + Identity + Tally */}
                        <div
                          style={{
                            padding: '20px 20px 22px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 14,
                            textAlign: 'center',
                          }}
                        >
                          {/* Chamfered Portrait with Solid Corner Label Chip */}
                          <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <div
                              className="chamfer-frame-lg"
                              style={{
                                width: 'clamp(160px, 42vw, 220px)',
                                height: 'clamp(160px, 42vw, 220px)',
                                border: '4px solid var(--pumpkin)',
                                background: 'var(--void)',
                                boxShadow: '6px 6px 0 var(--pumpkin)',
                                overflow: 'hidden',
                              }}
                            >
                              <img
                                src={opt.imageUrl}
                                alt={opt.title}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                            </div>
                            {/* Top-Left Option Label Badge */}
                            <div
                              style={{
                                position: 'absolute',
                                top: -5,
                                left: -5,
                                background: 'var(--pumpkin)',
                                color: 'var(--void)',
                                border: '3px solid var(--void)',
                                padding: '2px 10px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: 15,
                                fontWeight: 900,
                                zIndex: 2,
                              }}
                            >
                              {opt.label}
                            </div>
                          </div>

                          {/* Title & Contestant Tag */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <h2
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 'clamp(26px, 5vw, 38px)',
                                color: 'var(--bone)',
                                margin: 0,
                                textTransform: 'uppercase',
                                lineHeight: 1,
                              }}
                            >
                              {opt.title}
                            </h2>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                              <span
                                style={{
                                  background: 'var(--void)',
                                  border: '2px solid var(--pumpkin)',
                                  padding: '3px 12px',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 12,
                                  color: 'var(--pumpkin)',
                                  fontWeight: 700,
                                  letterSpacing: '0.1em',
                                }}
                              >
                                CONTESTANT {opt.label}
                              </span>

                              {isMine && (
                                <span
                                  style={{
                                    background: 'var(--toxic)',
                                    color: 'var(--void)',
                                    border: '2px solid var(--void)',
                                    boxShadow: '3px 3px 0 var(--bone)',
                                    padding: '3px 10px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 12,
                                    fontWeight: 900,
                                    letterSpacing: '0.08em',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <Check size={14} strokeWidth={3.5} /> YOUR PICK
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="hazard-stripes" style={{ height: 8, width: '100%', marginTop: 2 }} />

                          {/* High-Contrast Toxic Vote Tally Box */}
                          <div
                            style={{
                              background: 'var(--void)',
                              border: '3px solid var(--toxic)',
                              boxShadow: '4px 4px 0 var(--toxic)',
                              padding: '8px 18px',
                              width: '100%',
                              maxWidth: 320,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'clamp(18px, 4vw, 24px)',
                                color: 'var(--toxic)',
                                fontWeight: 900,
                              }}
                            >
                              {tally.count} VOTES ({tally.percentage}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ================= FULL RANKINGS LIST (§4.7 & §5.6) ================= */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '2px solid var(--ash)',
                  paddingBottom: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CandleIcon size={18} color="var(--pumpkin)" />
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 18,
                      color: 'var(--bone)',
                      margin: 0,
                      letterSpacing: '0.04em',
                    }}
                  >
                    FULL RANKINGS
                  </h2>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ash)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {result.totalVotes} TOTAL VOTES
                </span>
              </div>

              {visibleTallies.map((tally) => {
                const opt = options.find((o) => o.id === tally.optionId);
                const rankIndex = result.tallies.findIndex((t) => t.optionId === tally.optionId) + 1;
                const isWinner = result.winners.includes(tally.optionId);
                const isMyVote = myVoteIds.includes(tally.optionId);
                const accentColor = isWinner ? 'var(--pumpkin)' : 'var(--bone)';

                return (
                  <div
                    key={tally.optionId}
                    style={{
                      background: 'var(--ink)',
                      border: `3px solid ${accentColor}`,
                      boxShadow: `4px 4px 0 ${isWinner ? 'var(--pumpkin)' : 'var(--ash)'}`,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {/* Top Row: Rank + Avatar + Label/Title + Vote Count */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        {/* Rank Number Chip */}
                        <span
                          style={{
                            background: isWinner ? 'var(--pumpkin)' : 'var(--void)',
                            color: isWinner ? 'var(--void)' : 'var(--bone)',
                            border: `2px solid ${accentColor}`,
                            padding: '2px 6px',
                            minWidth: 36,
                            textAlign: 'center',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 13,
                            fontWeight: 900,
                            flexShrink: 0,
                          }}
                        >
                          #{rankIndex}
                        </span>

                        {/* Mini Square Thumbnail */}
                        {opt?.imageUrl && (
                          <img
                            src={opt.imageUrl}
                            alt={opt.title}
                            style={{
                              width: 36,
                              height: 36,
                              objectFit: 'cover',
                              border: `2px solid ${accentColor}`,
                              flexShrink: 0,
                            }}
                          />
                        )}

                        {/* Option Label & Title (Always on dark --ink, 100% legible) */}
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(15px, 3.5vw, 19px)',
                            color: 'var(--bone)',
                            textTransform: 'uppercase',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt?.label} — {opt?.title}
                        </span>

                        {/* Voter's Own Pick Badge */}
                        {isMyVote && (
                          <span
                            style={{
                              background: 'var(--toxic)',
                              color: 'var(--void)',
                              padding: '1px 6px',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              fontWeight: 900,
                              letterSpacing: '0.06em',
                              flexShrink: 0,
                            }}
                          >
                            YOUR PICK
                          </span>
                        )}
                      </div>

                      {/* Right: Votes & Percentage */}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'clamp(13px, 3vw, 16px)',
                          color: isWinner ? 'var(--pumpkin)' : 'var(--bone)',
                          fontWeight: 900,
                          whiteSpace: 'nowrap',
                          minWidth: 92,
                          textAlign: 'right',
                          flexShrink: 0,
                        }}
                      >
                        {tally.count}V ({tally.percentage}%)
                      </span>
                    </div>

                    {/* Dedicated Flat Progress Bar Track (Never overlaps text) */}
                    <div
                      style={{
                        width: '100%',
                        height: 12,
                        background: 'var(--void)',
                        border: `2px solid ${accentColor}`,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${tally.percentage}%`,
                          height: '100%',
                          background: isWinner ? 'var(--pumpkin)' : 'var(--bone)',
                          transition: 'width 600ms linear',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </section>

            {/* ================= FOOTER STATS GRID (§4.7) ================= */}
            {winnerVisible && (
              <section
                className="results-stats-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  paddingTop: 8,
                }}
              >
                {[
                  { label: 'TOTAL VOTES', value: result.totalVotes, accent: 'var(--pumpkin)' },
                  { label: 'PARTICIPANTS', value: result.totalParticipants, accent: 'var(--bone)' },
                  { label: 'TURNOUT', value: `${result.turnoutPercentage}%`, accent: 'var(--toxic)' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: 'var(--ink)',
                      border: `3px solid ${stat.accent}`,
                      boxShadow: `4px 4px 0 ${stat.accent}`,
                      padding: '12px 10px',
                      textAlign: 'center',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--ash)',
                        margin: '0 0 4px',
                        letterSpacing: '0.1em',
                        fontWeight: 700,
                      }}
                    >
                      {stat.label}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(22px, 5vw, 32px)',
                        color: stat.accent,
                        margin: 0,
                        lineHeight: 1,
                      }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ResultsScreen;
