import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Minimize2, Volume2, VolumeX, Tv, ArrowRight, AlertTriangle } from 'lucide-react';
import BatsAnimation from '../components/ui/BatsAnimation';
import {
  subscribeToPoll,
  subscribeToOptions,
  subscribeToParticipants,
  subscribeToVotes,
  computeResults,
  resolvePollId,
} from '../firebase/pollService';
import type { Poll, PollOption, Participant, Vote } from '../types/poll';
import { playCreak, playSting, playTick, isMuted, toggleMuted } from '../utils/audio';
import { formatJoinCode } from '../utils/code';

/* ============================================================================
   FLAT GEOMETRIC HALLOWEEN SVG MOTIFS (Design Guide §5.5 - Straight-line SVG)
   ============================================================================ */

const GeometricCrownSVG: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <polygon points="2,19 2,6 7,12 12,4 17,12 22,6 22,19" />
    <rect x="2" y="20" width="20" height="3" />
  </svg>
);

const GeometricSkullSVG: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <polygon points="6,2 18,2 22,6 22,15 18,17 18,22 15,22 15,18 13,18 13,22 11,22 11,18 9,18 9,22 6,22 6,17 2,15 2,6" />
    <polygon points="6,9 10,9 10,13 6,13" fill="var(--void)" />
    <polygon points="14,9 18,9 18,13 14,13" fill="var(--void)" />
    <polygon points="12,13 10.5,16 13.5,16" fill="var(--void)" />
  </svg>
);

const GeometricPumpkinSVG: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <polygon points="10,1 14,1 13,5 11,5" />
    <polygon points="6,5 18,5 22,9 22,18 18,22 6,22 2,18 2,9" />
    <polygon points="6,10 10,10 8,14" fill="var(--void)" />
    <polygon points="14,10 18,10 16,14" fill="var(--void)" />
    <polygon points="12,13 10.5,15.5 13.5,15.5" fill="var(--void)" />
    <polygon points="5,17 8,19 10,17 12,19 14,17 16,19 19,17 17,20 7,20" fill="var(--void)" />
  </svg>
);

const GeometricBatSVG: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 32 16" fill={color} style={{ flexShrink: 0 }}>
    <polygon points="0,2 10,6 13,2 14,5 16,4 18,5 19,2 22,6 32,2 28,11 23,9 20,14 16,11 12,14 9,9 4,11" />
  </svg>
);

const GeometricGhostSVG: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <polygon points="5,2 19,2 21,5 21,22 18,18 15,22 12,18 9,22 6,18 3,22 3,5" />
    <rect x="7" y="8" width="3" height="4" fill="var(--void)" />
    <rect x="14" y="8" width="3" height="4" fill="var(--void)" />
  </svg>
);

const GeometricCandleSVG: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <polygon points="12,1 15,6 12,9 9,6" fill="var(--pumpkin)" />
    <rect x="11" y="9" width="2" height="2" />
    <polygon points="7,11 17,11 17,23 7,23" />
    <polygon points="7,13 11,13 11,17 9,19 7,17" fill="var(--void)" />
  </svg>
);

/** Sharp zig-zag jagged teeth edge (§5.5) */
const JaggedTeethEdge: React.FC<{ color: string; bg?: string; flip?: boolean; height?: number }> = ({
  color,
  bg = 'transparent',
  flip = false,
  height = 10,
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

/** Segmented flat brutalist progress bar (§5.6) */
const SegmentedVoteBar: React.FC<{ percentage: number; fillColor: string; borderColor: string }> = ({
  percentage,
  fillColor,
  borderColor,
}) => {
  const totalTicks = 12;
  const activeTicks = Math.round((Math.min(100, Math.max(0, percentage)) / 100) * totalTicks);
  return (
    <div
      style={{
        width: '100%',
        height: 12,
        background: 'var(--void)',
        border: `2px solid ${borderColor}`,
        display: 'grid',
        gridTemplateColumns: `repeat(${totalTicks}, 1fr)`,
        gap: 2,
        padding: 2,
      }}
    >
      {Array.from({ length: totalTicks }).map((_, i) => (
        <div
          key={i}
          style={{
            background: i < activeTicks ? fillColor : 'transparent',
            height: '100%',
          }}
        />
      ))}
    </div>
  );
};

/** Big Screen display - responsive across 16:9, 16:10, 4:3, and non-standard Smartboards */
const BigScreen: React.FC = () => {
  const { pollId: routeParam } = useParams<{ pollId?: string }>();
  const navigate = useNavigate();
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<boolean>(Boolean(routeParam));
  const [inputCode, setInputCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [poll, setPoll] = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [revealStep, setRevealStep] = useState(-1); // -1 = not started, 0 = black, 1+ = animating
  const [isFullscreen, setIsFullscreen] = useState(
    Boolean(typeof document !== 'undefined' && document.fullscreenElement)
  );
  const [muted, setMutedState] = useState(isMuted());
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1920,
    h: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });
  const [transitionOverlay, setTransitionOverlay] = useState<{
    title: string;
    subtitle: string;
    accent: string;
  } | null>(null);
  const prevStatus = useRef<string>('');

  const joinUrl = `${window.location.origin}/join/${poll?.joinCode ?? ''}`;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleAudio = () => {
    const m = toggleMuted();
    setMutedState(m);
  };

  // Track smartboard viewport dimensions dynamically so QR code and squares always fit
  useEffect(() => {
    const handleResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Resolve code or ID when route param changes
  useEffect(() => {
    let isCancelled = false;
    if (!routeParam) return;

    void (async () => {
      try {
        const canonicalId = await resolvePollId(routeParam);
        if (isCancelled) return;
        if (canonicalId) {
          setActivePollId(canonicalId);
          setErrorMessage('');
        } else {
          setActivePollId(null);
          setErrorMessage(`NO ACTIVE POLL FOUND FOR "${routeParam.toUpperCase()}".`);
        }
      } catch {
        if (isCancelled) return;
        setActivePollId(null);
        setErrorMessage('ERROR CONNECTING TO THE CRYPT.');
      } finally {
        if (!isCancelled) setResolving(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [routeParam]);

  const handleLaunchByCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let clean = inputCode.trim();
    if (!clean) return;

    if (clean.includes('/')) {
      const parts = clean.split('/').filter(Boolean);
      clean = parts.pop()?.split('?')[0] ?? clean;
    }

    setResolving(true);
    setErrorMessage('');
    try {
      const canonicalId = await resolvePollId(clean);
      if (canonicalId) {
        setPoll(null);
        setOptions([]);
        setParticipants([]);
        setVotes([]);
        setActivePollId(canonicalId);
        navigate(`/display/${clean.toUpperCase()}`, { replace: true });
      } else {
        setErrorMessage(`NO ACTIVE POLL FOUND FOR CODE "${clean.toUpperCase()}".`);
      }
    } catch {
      setErrorMessage('FAILED TO RESOLVE JOIN CODE.');
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && document.activeElement?.tagName !== 'INPUT') {
        toggleFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Compute results
  const result = useMemo(() => {
    if (options.length === 0) return null;
    return computeResults(
      votes,
      options,
      participants.length,
      poll?.decidedWinnerId,
      poll?.specialVotes,
      poll?.settings.specialVoteWeight ?? 5,
      poll?.settings.enableSpecialVotes ?? false
    );
  }, [votes, options, participants.length, poll?.decidedWinnerId, poll?.specialVotes, poll?.settings.specialVoteWeight, poll?.settings.enableSpecialVotes]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!activePollId) return;

    const u1 = subscribeToPoll(
      activePollId,
      (p) => {
        if (prevStatus.current) {
          if (prevStatus.current === 'lobby' && p.status === 'live') {
            setTransitionOverlay({
              title: 'THE HAUNT COMMENCES',
              subtitle: 'CAST YOUR HEXES · VOTING IS NOW LIVE',
              accent: 'var(--toxic)',
            });
            setTimeout(() => setTransitionOverlay(null), 1800);
          } else if (prevStatus.current === 'live' && (p.status === 'closed' || p.status === 'special_voting')) {
            setTransitionOverlay({
              title: p.status === 'special_voting' ? 'SPECIAL VOTES IN PROGRESS' : 'VOTING CONCLUDED',
              subtitle: p.status === 'special_voting' ? 'THE JURY IS CASTING THEIR BALLOTS…' : 'THE DEAD ARE COUNTING BALLOTS…',
              accent: p.status === 'special_voting' ? 'var(--witch)' : 'var(--blood)',
            });
            setTimeout(() => setTransitionOverlay(null), 1800);
          }
        }

        if (prevStatus.current !== 'revealed' && p.status === 'revealed') {
          const isReduced =
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (!isMuted() && !isReduced) {
            playCreak();
          }
          setRevealStep(isReduced ? 999 : 0);
        }
        prevStatus.current = p.status;
        setPoll(p);
      },
      undefined,
      () => {
        setActivePollId(null);
        setErrorMessage('POLL HAS BEEN TERMINATED.');
      }
    );
    const u2 = subscribeToOptions(activePollId, setOptions);
    const u3 = subscribeToParticipants(activePollId, setParticipants);
    const u4 = subscribeToVotes(activePollId, setVotes);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [activePollId]);

  // Reveal sequence: reveal 3rd place, then 2nd place, then Winner last
  useEffect(() => {
    if (revealStep < 0 || revealStep >= 999 || !result) return;

    const podiumSteps = Math.min(3, result.tallies.length);

    if (revealStep < podiumSteps) {
      if (!isMuted() && revealStep > 0) playTick();
      const delay = revealStep === 0 ? 1600 : 1200;
      const t = setTimeout(() => setRevealStep((s) => s + 1), delay);
      return () => clearTimeout(t);
    }

    if (revealStep === podiumSteps && !isMuted()) {
      setTimeout(() => playSting(), 200);
    }
  }, [revealStep, result]);

  // Halftone 5% background overlay per Design Guide §5.5 (uses top/right/bottom/left for legacy WebViews)
  const halftoneBackdrop = (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundImage: 'radial-gradient(var(--bone) 1.5px, transparent 1.5px)',
        backgroundSize: '18px 18px',
        opacity: 0.05,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );

  // Floating controls for standalone views (Lobby, Closed & Launcher)
  const floatingControls = (
    <div style={{ position: 'fixed', top: 16, right: 20, zIndex: 999, display: 'flex', gap: 8 }}>
      <button
        className="btn-ghost"
        onClick={toggleAudio}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        style={{
          background: 'var(--ink)',
          padding: '8px 12px',
          border: '3px solid var(--bone)',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <button
        className="btn-ghost"
        onClick={toggleFullscreen}
        title="Toggle Fullscreen (F)"
        style={{
          background: 'var(--ink)',
          padding: '8px 14px',
          border: '3px solid var(--bone)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        <span>{isFullscreen ? 'EXIT' : 'FULLSCREEN'}</span>
      </button>
    </div>
  );

  // If resolving code or doc ID
  if (resolving && !activePollId) {
    return (
      <div className="display-screen" style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {halftoneBackdrop}
        {floatingControls}
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--pumpkin)', fontSize: 28, letterSpacing: '0.12em', margin: 0 }}>
            SUMMONING THE CRYPT…
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', fontSize: 13, marginTop: 8 }}>
            RESOLVING POLL IDENTITY
          </p>
        </div>
      </div>
    );
  }

  // If no active poll ID (portal code entry launcher)
  if (!activePollId) {
    return (
      <div
        className="display-screen"
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: 24,
          minHeight: '100vh',
        }}
      >
        {halftoneBackdrop}
        <BatsAnimation />
        {floatingControls}

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 580,
            background: 'var(--ink)',
            border: '3px solid var(--bone)',
            boxShadow: '10px 10px 0 var(--pumpkin)',
          }}
        >
          <div className="hazard-stripes" style={{ height: 12, width: '100%' }} />

          <div style={{ padding: '36px 32px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  background: 'var(--void)',
                  border: '3px solid var(--bone)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '3px 3px 0 var(--pumpkin)',
                  flexShrink: 0,
                }}
              >
                <Tv size={28} color="var(--pumpkin)" />
              </div>
              <div>
                <h1
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(24px, 4vw, 32px)',
                    color: 'var(--bone)',
                    margin: 0,
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  BIG SCREEN TV PORTAL
                </h1>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--ash)',
                    margin: '6px 0 0',
                    letterSpacing: '0.08em',
                  }}
                >
                  CONNECT DISPLAY VIA 6-CHARACTER POLL CODE
                </p>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  background: 'var(--void)',
                  border: '2px solid var(--blood)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  margin: '20px 0',
                }}
              >
                <AlertTriangle size={18} color="var(--blood)" style={{ flexShrink: 0 }} />
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--blood)',
                    margin: 0,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {errorMessage}
                </p>
              </div>
            )}

            <form onSubmit={handleLaunchByCode} style={{ marginTop: errorMessage ? 12 : 24 }}>
              <label
                htmlFor="bigscreen-code-input"
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ash)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 8,
                }}
              >
                ENTER POLL JOIN CODE (E.G. BOO-482)
              </label>

              <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
                <input
                  id="bigscreen-code-input"
                  type="text"
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="BOO-482"
                  maxLength={120}
                  autoFocus
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'var(--void)',
                    border: '3px solid var(--bone)',
                    boxShadow: '4px 4px 0 var(--bone)',
                    padding: '16px 20px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'clamp(24px, 5vw, 36px)',
                    fontWeight: 700,
                    color: 'var(--pumpkin)',
                    letterSpacing: '0.2em',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    outline: 'none',
                  }}
                />

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!inputCode.trim() || resolving}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    letterSpacing: '0.08em',
                  }}
                >
                  <span>{resolving ? 'CONNECTING…' : 'LAUNCH BIG SCREEN'}</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            </form>

            <div
              style={{
                marginTop: 24,
                paddingTop: 18,
                borderTop: '2px solid var(--ash)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ash)',
                  letterSpacing: '0.06em',
                }}
              >
                TIP: PRESS [F] FOR FULLSCREEN
              </span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => navigate('/')}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                }}
              >
                RETURN HOME
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="display-screen" style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {halftoneBackdrop}
        {floatingControls}
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', fontSize: 28 }}>
          SUMMONING THE CRYPT…
        </p>
      </div>
    );
  }

  // Integrated controls cluster for header bars (Live & Revealed)
  const headerControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
      <button
        className="btn-ghost"
        onClick={toggleAudio}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        style={{
          background: 'var(--void)',
          padding: '8px 12px',
          border: '3px solid var(--bone)',
          boxShadow: '3px 3px 0 var(--bone)',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <button
        className="btn-ghost"
        onClick={toggleFullscreen}
        title="Toggle Fullscreen (F)"
        style={{
          background: 'var(--void)',
          padding: '8px 14px',
          border: '3px solid var(--bone)',
          boxShadow: '3px 3px 0 var(--bone)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        <span>{isFullscreen ? 'EXIT' : 'FULLSCREEN'}</span>
      </button>
    </div>
  );

  const transitionBanner = transitionOverlay && (
    <div className="stage-transition-overlay" style={{ border: `4px solid ${transitionOverlay.accent}` }}>
      <div className="hazard-stripes" style={{ height: 16, width: '100%', maxWidth: 700, marginBottom: 24 }} />
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 6vw, 84px)',
          color: transitionOverlay.accent,
          textAlign: 'center',
          lineHeight: 0.95,
          textTransform: 'uppercase',
        }}
      >
        {transitionOverlay.title}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(18px, 3vw, 32px)',
          color: 'var(--bone)',
          textAlign: 'center',
          marginTop: 18,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {transitionOverlay.subtitle}
      </p>
      <div className="hazard-stripes" style={{ height: 16, width: '100%', maxWidth: 700, marginTop: 24 }} />
    </div>
  );

  /* ---- LOBBY STATE (SMARTBOARD-SAFE FLEX LAYOUT — ZERO OVERLAP OR WRAPPING) ---- */
  if (poll.status === 'lobby') {
    // Dynamically calculate QR size so it fits both narrow/tall smartboards and widescreens
    const qrSize = Math.max(200, Math.min(viewport.w * 0.36, viewport.h * 0.56, 480));

    return (
      <div
        className="display-screen"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          padding: 0,
          gap: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {halftoneBackdrop}
        {floatingControls}
        {transitionBanner}

        {/* Top Main Split Area (Takes remaining height above the footer strip) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'row',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Left 48% - Giant QR */}
          <div
            style={{
              flex: '0 0 48%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'clamp(16px, 2.5vw, 40px)',
              borderRight: '4px solid var(--bone)',
              boxSizing: 'border-box',
            }}
          >
            <div
              className="qr-container"
              style={{
                padding: 'clamp(16px, 2vw, 28px)',
                background: 'var(--bone)',
                border: '4px solid var(--void)',
                boxShadow: '12px 12px 0 var(--pumpkin)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QRCodeSVG
                value={joinUrl}
                size={qrSize}
                level="M"
                bgColor="#F4EEDF"
                fgColor="#0D0B10"
              />
            </div>
          </div>

          {/* Right 52% - Poll Info, Single-Line Join Code & High-Contrast Link Box */}
          <div
            style={{
              flex: '0 0 52%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: 'clamp(20px, 3vw, 44px)',
              gap: 'clamp(12px, 2.2vh, 26px)',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <GeometricPumpkinSVG size={28} color="var(--pumpkin)" />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'clamp(14px, 1.4vw, 20px)',
                  color: 'var(--pumpkin)',
                  letterSpacing: '0.14em',
                  fontWeight: 700,
                }}
              >
                LIVE HALLOWEEN POLL
              </span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, min(4.2vw, 6.5vh), 72px)',
                color: 'var(--bone)',
                lineHeight: 0.94,
                textTransform: 'uppercase',
                margin: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {poll.title}
            </h1>

            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(22px, min(3vw, 4.8vh), 46px)',
                color: 'var(--pumpkin)',
                letterSpacing: '-0.01em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              SCAN TO VOTE. IF YOU DARE.
            </p>

            {/* Join Code & URL Section — Guaranteed Single-Line Code & High-Visibility URL */}
            <div
              style={{
                borderTop: '4px solid var(--bone)',
                paddingTop: 'clamp(12px, 2vh, 22px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(8px, 1.4vh, 14px)',
                minWidth: 0,
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'clamp(14px, 1.5vw, 22px)',
                    color: 'var(--ash)',
                    margin: '0 0 4px',
                    letterSpacing: '0.1em',
                    fontWeight: 700,
                  }}
                >
                  JOIN CODE
                </p>
                {/* Locked to 1 row (`whiteSpace: 'nowrap'`) so BOO-482 never splits! */}
                <div
                  style={{
                    display: 'inline-block',
                    background: 'var(--void)',
                    border: '3px solid var(--pumpkin)',
                    boxShadow: '6px 6px 0 var(--pumpkin)',
                    padding: '6px 20px',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'clamp(32px, min(4.6vw, 7.2vh), 78px)',
                      color: 'var(--bone)',
                      letterSpacing: '0.12em',
                      margin: 0,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      lineHeight: 1.05,
                    }}
                  >
                    {formatJoinCode(poll.joinCode)}
                  </p>
                </div>
              </div>

              {/* High-Contrast URL Banner — Always Visible Above Footer */}
              <div
                style={{
                  background: 'var(--ink)',
                  border: '2px solid var(--bone)',
                  boxShadow: '4px 4px 0 var(--bone)',
                  padding: '8px 14px',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--pumpkin)',
                    letterSpacing: '0.1em',
                    fontWeight: 700,
                    marginBottom: 2,
                  }}
                >
                  DIRECT LINK:
                </span>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'clamp(14px, min(1.8vw, 2.6vh), 24px)',
                    color: 'var(--bone)',
                    margin: 0,
                    fontWeight: 700,
                    wordBreak: 'break-all',
                    lineHeight: 1.2,
                  }}
                >
                  {joinUrl}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Flex Footer Strip — Never Overlaps Right Column Content */}
        <footer
          style={{
            flexShrink: 0,
            borderTop: '4px solid var(--bone)',
            background: 'var(--ink)',
            padding: '14px 36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="blink-dot" style={{ width: 16, height: 16, background: 'var(--toxic)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(22px, 2.8vw, 38px)',
                color: 'var(--toxic)',
                letterSpacing: '0.08em',
                fontWeight: 700,
              }}
            >
              {Math.max(participants.length, votes.length)} JOINED
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--bone)' }}>
            <GeometricBatSVG size={26} color="var(--pumpkin)" />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(14px, 1.6vw, 22px)',
                letterSpacing: '0.1em',
                fontWeight: 700,
              }}
            >
              WAITING FOR HOST TO START…
            </span>
          </div>
        </footer>
      </div>
    );
  }

  /* ---- LIVE STATE (BULLETPROOF 1:1 SQUARE CARDS ON ANY SMARTBOARD) ---- */
  if (poll.status === 'live') {
    // Dynamically size grid columns based on how many options exist so cards stay big & square
    const count = options.length;
    const minColWidth = count <= 4 ? 280 : count <= 8 ? 220 : 185;

    return (
      <div
        className="display-screen"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          padding: 0,
          gap: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {halftoneBackdrop}
        {transitionBanner}
        <div className="hazard-stripes" style={{ height: 12, width: '100%', flexShrink: 0 }} />

        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '4px solid var(--bone)',
            background: 'var(--ink)',
            position: 'relative',
            zIndex: 2,
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <GeometricPumpkinSVG size={30} color="var(--pumpkin)" />
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(24px, 3.2vw, 48px)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--void)',
                border: '3px solid var(--toxic)',
                padding: '6px 14px',
                boxShadow: '4px 4px 0 var(--toxic)',
              }}
            >
              <span className="blink-dot" style={{ width: 12, height: 12, background: 'var(--toxic)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'clamp(16px, 1.6vw, 22px)',
                  color: 'var(--toxic)',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                }}
              >
                VOTING LIVE
              </span>
            </div>
            {headerControls}
          </div>
        </div>

        {/* Options Grid — Uses alignContent: 'start' + paddingBottom: '100%' so cards NEVER stretch into rectangles! */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
            alignContent: 'start',
            alignItems: 'start',
            gap: 20,
            padding: '24px 28px',
            overflowY: 'auto',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {options.map((opt) => {
            const tally = result?.tallies.find((t) => t.optionId === opt.id);
            return (
              <div
                key={opt.id}
                style={{
                  border: '4px solid var(--bone)',
                  background: 'var(--ink)',
                  boxShadow: '6px 6px 0 var(--bone)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Intrinsic 1:1 Square Wrapper (Works on 100% of old & new Smartboard browsers) */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 0,
                    paddingBottom: '100%',
                    background: 'var(--void)',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={opt.imageUrl}
                    alt={opt.title}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  {/* Top-left solid label chip per Design Guide §5.6 */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      background: 'var(--pumpkin)',
                      color: 'var(--void)',
                      borderRight: '3px solid var(--void)',
                      borderBottom: '3px solid var(--void)',
                      padding: '4px 12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 20,
                      fontWeight: 900,
                      zIndex: 2,
                    }}
                  >
                    {opt.label}
                  </div>
                </div>

                {/* Option Title Footer Bar */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderTop: '4px solid var(--bone)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    background: 'var(--ink)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(18px, 1.8vw, 24px)',
                      color: 'var(--bone)',
                      textTransform: 'uppercase',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.title}
                  </span>
                  {poll.settings.showLiveCountsBigScreen && tally && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'clamp(18px, 1.8vw, 24px)',
                        color: 'var(--pumpkin)',
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {tally.count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '4px solid var(--bone)',
            padding: '14px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--ink)',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 2vw, 28px)', color: 'var(--bone)', fontWeight: 700 }}>
            {votes.length} VOTES CAST
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 2vw, 28px)', color: 'var(--pumpkin)', fontWeight: 700 }}>
            JOIN CODE: {formatJoinCode(poll.joinCode)}
          </span>
        </div>
      </div>
    );
  }

  /* ---- CLOSED STATE ---- */
  if (poll.status === 'closed') {
    return (
      <div
        className="display-screen"
        style={{ alignItems: 'center', justifyContent: 'center', gap: 24, position: 'relative' }}
      >
        {halftoneBackdrop}
        {floatingControls}
        {transitionBanner}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, width: '100%', maxWidth: 960 }}>
          <div className="hazard-stripes" style={{ height: 18, width: '100%', marginBottom: 48 }} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
            <GeometricSkullSVG size={54} color="var(--pumpkin)" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(44px, 6vw, 96px)',
              color: 'var(--bone)',
              lineHeight: 0.9,
              margin: 0,
            }}
          >
            VOTING IS CLOSED.
          </h1>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 56px)',
              color: 'var(--pumpkin)',
              marginTop: 24,
            }}
          >
            THE SPIRITS ARE COUNTING.
          </h2>
          <div className="hazard-stripes" style={{ height: 18, width: '100%', marginTop: 48 }} />
        </div>
      </div>
    );
  }

  /* ---- SPECIAL VOTING STATE (TV / PROJECTOR) ---- */
  if (poll.status === 'special_voting') {
    return (
      <div
        className="display-screen"
        style={{ alignItems: 'center', justifyContent: 'center', gap: 24, position: 'relative' }}
      >
        {halftoneBackdrop}
        {floatingControls}
        {transitionBanner}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, width: '100%', maxWidth: 960 }}>
          <div className="hazard-stripes" style={{ height: 18, width: '100%', marginBottom: 48 }} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
            <GeometricSkullSVG size={54} color="var(--witch)" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(44px, 6vw, 96px)',
              color: 'var(--bone)',
              lineHeight: 0.9,
              margin: 0,
            }}
          >
            SPECIAL VOTES COUNTING.
          </h1>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 4vw, 56px)',
              color: 'var(--witch)',
              marginTop: 24,
            }}
          >
            THE JURY IS CASTING THEIR BALLOTS.
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(14px, 2vw, 20px)',
              color: 'var(--ash)',
              marginTop: 16,
              letterSpacing: '0.08em',
            }}
          >
            RESULTS WILL BE REVEALED ON SCREEN SHORTLY
          </p>
          <div className="hazard-stripes" style={{ height: 18, width: '100%', marginTop: 48 }} />
        </div>
      </div>
    );
  }

  /* ---- REVEALED STATE (ARCHITECTURAL BRUTALIST CRYPT PODIUM) ---- */
  if (poll.status === 'revealed' && result) {
    if ((result.totalPoints ?? result.totalVotes) === 0) {
      return (
        <div
          className="display-screen"
          style={{ alignItems: 'center', justifyContent: 'center', gap: 24, padding: 48, position: 'relative' }}
        >
          {halftoneBackdrop}
          {floatingControls}
          <div className="hazard-stripes" style={{ height: 20, width: '100%', maxWidth: 800, marginBottom: 32 }} />
          <GeometricGhostSVG size={64} color="var(--pumpkin)" />
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(44px, 8vw, 110px)',
              color: 'var(--pumpkin)',
              textAlign: 'center',
              lineHeight: 0.9,
              margin: 0,
            }}
          >
            NOBODY VOTED.
            <br />
            SPOOKY.
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 32,
              color: 'var(--ash)',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            THE DEAD REMAIN SILENT.
          </p>
          <div className="hazard-stripes" style={{ height: 20, width: '100%', maxWidth: 800, marginTop: 32 }} />
        </div>
      );
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const podiumCount = Math.min(3, result.tallies.length);
    const isThirdRevealed = reducedMotion || revealStep >= 1;
    const isSecondRevealed = reducedMotion || (podiumCount === 3 ? revealStep >= 2 : revealStep >= 1);
    const isFirstRevealed = reducedMotion || revealStep >= podiumCount;

    const tally1 = result.tallies[0];
    const opt1 = tally1 ? options.find((o) => o.id === tally1.optionId) : null;

    const tally2 = result.tallies[1];
    const opt2 = tally2 ? options.find((o) => o.id === tally2.optionId) : null;

    const tally3 = result.tallies[2];
    const opt3 = tally3 ? options.find((o) => o.id === tally3.optionId) : null;

    const runners = result.tallies.slice(3);

    // Explicit pixel square dimensions for podium portraits so even old browsers without `min(vw, vh)` render 1:1 squares
    const sidePortraitPx = Math.round(Math.max(105, Math.min(viewport.w * 0.13, viewport.h * 0.2, 210)));
    const winnerPortraitPx =
      result.winners.length > 1
        ? Math.round(Math.max(95, Math.min(viewport.w * 0.11, viewport.h * 0.17, 175)))
        : Math.round(Math.max(130, Math.min(viewport.w * 0.155, viewport.h * 0.235, 250)));

    // Unmasked Crypt Monolith Placeholder (during reveal sequence)
    const renderCryptMonolith = (
      badge: string,
      heightPct: string,
      accentColor: string,
      isCenter = false
    ) => (
      <div
        style={{
          flex: isCenter ? '1.15 1 320px' : '1 1 260px',
          maxWidth: isCenter ? 470 : 380,
          height: heightPct,
          background: 'var(--ink)',
          border: `4px dashed ${accentColor}`,
          boxShadow: `${isCenter ? '8px 8px' : '6px 6px'} 0 ${accentColor}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <div>
          <div
            style={{
              background: accentColor,
              color: 'var(--void)',
              padding: '10px 14px',
              textAlign: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: isCenter ? 20 : 16,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <GeometricSkullSVG size={18} color="var(--void)" />
            <span>{badge}</span>
            <GeometricSkullSVG size={18} color="var(--void)" />
          </div>
          <JaggedTeethEdge color={accentColor} height={8} />
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 16,
          }}
        >
          <div className="hazard-stripes" style={{ height: 10, width: '75%' }} />
          <GeometricSkullSVG size={isCenter ? 68 : 52} color={accentColor} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="blink-dot" style={{ background: accentColor, width: 10, height: 10 }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                color: accentColor,
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              UNMASKING SOUL…
            </span>
          </div>
          <div className="hazard-stripes" style={{ height: 10, width: '75%' }} />
        </div>

        <div
          style={{
            borderTop: `3px solid ${accentColor}`,
            background: 'var(--void)',
            padding: '12px 16px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: accentColor, letterSpacing: '0.14em', fontWeight: 700 }}>
            AWAITING TALLY…
          </span>
        </div>
      </div>
    );

    return (
      <div
        className="display-screen"
        style={{
          padding: 0,
          gap: 0,
          overflow: 'hidden',
          position: 'relative',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {halftoneBackdrop}
        <BatsAnimation />

        {/* Reveal Step 0 - Blackout + "AND THE WINNER IS…" */}
        {!reducedMotion && revealStep === 0 && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              background: 'var(--void)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <div className="hazard-stripes" style={{ height: 18, width: '65%' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <GeometricPumpkinSVG size={56} color="var(--pumpkin)" />
              <GeometricBatSVG size={48} color="var(--bone)" />
              <GeometricPumpkinSVG size={56} color="var(--pumpkin)" />
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(48px, 8vw, 112px)',
                color: 'var(--bone)',
                textAlign: 'center',
                lineHeight: 0.92,
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              AND THE
              <br />
              <span style={{ color: 'var(--pumpkin)' }}>WINNER IS…</span>
            </h1>
            <div className="hazard-stripes" style={{ height: 18, width: '65%' }} />
          </div>
        )}

        {/* Top Header: True 3-Column Symmetric Grid (`1fr auto 1fr`) */}
        <header
          style={{
            height: 68,
            flexShrink: 0,
            borderBottom: '4px solid var(--bone)',
            background: 'var(--ink)',
            padding: '0 28px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 16,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, justifySelf: 'start' }}>
            <GeometricPumpkinSVG size={26} color="var(--pumpkin)" />
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(20px, 2.4vw, 32px)',
                color: 'var(--bone)',
                margin: 0,
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {poll.title}
            </h1>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--void)',
              border: '3px solid var(--pumpkin)',
              boxShadow: '4px 4px 0 var(--pumpkin)',
              padding: '6px 18px',
              justifySelf: 'center',
            }}
          >
            <GeometricBatSVG size={22} color="var(--pumpkin)" />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'clamp(13px, 1.3vw, 17px)',
                color: 'var(--pumpkin)',
                letterSpacing: '0.14em',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              THE HALL OF SOULS · FINAL STANDINGS
            </span>
            <GeometricBatSVG size={22} color="var(--pumpkin)" />
          </div>

          {headerControls}
        </header>

        <div style={{ position: 'relative', zIndex: 9, flexShrink: 0 }}>
          <JaggedTeethEdge color="var(--bone)" height={8} />
        </div>

        {/* Theatrical Monolith Podium Stage */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 'clamp(16px, 2.4vw, 36px)',
            padding: '10px 28px 18px',
            minHeight: 0,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* ================= 2ND PLACE MONOLITH (LEFT WING) ================= */}
          {podiumCount >= 2 &&
            (isSecondRevealed && opt2 && tally2 ? (
              <div
                style={{
                  flex: '1 1 260px',
                  maxWidth: 380,
                  height: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    background: 'var(--ink)',
                    border: '4px solid var(--bone)',
                    boxShadow: '6px 6px 0 var(--bone)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--bone)',
                      color: 'var(--void)',
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(14px, 1.4vw, 18px)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <GeometricSkullSVG size={18} color="var(--void)" />
                    <span>2ND PLACE · RUNNER-UP</span>
                  </div>
                  <JaggedTeethEdge color="var(--bone)" height={7} />

                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-evenly',
                      padding: '10px 16px',
                      gap: 8,
                    }}
                  >
                    {/* Explicit Pixel 1:1 Square Frame */}
                    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      <div
                        className="chamfer-frame"
                        style={{
                          width: sidePortraitPx,
                          height: sidePortraitPx,
                          border: '3px solid var(--bone)',
                          background: 'var(--void)',
                          boxShadow: '4px 4px 0 var(--bone)',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={opt2.imageUrl}
                          alt={opt2.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          top: -4,
                          left: -4,
                          background: 'var(--bone)',
                          color: 'var(--void)',
                          border: '2px solid var(--void)',
                          padding: '2px 8px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          fontWeight: 900,
                          zIndex: 2,
                        }}
                      >
                        {opt2.label}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        flexShrink: 0,
                      }}
                    >
                      <h2
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'clamp(20px, 2.2vw, 30px)',
                          color: 'var(--bone)',
                          margin: 0,
                          textTransform: 'uppercase',
                          lineHeight: 1,
                          textAlign: 'center',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt2.title}
                      </h2>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'var(--void)',
                          border: '2px solid var(--bone)',
                          boxShadow: '3px 3px 0 var(--bone)',
                          padding: '3px 12px',
                        }}
                      >
                        <GeometricCandleSVG size={13} color="var(--bone)" />
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            color: 'var(--bone)',
                            letterSpacing: '0.1em',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          CONTESTANT {opt2.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2nd Place Simplified Pedestal Base */}
                <div
                  style={{
                    background: 'var(--ink)',
                    border: '4px solid var(--bone)',
                    borderTop: 'none',
                    boxShadow: '6px 6px 0 var(--bone)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '12px 16px 14px',
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  <div className="hazard-stripes-bone" style={{ height: 8, width: '100%' }} />

                  <SegmentedVoteBar
                    percentage={tally2.percentage}
                    fillColor="var(--bone)"
                    borderColor="var(--bone)"
                  />

                  <div
                    style={{
                      background: 'var(--void)',
                      border: '2px solid var(--bone)',
                      padding: '8px 14px',
                      width: '100%',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'clamp(16px, 1.8vw, 24px)',
                        color: 'var(--bone)',
                        fontWeight: 900,
                      }}
                    >
                      {tally2.count} {poll.settings.enableSpecialVotes ? 'PTS' : 'VOTES'} ({tally2.percentage}%)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              renderCryptMonolith('2ND PLACE · RUNNER-UP', '85%', 'var(--bone)')
            ))}

          {/* ================= 1ST PLACE MONOLITH (CENTER / WINNER) ================= */}
          {isFirstRevealed && opt1 && tally1 ? (
            <div
              style={{
                flex: '1.15 1 320px',
                maxWidth: 470,
                height: '97%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                minHeight: 0,
                zIndex: 3,
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  background: 'var(--ink)',
                  border: '4px solid var(--pumpkin)',
                  boxShadow: '8px 8px 0 var(--pumpkin)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    background: 'var(--pumpkin)',
                    color: 'var(--void)',
                    padding: '9px 16px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(16px, 1.9vw, 24px)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  <GeometricCrownSVG size={22} color="var(--void)" />
                  <span>
                    {result.winners.length > 1 ? 'DEADLOCK · CO-WINNERS' : '1ST PLACE · WINNER'}
                  </span>
                  <GeometricCrownSVG size={22} color="var(--void)" />
                </div>
                <JaggedTeethEdge color="var(--pumpkin)" height={9} />

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-evenly',
                    padding: '10px 18px',
                    gap: 8,
                  }}
                >
                  {/* Explicit Pixel 1:1 Square Winner Portrait(s) */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexShrink: 0 }}>
                    {result.winners.slice(0, 2).map((wId) => {
                      const opt = options.find((o) => o.id === wId);
                      if (!opt) return null;
                      return (
                        <div key={wId} style={{ position: 'relative', display: 'inline-flex' }}>
                          <div
                            className="chamfer-frame-lg"
                            style={{
                              width: winnerPortraitPx,
                              height: winnerPortraitPx,
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
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      flexShrink: 0,
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(24px, 2.8vw, 38px)',
                        color: 'var(--bone)',
                        margin: 0,
                        textTransform: 'uppercase',
                        lineHeight: 1,
                        textAlign: 'center',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {result.winners.length > 1
                        ? result.winners
                            .map((wId) => options.find((o) => o.id === wId)?.title)
                            .join(' & ')
                        : opt1.title}
                    </h2>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        background: 'var(--void)',
                        border: '2px solid var(--pumpkin)',
                        boxShadow: '4px 4px 0 var(--pumpkin)',
                        padding: '4px 16px',
                      }}
                    >
                      <GeometricPumpkinSVG size={15} color="var(--pumpkin)" />
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'clamp(12px, 1.2vw, 14px)',
                          color: 'var(--pumpkin)',
                          letterSpacing: '0.12em',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {result.winners.length > 1 ? 'CO-WINNERS' : `CONTESTANT ${opt1.label}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Winner Simplified Pedestal Base */}
              <div
                style={{
                  background: 'var(--ink)',
                  border: '4px solid var(--pumpkin)',
                  borderTop: 'none',
                  boxShadow: '8px 8px 0 var(--pumpkin)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '14px 18px 18px',
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <div className="hazard-stripes" style={{ height: 10, width: '100%' }} />

                <SegmentedVoteBar
                  percentage={tally1.percentage}
                  fillColor="var(--toxic)"
                  borderColor="var(--pumpkin)"
                />

                <div
                  style={{
                    background: 'var(--void)',
                    border: '3px solid var(--toxic)',
                    boxShadow: '4px 4px 0 var(--toxic)',
                    padding: '8px 18px',
                    width: '100%',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'clamp(18px, 2.2vw, 30px)',
                      color: 'var(--toxic)',
                      fontWeight: 900,
                    }}
                  >
                    {tally1.count} {poll.settings.enableSpecialVotes ? 'PTS' : 'VOTES'} ({tally1.percentage}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            renderCryptMonolith('1ST PLACE · WINNER', '97%', 'var(--pumpkin)', true)
          )}

          {/* ================= 3RD PLACE MONOLITH (RIGHT WING) ================= */}
          {podiumCount >= 3 &&
            (isThirdRevealed && opt3 && tally3 ? (
              <div
                style={{
                  flex: '1 1 260px',
                  maxWidth: 380,
                  height: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  minHeight: 0,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    background: 'var(--ink)',
                    border: '4px solid var(--ash)',
                    boxShadow: '6px 6px 0 var(--ash)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--ash)',
                      color: 'var(--void)',
                      padding: '8px 12px',
                      textAlign: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(14px, 1.4vw, 18px)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    <GeometricGhostSVG size={18} color="var(--void)" />
                    <span>3RD PLACE</span>
                  </div>
                  <JaggedTeethEdge color="var(--ash)" height={7} />

                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-evenly',
                      padding: '10px 16px',
                      gap: 8,
                    }}
                  >
                    {/* Explicit Pixel 1:1 Square Frame */}
                    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                      <div
                        className="chamfer-frame"
                        style={{
                          width: sidePortraitPx,
                          height: sidePortraitPx,
                          border: '3px solid var(--ash)',
                          background: 'var(--void)',
                          boxShadow: '4px 4px 0 var(--ash)',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={opt3.imageUrl}
                          alt={opt3.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          top: -4,
                          left: -4,
                          background: 'var(--ash)',
                          color: 'var(--void)',
                          border: '2px solid var(--void)',
                          padding: '2px 8px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          fontWeight: 900,
                          zIndex: 2,
                        }}
                      >
                        {opt3.label}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        flexShrink: 0,
                      }}
                    >
                      <h2
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'clamp(20px, 2.2vw, 30px)',
                          color: 'var(--bone)',
                          margin: 0,
                          textTransform: 'uppercase',
                          lineHeight: 1,
                          textAlign: 'center',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt3.title}
                      </h2>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'var(--void)',
                          border: '2px solid var(--ash)',
                          boxShadow: '3px 3px 0 var(--ash)',
                          padding: '3px 12px',
                        }}
                      >
                        <GeometricCandleSVG size={13} color="var(--ash)" />
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            color: 'var(--bone)',
                            letterSpacing: '0.1em',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          CONTESTANT {opt3.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3rd Place Simplified Pedestal Base */}
                <div
                  style={{
                    background: 'var(--ink)',
                    border: '4px solid var(--ash)',
                    borderTop: 'none',
                    boxShadow: '6px 6px 0 var(--ash)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '12px 16px 14px',
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  <div className="hazard-stripes" style={{ height: 8, width: '100%' }} />

                  <SegmentedVoteBar
                    percentage={tally3.percentage}
                    fillColor="var(--ash)"
                    borderColor="var(--ash)"
                  />

                  <div
                    style={{
                      background: 'var(--void)',
                      border: '2px solid var(--ash)',
                      padding: '8px 14px',
                      width: '100%',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'clamp(16px, 1.8vw, 24px)',
                        color: 'var(--ash)',
                        fontWeight: 900,
                      }}
                    >
                      {tally3.count} {poll.settings.enableSpecialVotes ? 'PTS' : 'VOTES'} ({tally3.percentage}%)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              renderCryptMonolith('3RD PLACE', '85%', 'var(--ash)')
            ))}
        </main>

        {/* Runners in the Shadows Ticker Bar */}
        {isFirstRevealed && runners.length > 0 && (
          <div
            className="no-scrollbar"
            style={{
              height: 54,
              flexShrink: 0,
              background: 'var(--ink)',
              borderTop: '4px solid var(--bone)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 28px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--pumpkin)',
                letterSpacing: '0.1em',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <GeometricGhostSVG size={16} color="var(--pumpkin)" />
              <span>RUNNERS IN THE SHADOWS:</span>
            </div>
            {runners.map((t, idx) => {
              const opt = options.find((o) => o.id === t.optionId);
              return (
                <div
                  key={t.optionId}
                  style={{
                    background: 'var(--void)',
                    border: '2px solid var(--bone)',
                    boxShadow: '3px 3px 0 var(--ash)',
                    padding: '4px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: 'var(--bone)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: 'var(--pumpkin)', fontWeight: 700 }}>#{idx + 4}</span>
                  <span
                    style={{
                      background: 'var(--bone)',
                      color: 'var(--void)',
                      padding: '0 5px',
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    {opt?.label}
                  </span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{opt?.title}</span>
                  <span style={{ color: 'var(--toxic)', fontWeight: 700 }}>
                    {t.count}{poll.settings.enableSpecialVotes ? ' PTS' : 'V'} ({t.percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Symmetric 3-Column Footer */}
        <footer
          style={{
            height: 46,
            flexShrink: 0,
            borderTop: '4px solid var(--bone)',
            background: 'var(--void)',
            padding: '0 28px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--bone)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'start' }}>
            <span style={{ width: 8, height: 8, background: 'var(--pumpkin)', display: 'inline-block' }} />
            <span>
              {poll.settings.enableSpecialVotes
                ? `${result.totalPoints ?? result.totalVotes} TOTAL POINTS`
                : `${result.totalVotes} TOTAL VOTES CAST`}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ash)', justifySelf: 'center' }}>
            <GeometricSkullSVG size={15} color="var(--ash)" />
            <span>{result.totalParticipants} PARTICIPANTS</span>
          </div>
          <div style={{ justifySelf: 'end', color: 'var(--toxic)' }}>
            <span>{result.turnoutPercentage}% TURNOUT</span>
          </div>
        </footer>
      </div>
    );
  }

  return null;
};

export default BigScreen;
