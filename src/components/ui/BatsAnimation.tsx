import React, { useEffect, useRef, useState } from 'react';

/** Flat geometric SVG bat that glides across the screen */
const BatSvg: React.FC<{ size?: number; color?: string }> = ({ size = 40, color = 'var(--bone)' }) => (
  <svg
    width={size}
    height={size * 0.5}
    viewBox="0 0 80 40"
    fill={color}
    aria-hidden="true"
  >
    {/* Body */}
    <rect x="34" y="14" width="12" height="12" />
    {/* Left wing */}
    <polygon points="0,8 34,14 34,26 10,30 0,20" />
    {/* Right wing */}
    <polygon points="80,8 46,14 46,26 70,30 80,20" />
    {/* Ears */}
    <polygon points="34,14 36,6 38,14" />
    <polygon points="46,14 44,6 42,14" />
    {/* Eyes */}
    <rect x="37" y="16" width="3" height="3" fill="var(--void)" />
    <rect x="42" y="16" width="3" height="3" fill="var(--void)" />
  </svg>
);

interface Bat {
  id: number;
  y: number;
  delay: number;
  duration: number;
  size: number;
  flip: boolean;
}

/** Occasionally floats geometric flat SVG bats across the screen */
const BatsAnimation: React.FC = () => {
  const [bats, setBats] = useState<Bat[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    // Respect reduced motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const spawnBat = () => {
      const id = idRef.current++;
      const bat: Bat = {
        id,
        y: 10 + Math.random() * 50,       // % from top
        delay: 0,
        duration: 8000 + Math.random() * 6000,
        size: 32 + Math.random() * 28,
        flip: Math.random() > 0.5,
      };
      setBats((prev) => [...prev, bat]);
      setTimeout(() => {
        setBats((prev) => prev.filter((b) => b.id !== id));
      }, bat.duration + 200);
    };

    // Spawn a bat every 4–10 seconds
    const interval = setInterval(spawnBat, 4000 + Math.random() * 6000);
    // First bat quickly
    const first = setTimeout(spawnBat, 1500);

    return () => { clearInterval(interval); clearTimeout(first); };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}
    >
      {bats.map((bat) => (
        <div
          key={bat.id}
          style={{
            position: 'absolute',
            top: `${bat.y}%`,
            left: bat.flip ? '105%' : '-10%',
            transform: bat.flip ? 'scaleX(-1)' : 'none',
            animation: `bat-fly ${bat.duration}ms linear forwards`,
            opacity: 0.25,
          }}
        >
          <BatSvg size={bat.size} />
        </div>
      ))}
      <style>{`
        @keyframes bat-fly {
          from { transform: translateX(0) ${''} scaleX(${bats[0]?.flip ? -1 : 1}); }
          to   { transform: translateX(${bats[0]?.flip ? '-200vw' : '120vw'}); }
        }
      `}</style>
    </div>
  );
};

export default BatsAnimation;
