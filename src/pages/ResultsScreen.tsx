import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RotateCcw, Download, FileImage, Plus, Crown, Flame } from 'lucide-react';
import BatsAnimation from '../components/ui/BatsAnimation';
import {
  subscribeToPoll,
  subscribeToOptions,
  subscribeToParticipants,
  subscribeToVotes,
  computeResults,
  exportResultsCSV,
} from '../firebase/pollService';
import { exportResultPNG } from '../utils/canvasExport';
import type { Poll, PollOption, Participant, Vote } from '../types/poll';
import { getMyVote } from '../firebase/pollService';
import { getDeviceToken } from '../utils/device';
import { playCreak, playSting, playTick } from '../utils/audio';

const ResultsScreen: React.FC = () => {
  const { pollId }    = useParams<{ pollId: string }>();
  const navigate      = useNavigate();
  const deviceToken   = getDeviceToken();

  const [poll, setPoll]             = useState<Omit<Poll, 'options'> | null>(null);
  const [options, setOptions]       = useState<PollOption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes]           = useState<Vote[]>([]);
  const [myVoteIds, setMyVoteIds]   = useState<string[]>([]);
  const [revealStep, setRevealStep] = useState(-1);
  const hasStartedReveal = useRef(false);

  useEffect(() => {
    if (!pollId) return;
    const u1 = subscribeToPoll(pollId, setPoll);
    const u2 = subscribeToOptions(pollId, setOptions);
    const u3 = subscribeToParticipants(pollId, setParticipants);
    const u4 = subscribeToVotes(pollId, setVotes);
    getMyVote(pollId, deviceToken).then((v) => setMyVoteIds(v?.optionIds ?? []));
    return () => { u1(); u2(); u3(); u4(); };
  }, [pollId, deviceToken]);

  const result = useMemo(() => {
    if (options.length === 0) return null;
    return computeResults(votes, options, participants.length, poll?.decidedWinnerId);
  }, [votes, options, participants.length, poll?.decidedWinnerId]);

  // Auto-start reveal sequence once results are loaded
  useEffect(() => {
    if (result && !hasStartedReveal.current && poll?.status === 'revealed') {
      hasStartedReveal.current = true;
      const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!isReduced) playCreak();
      setRevealStep(isReduced ? 999 : 0);
    }
  }, [result, poll?.status]);

  // Reveal animation sequence
  useEffect(() => {
    if (revealStep < 0 || revealStep >= 999 || !result) return;

    const totalSteps = result.tallies.length + 1;
    if (revealStep < totalSteps) {
      if (revealStep > 0) playTick();
      const t = setTimeout(() => setRevealStep((s) => s + 1), revealStep === 0 ? 1500 : 900);
      return () => clearTimeout(t);
    }
    if (revealStep === totalSteps) {
      setTimeout(() => playSting(), 200);
    }
  }, [revealStep, result]);

  if (!pollId) return null;

  const replayReveal = () => {
    hasStartedReveal.current = false;
    const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isReduced) playCreak();
    setRevealStep(isReduced ? 999 : 0);
  };

  if (!poll || !result || !options.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--ash)', fontSize: 20 }}>LOADING RESULTS…</p>
      </div>
    );
  }

  if (poll.status !== 'revealed') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--void)', flexDirection: 'column', gap: 16, padding: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--bone)', textAlign: 'center' }}>RESULTS NOT YET REVEALED</h1>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ash)' }}>The host hasn't revealed the result yet. Stay tuned.</p>
      </div>
    );
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sortedAsc     = [...result.tallies].reverse();
  const visibleCount  = reducedMotion ? sortedAsc.length : Math.max(0, revealStep - 1);
  const winnerVisible = reducedMotion || revealStep > result.tallies.length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <BatsAnimation />

      {/* Reveal step 0 — fullscreen black overlay */}
      {!reducedMotion && revealStep === 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--void)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 7vw, 80px)', color: 'var(--bone)', textAlign: 'center', lineHeight: 0.92 }}>
            AND THE<br /><span style={{ color: 'var(--pumpkin)' }}>WINNER IS…</span>
          </h1>
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: '3px solid var(--bone)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 4vw, 28px)', color: 'var(--bone)', margin: 0, flex: 1 }}>
          {poll.title} — RESULTS
        </h1>
        <button className="btn-ghost" onClick={replayReveal} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <RotateCcw size={14} /> REPLAY
        </button>
        <button className="btn-ghost" onClick={() => exportResultsCSV({ ...poll, options } as Poll, result)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> CSV
        </button>
        <button className="btn-ghost" onClick={() => exportResultPNG({ ...poll, options } as Poll, result)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileImage size={14} /> SHAREABLE PNG
        </button>
        <button className="btn-secondary" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> NEW POLL
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        {/* Zero votes edge case */}
        {result.totalVotes === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 6vw, 64px)', color: 'var(--pumpkin)', marginBottom: 16 }}>
              NOBODY VOTED. SPOOKY.
            </h2>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--ash)', marginBottom: 32 }}>
              THE DEAD REMAIN SILENT.
            </p>
            <button className="btn-secondary" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> CREATE NEW POLL
            </button>
          </div>
        ) : (
          <>
            {/* Winner block */}
        {winnerVisible && (
          <div style={{ padding: '24px 24px 0' }}>
            {result.isTie && (
              <div style={{ border: '3px solid var(--witch)', background: 'var(--ink)', padding: '8px 16px', marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--witch)', margin: 0 }}>
                  A TIE. THE DEAD CANNOT DECIDE.
                </p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
              {result.winners.map((wId) => {
                const opt   = options.find((o) => o.id === wId);
                const tally = result.tallies.find((t) => t.optionId === wId);
                if (!opt) return null;
                return (
                  <div key={wId} style={{ background: 'var(--pumpkin)', border: '4px solid var(--void)', boxShadow: '8px 8px 0 var(--bone)' }}>
                    <div style={{ padding: '8px 16px', background: 'var(--void)', borderBottom: '4px solid var(--void)' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--pumpkin)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {result.isTie ? (
                          <>
                            <Flame size={22} /> TIE
                          </>
                        ) : (
                          <>
                            <Crown size={22} /> WINNER
                          </>
                        )}
                      </span>
                    </div>
                    <img src={opt.imageUrl} alt={opt.title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '12px 16px', background: 'var(--void)', borderTop: '4px solid var(--void)' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--bone)', margin: 0, textTransform: 'uppercase' }}>
                        {opt.label} — {opt.title}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--pumpkin)', margin: '8px 0 0' }}>
                        {tally?.count} VOTES · {tally?.percentage}%
                      </p>
                      {myVoteIds.includes(opt.id) && (
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--toxic)', marginTop: 6 }}>★ YOUR VOTE</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ranking bars */}
        <div style={{ padding: '0 24px 24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ash)', marginBottom: 12 }}>FULL RANKINGS</h2>
          {sortedAsc.slice(0, visibleCount).map((tally) => {
            const opt      = options.find((o) => o.id === tally.optionId);
            const isWinner = result.winners.includes(tally.optionId);
            const isMyVote = myVoteIds.includes(tally.optionId);
            return (
              <div key={tally.optionId} className="result-bar" style={{ height: 56, marginBottom: 8 }}>
                <div
                  className="result-bar-fill"
                  style={{ width: `${tally.percentage}%`, background: isWinner ? 'var(--pumpkin)' : 'var(--bone)', transition: 'width 800ms linear' }}
                />
                <span className="result-bar-label">
                  {isWinner && '★ '}{opt?.label} — {opt?.title}{isMyVote ? ' (yours)' : ''}
                </span>
                <span className="result-bar-pct">{tally.count} ({tally.percentage}%)</span>
              </div>
            );
          })}
        </div>

        {/* Footer stats */}
        {winnerVisible && (
          <div style={{ borderTop: '3px solid var(--bone)', padding: '16px 24px', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Total Votes</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--bone)', margin: 0 }}>{result.totalVotes}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Participants</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--bone)', margin: 0 }}>{result.totalParticipants}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ash)', margin: '0 0 4px', textTransform: 'uppercase' }}>Turnout</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--bone)', margin: 0 }}>{result.turnoutPercentage}%</p>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsScreen;
