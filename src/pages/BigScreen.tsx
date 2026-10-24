import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  subscribeToPoll,
  subscribeToOptions,
  subscribeToParticipants,
  subscribeToVotes,
  computeResults,
} from '../firebase/pollService';
import type { Poll, PollOption, Participant, Vote } from '../types/poll';
import { playCreak, playSting, playTick, isMuted } from '../utils/audio';
import { formatJoinCode } from '../utils/code';

/** Big Screen display — designed for TV/projector, no host controls */
const BigScreen: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const [poll, setPoll]           = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions]     = useState<PollOption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes]         = useState<Vote[]>([]);
  const [revealStep, setRevealStep] = useState(-1); // -1 = not started, 0 = black, 1+ = animating
  const prevStatus = useRef<string>('');

  const joinUrl = `${window.location.origin}/join/${poll?.joinCode ?? ''}`;

  // Subscriptions
  useEffect(() => {
    if (!pollId) return;
    const u1 = subscribeToPoll(
      pollId,
      (p) => {
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

  // Compute results
  const result = useMemo(() => {
    if (options.length === 0) return null;
    return computeResults(votes, options, participants.length);
  }, [votes, options, participants.length]);

  // Reveal sequence: reveal each option 1 per second, winner last
  useEffect(() => {
    if (revealStep < 0 || revealStep >= 999 || !result) return;

    const totalSteps = result.tallies.length + 1; // +1 for "AND THE WINNER IS…" beat

    if (revealStep < totalSteps) {
      if (!isMuted() && revealStep > 0) playTick();
      const t = setTimeout(() => setRevealStep((s) => s + 1), revealStep === 0 ? 1500 : 900);
      return () => clearTimeout(t);
    }

    // Final step: play sting
    if (revealStep === totalSteps && !isMuted()) {
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

  /* ---- LOBBY STATE ---- */
  if (poll.status === 'lobby') {
    return (
      <div className="display-screen" style={{ flexDirection: 'row' }}>
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
      <div className="display-screen" style={{ padding: 0, gap: 0 }}>
        {/* Hazard Stripes Banner on Live */}
        <div className="hazard-stripes" style={{ height: 14, width: '100%' }} />

        <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '4px solid var(--bone)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 64px)', color: 'var(--bone)', margin: 0 }}>{poll.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="blink-dot" style={{ width: 14, height: 14 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--toxic)', letterSpacing: '0.08em' }}>VOTING LIVE</span>
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
      <div className="display-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 24 }}>
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

  /* ---- REVEALED STATE ---- */
  if (poll.status === 'revealed' && result) {
    if (result.totalVotes === 0) {
      return (
        <div className="display-screen" style={{ alignItems: 'center', justifyContent: 'center', gap: 24, padding: 48 }}>
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

    const sortedByRankAsc = [...result.tallies].reverse(); // last to first for reveal
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const visibleCount  = reducedMotion ? sortedByRankAsc.length : Math.max(0, revealStep - 1);
    const winnerVisible = reducedMotion || revealStep > result.tallies.length;

    return (
      <div className="display-screen" style={{ padding: 32, gap: 0, overflow: 'hidden' }}>
        {/* Reveal step 0 — BLACK + "AND THE WINNER IS…" */}
        {!reducedMotion && revealStep === 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'var(--void)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 7vw, 100px)', color: 'var(--bone)', textAlign: 'center', lineHeight: 0.92 }}>
              AND THE<br /><span style={{ color: 'var(--pumpkin)' }}>WINNER IS…</span>
            </h1>
          </div>
        )}

        {/* Winner banner */}
        {winnerVisible && result.winners.length > 0 && (
          <div style={{ background: 'var(--pumpkin)', color: 'var(--void)', borderBottom: '4px solid var(--void)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {result.winners.map((wId) => {
                const opt = options.find((o) => o.id === wId);
                if (!opt) return null;
                const tally = result.tallies.find((t) => t.optionId === wId);
                return (
                  <div key={wId} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <img src={opt.imageUrl} alt={opt.title} style={{ width: 80, height: 80, objectFit: 'cover', border: '3px solid var(--void)' }} />
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 48px)', margin: 0, lineHeight: 0.9 }}>{opt.title}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, margin: '4px 0 0' }}>{tally?.count} VOTES · {tally?.percentage}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 64px)', letterSpacing: '0.04em' }}>
              {result.isTie ? '🔥 TIE 🔥' : '👑 WINNER'}
            </div>
          </div>
        )}

        {/* Ranking bars — revealed bottom to top, 1/sec */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '16px 0', overflowY: 'auto' }}>
          {sortedByRankAsc.slice(0, visibleCount).map((tally) => {
            const opt = options.find((o) => o.id === tally.optionId);
            const isWinner = result.winners.includes(tally.optionId);
            return (
              <div key={tally.optionId} className="result-bar" style={{ height: 64 }}>
                <div
                  className={`result-bar-fill`}
                  style={{ width: `${tally.percentage}%`, background: isWinner ? 'var(--pumpkin)' : 'var(--bone)', transition: 'width 800ms linear' }}
                />
                <span className="result-bar-label" style={{ fontSize: 'clamp(14px, 2vw, 20px)' }}>
                  {isWinner && '★ '}{opt?.label} — {opt?.title}
                </span>
                <span className="result-bar-pct" style={{ fontSize: 'clamp(14px, 2vw, 20px)' }}>
                  {tally.count} ({tally.percentage}%)
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '3px solid var(--bone)', padding: '12px 0', display: 'flex', gap: 32 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--ash)' }}>
            {result.totalVotes} VOTES CAST
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--ash)' }}>
            {result.totalParticipants} PARTICIPANTS
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--ash)' }}>
            {result.turnoutPercentage}% TURNOUT
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default BigScreen;
