import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Minimize2, Volume2, VolumeX, Crown, Flame } from 'lucide-react';
import BatsAnimation from '../components/ui/BatsAnimation';
import {
  subscribeToPoll,
  subscribeToOptions,
  subscribeToParticipants,
  subscribeToVotes,
  computeResults,
} from '../firebase/pollService';
import type { Poll, PollOption, Participant, Vote } from '../types/poll';
import { playCreak, playSting, playTick, isMuted, toggleMuted } from '../utils/audio';
import { formatJoinCode } from '../utils/code';

/** Big Screen display — designed for TV/projector, no host controls */
const BigScreen: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll]           = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions]     = useState<PollOption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes]         = useState<Vote[]>([]);
  const [revealStep, setRevealStep] = useState(-1); // -1 = not started, 0 = black, 1+ = animating
  const [isFullscreen, setIsFullscreen] = useState(Boolean(typeof document !== 'undefined' && document.fullscreenElement));
  const [muted, setMutedState] = useState(isMuted());
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
    return computeResults(votes, options, participants.length, poll?.decidedWinnerId);
  }, [votes, options, participants.length, poll?.decidedWinnerId]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!pollId) return;
    const u1 = subscribeToPoll(
      pollId,
      (p) => {
        if (prevStatus.current) {
          if (prevStatus.current === 'lobby' && p.status === 'live') {
            setTransitionOverlay({
              title: 'THE HAUNT COMMENCES',
              subtitle: 'CAST YOUR HEXES · VOTING IS NOW LIVE',
              accent: 'var(--toxic)',
            });
            setTimeout(() => setTransitionOverlay(null), 1800);
          } else if (prevStatus.current === 'live' && p.status === 'closed') {
            setTransitionOverlay({
              title: 'VOTING CONCLUDED',
              subtitle: 'THE DEAD ARE COUNTING BALLOTS…',
              accent: 'var(--blood)',
            });
            setTimeout(() => setTransitionOverlay(null), 1800);
          }
        }

        // Trigger reveal sequence when status changes to 'revealed'
        if (prevStatus.current !== 'revealed' && p.status === 'revealed') {
          const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (!isMuted() && !isReduced) { playCreak(); }
          setRevealStep(isReduced ? 999 : 0);
        }
        prevStatus.current = p.status;
        setPoll(p);
      },
      undefined,
      () => {
        window.location.href = '/';
      }
    );
    const u2 = subscribeToOptions(pollId, setOptions);
    const u3 = subscribeToParticipants(pollId, setParticipants);
    const u4 = subscribeToVotes(pollId, setVotes);
    return () => { u1(); u2(); u3(); u4(); };
  }, [pollId]);

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

  if (!pollId) return null;

  if (!poll) {
    return (
      <div className="display-screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', fontSize: 24 }}>LOADING…</p>
      </div>
    );
  }

  // Floating controls for standalone views (Lobby & Closed)
  const floatingControls = (
    <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 999, display: 'flex', gap: 8 }}>
      <button
        className="btn-ghost"
        onClick={toggleAudio}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        style={{ background: 'var(--ink)', padding: '8px 12px', border: '2px solid var(--bone)', display: 'inline-flex', alignItems: 'center' }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <button
        className="btn-ghost"
        onClick={toggleFullscreen}
        title="Toggle Fullscreen (F)"
        style={{ background: 'var(--ink)', padding: '8px 12px', border: '2px solid var(--bone)', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12 }}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        <span>{isFullscreen ? 'EXIT' : 'FULLSCREEN'}</span>
      </button>
    </div>
  );

  // Integrated controls cluster for header bars (Live & Revealed)
  const headerControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        className="btn-ghost"
        onClick={toggleAudio}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        style={{ background: 'var(--void)', padding: '8px 12px', border: '2px solid var(--bone)', display: 'inline-flex', alignItems: 'center' }}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <button
        className="btn-ghost"
        onClick={toggleFullscreen}
        title="Toggle Fullscreen (F)"
        style={{ background: 'var(--void)', padding: '8px 12px', border: '2px solid var(--bone)', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12 }}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        <span>{isFullscreen ? 'EXIT' : 'FULLSCREEN'}</span>
      </button>
    </div>
  );

  const transitionBanner = transitionOverlay && (
    <div className="stage-transition-overlay" style={{ border: `4px solid ${transitionOverlay.accent}` }}>
      <div className="hazard-stripes" style={{ height: 16, width: '100%', maxWidth: 700, marginBottom: 24 }} />
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 84px)', color: transitionOverlay.accent, textAlign: 'center', lineHeight: 0.95, textTransform: 'uppercase' }}>
        {transitionOverlay.title}
      </h1>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(18px, 3vw, 32px)', color: 'var(--bone)', textAlign: 'center', marginTop: 18, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {transitionOverlay.subtitle}
      </p>
      <div className="hazard-stripes" style={{ height: 16, width: '100%', maxWidth: 700, marginTop: 24 }} />
    </div>
  );

  /* ---- LOBBY STATE ---- */
  if (poll.status === 'lobby') {
    return (
      <div className="display-screen" style={{ flexDirection: 'row', position: 'relative' }}>
        {floatingControls}
        {transitionBanner}
        {/* Left — QR */}
        <div style={{ flex: '0 0 55%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, borderRight: '4px solid var(--bone)' }}>
          <div className="qr-container" style={{ padding: 24 }}>
            <QRCodeSVG
              value={joinUrl}
              size={Math.min(window.innerHeight * 0.55, 500)}
              level="M"
              bgColor="#F4EEDF"
              fgColor="#0D0B10"
            />
          </div>
        </div>

        {/* Right — info */}
        <div style={{ flex: '0 0 45%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 48, gap: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 80px)', color: 'var(--bone)', lineHeight: 0.92 }}>
            {poll.title}
          </h1>

          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 56px)', color: 'var(--pumpkin)', letterSpacing: '-0.01em', lineHeight: 1 }}>
              SCAN TO VOTE.<br />IF YOU DARE.
            </p>
          </div>

          <div style={{ borderTop: '3px solid var(--bone)', paddingTop: 24 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--ash)', marginBottom: 8, letterSpacing: '0.08em' }}>JOIN CODE</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(48px, 7vw, 100px)', color: 'var(--bone)', letterSpacing: '0.16em', margin: 0 }}>
              {formatJoinCode(poll.joinCode)}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--ash)', marginTop: 12, wordBreak: 'break-all' }}>
              {joinUrl}
            </p>
          </div>
        </div>

        {/* Bottom strip — joined count */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '4px solid var(--bone)', background: 'var(--ink)', padding: '16px 48px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="blink-dot" style={{ width: 14, height: 14 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(28px, 3.5vw, 44px)', color: 'var(--toxic)', letterSpacing: '0.08em' }}>
            {Math.max(participants.length, votes.length)} JOINED
          </span>
        </div>
      </div>
    );
  }

  /* ---- LIVE STATE ---- */
  if (poll.status === 'live') {
    return (
      <div className="display-screen" style={{ padding: 0, gap: 0, position: 'relative' }}>
        {transitionBanner}
        {/* Hazard Stripes Banner on Live */}
        <div className="hazard-stripes" style={{ height: 14, width: '100%' }} />

        <div style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '4px solid var(--bone)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 56px)', color: 'var(--bone)', margin: 0, textTransform: 'uppercase' }}>
            {poll.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="blink-dot" style={{ width: 14, height: 14 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--toxic)', letterSpacing: '0.08em', fontWeight: 700 }}>VOTING LIVE</span>
            </div>
            {headerControls}
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, padding: 32, overflowY: 'auto' }}>
          {options.map((opt) => {
            const tally = result?.tallies.find((t) => t.optionId === opt.id);
            return (
              <div key={opt.id} style={{ border: '4px solid var(--bone)', background: 'var(--ink)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ aspectRatio: '1/1', overflow: 'hidden' }}>
                  <img src={opt.imageUrl} alt={opt.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '12px 16px', borderTop: '3px solid var(--bone)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, textTransform: 'uppercase' }}>{opt.label} — {opt.title}</span>
                  {poll.settings.showLiveCountsBigScreen && tally && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--pumpkin)' }}>{tally.count}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: '4px solid var(--bone)', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--ink)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--ash)' }}>{votes.length} VOTES CAST</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--ash)' }}>CODE: {formatJoinCode(poll.joinCode)}</span>
        </div>
      </div>
    );
  }

  /* ---- CLOSED STATE ---- */
  if (poll.status === 'closed') {
    return (
      <div className="display-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 24, position: 'relative' }}>
        {floatingControls}
        {transitionBanner}
        <div style={{ textAlign: 'center' }}>
          <div className="hazard-stripes" style={{ height: 16, width: '100%', marginBottom: 48 }} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 96px)', color: 'var(--bone)', lineHeight: 0.9 }}>
            VOTING IS CLOSED.
          </h1>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 56px)', color: 'var(--ash)', marginTop: 24 }}>
            THE SPIRITS ARE COUNTING.
          </h2>
          <div className="hazard-stripes" style={{ height: 16, width: '100%', marginTop: 48 }} />
        </div>
      </div>
    );
  }

  /* ---- REVEALED STATE (ARCHITECTURAL BRUTALIST PODIUM) ---- */
  if (poll.status === 'revealed' && result) {
    if (result.totalVotes === 0) {
      return (
        <div className="display-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 24, padding: 48, position: 'relative' }}>
          {floatingControls}
          <div className="hazard-stripes" style={{ height: 20, width: '100%', maxWidth: 800, marginBottom: 32 }} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 8vw, 110px)', color: 'var(--pumpkin)', textAlign: 'center', lineHeight: 0.9 }}>
            NOBODY VOTED.<br />SPOOKY.
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 32, color: 'var(--ash)', textAlign: 'center', marginTop: 24 }}>
            THE DEAD REMAIN SILENT.
          </p>
          <div className="hazard-stripes" style={{ height: 20, width: '100%', maxWidth: 800, marginTop: 32 }} />
        </div>
      );
    }

    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

    // Crypt Monolith Placeholder (during reveal sequence)
    const renderCryptMonolith = (badge: string, heightPct: string, roman: string, accentColor: string) => (
      <div
        style={{
          flex: '1 1 280px',
          maxWidth: 380,
          height: heightPct,
          background: 'var(--ink)',
          border: `3px dashed ${accentColor}`,
          boxShadow: `6px 6px 0 ${accentColor}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <div style={{ background: accentColor, color: 'var(--void)', padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {badge}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 16 }}>
          <div className="hazard-stripes" style={{ height: 10, width: '70%' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 5vw, 68px)', color: accentColor }}>☠</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="blink-dot" style={{ background: accentColor }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: accentColor, fontWeight: 700 }}>UNMASKING CONTESTANT…</span>
          </div>
          <div className="hazard-stripes" style={{ height: 10, width: '70%' }} />
        </div>
        <div style={{ borderTop: `2px solid ${accentColor}`, background: 'var(--void)', padding: '10px 0', textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: accentColor }}>{roman}</span>
        </div>
      </div>
    );

    return (
      <div className="display-screen" style={{ padding: 0, gap: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Ambient floating bats */}
        <BatsAnimation />

        {/* Reveal Step 0 — Blackout + "AND THE WINNER IS…" */}
        {!reducedMotion && revealStep === 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'var(--void)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, flexDirection: 'column', gap: 24 }}>
            <div className="hazard-stripes" style={{ height: 16, width: '60%' }} />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 8vw, 110px)', color: 'var(--bone)', textAlign: 'center', lineHeight: 0.92, textTransform: 'uppercase' }}>
              AND THE<br /><span style={{ color: 'var(--pumpkin)' }}>WINNER IS…</span>
            </h1>
            <div className="hazard-stripes" style={{ height: 16, width: '60%' }} />
          </div>
        )}

        {/* Top Header: 3-column flex layout (Title - Subtitle - Controls) */}
        <div style={{ height: 68, borderBottom: '3px solid var(--bone)', background: 'var(--ink)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10 }}>
          {/* Left: Poll Title */}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 2.5vw, 30px)', color: 'var(--bone)', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.01em', maxWidth: '35%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {poll.title}
          </h1>

          {/* Center: Hall of Souls Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="blink-dot" style={{ background: 'var(--pumpkin)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(12px, 1.3vw, 16px)', color: 'var(--pumpkin)', letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
              ✦ THE HALL OF SOULS · FINAL STANDINGS ✦
            </span>
          </div>

          {/* Right: Integrated Controls (Never overlaps text) */}
          {headerControls}
        </div>

        {/* Theatrical Monolith Podium Stage */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(16px, 2.5vw, 40px)', padding: '16px 24px 16px', minHeight: 0, position: 'relative', zIndex: 2 }}>

          {/* 2nd Place Monolith (Left) */}
          {podiumCount >= 2 && (
            isSecondRevealed && opt2 && tally2 ? (
              <div
                style={{
                  flex: '1 1 290px',
                  maxWidth: 380,
                  height: '82%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                }}
              >
                {/* 2nd Place Altar Box */}
                <div
                  style={{
                    flex: 1,
                    background: 'var(--ink)',
                    border: '4px solid var(--bone)',
                    boxShadow: '6px 6px 0 var(--bone)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ background: 'var(--bone)', color: 'var(--void)', padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 'clamp(13px, 1.5vw, 18px)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🥈 2ND PLACE · RUNNER-UP
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: '12px 14px 14px', minHeight: 0 }}>
                    {/* Chamfered Octagonal Portrait Frame */}
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <div className="chamfer-frame" style={{ width: 'clamp(105px, 12vw, 160px)', aspectRatio: '1/1', border: '3px solid var(--bone)', background: 'var(--void)', boxShadow: '4px 4px 0 var(--bone)' }}>
                        <img
                          src={opt2.imageUrl}
                          alt={opt2.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 2.2vw, 28px)', color: 'var(--bone)', margin: 0, textTransform: 'uppercase', lineHeight: 1 }}>
                        {opt2.title}
                      </h2>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ash)', margin: '4px 0 0', textTransform: 'uppercase' }}>
                        CONTESTANT {opt2.label}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2nd Place Architectural Pedestal Base */}
                <div
                  style={{
                    background: 'var(--ink)',
                    border: '4px solid var(--bone)',
                    borderTop: 'none',
                    boxShadow: '6px 6px 0 var(--bone)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 12px 12px',
                  }}
                >
                  <div className="hazard-stripes-bone" style={{ height: 8, width: '100%', marginBottom: 8 }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 42px)', color: 'var(--bone)', lineHeight: 0.9 }}>
                    II
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bone)', letterSpacing: '0.12em', margin: '2px 0 6px', textTransform: 'uppercase' }}>
                    RUNNER-UP
                  </span>
                  <div style={{ background: 'var(--void)', border: '2px solid var(--bone)', padding: '4px 14px', width: '90%', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(16px, 1.8vw, 22px)', color: 'var(--bone)', fontWeight: 900 }}>
                      {tally2.count} VOTES ({tally2.percentage}%)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              renderCryptMonolith('🥈 2ND PLACE · RUNNER-UP', '82%', 'II', 'var(--bone)')
            )
          )}

          {/* 1st Place Monolith (Center / Winner) */}
          {isFirstRevealed && opt1 && tally1 ? (
            <div
              style={{
                flex: '1 1 350px',
                maxWidth: 480,
                height: '96%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                zIndex: 3,
              }}
            >
              {/* Winner Altar Box */}
              <div
                style={{
                  flex: 1,
                  background: 'var(--ink)',
                  border: '4px solid var(--pumpkin)',
                  boxShadow: '8px 8px 0 var(--pumpkin)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Crown Banner */}
                <div style={{ background: 'var(--pumpkin)', color: 'var(--void)', padding: '10px 16px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 'clamp(16px, 2vw, 24px)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {result.winners.length > 1 ? (
                    <>
                      <Flame size={22} /> DEADLOCK · CO-WINNERS
                    </>
                  ) : (
                    <>
                      <Crown size={22} /> 👑 1ST PLACE · WINNER
                    </>
                  )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: '14px 18px 16px', minHeight: 0 }}>
                  {/* Hero Chamfered Octagon Photo (Large) */}
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 12 }}>
                    {result.winners.slice(0, 2).map((wId) => {
                      const opt = options.find((o) => o.id === wId);
                      if (!opt) return null;
                      return (
                        <div
                          key={wId}
                          className="chamfer-frame-lg"
                          style={{
                            width: result.winners.length > 1 ? 'clamp(95px, 11vw, 150px)' : 'clamp(145px, 17vw, 220px)',
                            aspectRatio: '1/1',
                            border: '4px solid var(--pumpkin)',
                            background: 'var(--void)',
                            boxShadow: '5px 5px 0 var(--pumpkin)',
                          }}
                        >
                          <img
                            src={opt.imageUrl}
                            alt={opt.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 3.2vw, 42px)', color: 'var(--bone)', margin: 0, textTransform: 'uppercase', lineHeight: 1 }}>
                      {result.winners.length > 1
                        ? result.winners.map((wId) => options.find((o) => o.id === wId)?.title).join(' & ')
                        : opt1.title}
                    </h2>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--pumpkin)', margin: '4px 0 0', fontWeight: 700, textTransform: 'uppercase' }}>
                      {result.winners.length > 1 ? 'CO-WINNERS OF THE HAUNT' : `CONTESTANT ${opt1.label}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Winner Architectural Pedestal Base (Tallest) */}
              <div
                style={{
                  background: 'var(--ink)',
                  border: '4px solid var(--pumpkin)',
                  borderTop: 'none',
                  boxShadow: '8px 8px 0 var(--pumpkin)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '10px 14px 14px',
                }}
              >
                <div className="hazard-stripes" style={{ height: 10, width: '100%', marginBottom: 8 }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 4.5vw, 54px)', color: 'var(--pumpkin)', lineHeight: 0.9 }}>
                  I
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bone)', letterSpacing: '0.14em', margin: '2px 0 8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  {result.winners.length > 1 ? 'CO-WINNERS' : 'WINNER'}
                </span>
                <div style={{ background: 'var(--void)', border: '2px solid var(--toxic)', padding: '6px 18px', width: '92%', textAlign: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(18px, 2.2vw, 28px)', color: 'var(--toxic)', fontWeight: 900 }}>
                    {tally1.count} VOTES ({tally1.percentage}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            renderCryptMonolith('👑 1ST PLACE · WINNER', '96%', 'I', 'var(--pumpkin)')
          )}

          {/* 3rd Place Monolith (Right) */}
          {podiumCount >= 3 && (
            isThirdRevealed && opt3 && tally3 ? (
              <div
                style={{
                  flex: '1 1 270px',
                  maxWidth: 350,
                  height: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                }}
              >
                {/* 3rd Place Altar Box */}
                <div
                  style={{
                    flex: 1,
                    background: 'var(--ink)',
                    border: '3px solid var(--ash)',
                    boxShadow: '6px 6px 0 var(--ash)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ background: 'var(--ash)', color: 'var(--void)', padding: '7px 10px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 'clamp(12px, 1.4vw, 16px)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    🥉 3RD PLACE
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', padding: '10px 12px 12px', minHeight: 0 }}>
                    {/* Chamfered Octagonal Portrait Frame */}
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <div className="chamfer-frame" style={{ width: 'clamp(95px, 10vw, 145px)', aspectRatio: '1/1', border: '3px solid var(--ash)', background: 'var(--void)', boxShadow: '3px 3px 0 var(--ash)' }}>
                        <img
                          src={opt3.imageUrl}
                          alt={opt3.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 6 }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(16px, 1.8vw, 24px)', color: 'var(--bone)', margin: 0, textTransform: 'uppercase', lineHeight: 1 }}>
                        {opt3.title}
                      </h2>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '3px 0 0', textTransform: 'uppercase' }}>
                        CONTESTANT {opt3.label}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3rd Place Architectural Pedestal Base */}
                <div
                  style={{
                    background: 'var(--ink)',
                    border: '3px solid var(--ash)',
                    borderTop: 'none',
                    boxShadow: '6px 6px 0 var(--ash)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '6px 10px 10px',
                  }}
                >
                  <div className="hazard-stripes" style={{ height: 6, width: '100%', marginBottom: 6 }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 36px)', color: 'var(--ash)', lineHeight: 0.9 }}>
                    III
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ash)', letterSpacing: '0.12em', margin: '2px 0 6px', textTransform: 'uppercase' }}>
                    3RD PLACE
                  </span>
                  <div style={{ background: 'var(--void)', border: '2px solid var(--ash)', padding: '3px 12px', width: '90%', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(15px, 1.6vw, 20px)', color: 'var(--ash)', fontWeight: 900 }}>
                      {tally3.count} VOTES ({tally3.percentage}%)
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              renderCryptMonolith('🥉 3RD PLACE', '70%', 'III', 'var(--ash)')
            )
          )}
        </div>

        {/* Runners in the Shadows Ticker Bar (4th Place and below) */}
        {isFirstRevealed && runners.length > 0 && (
          <div
            className="no-scrollbar"
            style={{
              height: 52,
              background: 'var(--ink)',
              borderTop: '3px solid var(--bone)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '0 24px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              position: 'relative',
              zIndex: 10,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--pumpkin)', letterSpacing: '0.08em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✦</span> RUNNERS IN THE SHADOWS:
            </span>
            {runners.map((t, idx) => {
              const opt = options.find((o) => o.id === t.optionId);
              return (
                <span
                  key={t.optionId}
                  style={{
                    background: 'var(--void)',
                    border: '2px solid var(--ash)',
                    padding: '4px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: 'var(--bone)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ color: 'var(--ash)', fontWeight: 700 }}>#{idx + 4}</span>
                  <span style={{ textTransform: 'uppercase' }}>{opt?.title}</span>
                  <span style={{ color: 'var(--toxic)', fontWeight: 700 }}>{t.count}v ({t.percentage}%)</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ height: 44, borderTop: '3px solid var(--bone)', background: 'var(--void)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ash)', position: 'relative', zIndex: 10 }}>
          <span>{result.totalVotes} TOTAL VOTES CAST</span>
          <span>{result.totalParticipants} PARTICIPANTS</span>
          <span>{result.turnoutPercentage}% TURNOUT</span>
        </div>
      </div>
    );
  }

  return null;
};

export default BigScreen;
