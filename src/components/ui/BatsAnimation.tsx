import React, { useEffect, useRef, useState } from 'react';

/**
 * Flat geometric SVG bat (Design Guide §5.5 — Straight-line angular wing silhouette).
 * Alternates between two sharp brutalist wing frames using stepped mechanical motion (§5.7).
 */
export const BatSvg: React.FC<{
  size?: number;
  color?: string;
  eyeColor?: string;
  flapSpeedMs?: number;
}> = ({
  size = 56,
  color = 'var(--bone)',
  eyeColor = 'var(--pumpkin)',
  flapSpeedMs = 360,
}) => (
  <svg
    width={size}
    height={size * 0.54}
    viewBox="0 0 120 65"
    fill={color}
    aria-hidden="true"
    style={{ display: 'block', overflow: 'visible' }}
  >
    {/* ================= WINGS: UPSTROKE FRAME ================= */}
    <g
      style={{
        animation: `bat-wing-up ${flapSpeedMs}ms steps(2, end) infinite`,
        transformOrigin: '60px 32px',
      }}
    >
      {/* Left Swept Wing (Broad 3-Scallop Geometric Membrane + Wing Hook) */}
      <polygon
        points="
          50,24
          36,12
          33,5
          30,13
          2,4
          10,24
          20,21
          24,36
          35,31
          41,44
          51,38
        "
      />
      {/* Right Swept Wing */}
      <polygon
        points="
          70,24
          84,12
          87,5
          90,13
          118,4
          110,24
          100,21
          96,36
          85,31
          79,44
          69,38
        "
      />
    </g>

    {/* ================= WINGS: DOWNSTROKE FRAME ================= */}
    <g
      style={{
        animation: `bat-wing-down ${flapSpeedMs}ms steps(2, end) infinite`,
        transformOrigin: '60px 32px',
      }}
    >
      {/* Left Diving Wing */}
      <polygon
        points="
          50,26
          36,20
          33,15
          30,22
          4,32
          16,46
          26,39
          31,52
          41,44
          46,54
          52,40
        "
      />
      {/* Right Diving Wing */}
      <polygon
        points="
          70,26
          84,20
          87,15
          90,22
          116,32
          104,46
          94,39
          89,52
          79,44
          74,54
          68,40
        "
      />
    </g>

    {/* ================= CENTRAL ARMORED TORSO, HEAD & EARS ================= */}
    {/* Tall Pointed Vampire Ears + Broad Chest + Forked Tail */}
    <polygon
      points="
        52,20
        48,5
        56,15
        60,17
        64,15
        72,5
        68,20
        72,28
        69,43
        64,56
        60,49
        56,56
        51,43
        48,28
      "
    />

    {/* Inner Chest Armor Cutout (Adds sharp brutalist depth) */}
    <polygon points="55,33 60,37 65,33 63,43 60,40 57,43" fill="var(--void)" />

    {/* Glowing Angular Eyes */}
    <polygon points="52,21 58,24 53,27" fill={eyeColor} />
    <polygon points="68,21 62,24 67,27" fill={eyeColor} />

    {/* Tiny Geometric Fangs */}
    <polygon points="56,29 58,32 59,29" fill="var(--void)" />
    <polygon points="64,29 62,32 61,29" fill="var(--void)" />
  </svg>
);

interface Bat {
  id: number;
  y: number;
  duration: number;
  size: number;
  flip: boolean;
  flapSpeed: number;
  accent: boolean;
}

/** Occasionally floats geometric flat SVG bats across the screen (Home & Result screens only — §5.5) */
const BatsAnimation: React.FC = () => {
  const [bats, setBats] = useState<Bat[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    // Respect reduced motion (§5.7)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const spawnBat = () => {
      const id = idRef.current++;
      const bat: Bat = {
        id,
        y: 8 + Math.random() * 58, // % from top
        duration: 7500 + Math.random() * 5000,
        size: 46 + Math.random() * 34, // Well-fed 46px–80px wingspan
        flip: Math.random() > 0.5,
        flapSpeed: 300 + Math.floor(Math.random() * 140),
        accent: Math.random() > 0.72, // Occasional pumpkin-tinted alpha bat
      };
      setBats((prev) => [...prev, bat]);
      setTimeout(() => {
        setBats((prev) => prev.filter((b) => b.id !== id));
      }, bat.duration + 250);
    };

    // Spawn a bat every 3.5–8 seconds
    const interval = setInterval(spawnBat, 3500 + Math.random() * 4500);
    // Spawn initial pair quickly so the stage feels alive immediately
    const first = setTimeout(spawnBat, 700);
    const second = setTimeout(spawnBat, 2200);

    return () => {
      clearInterval(interval);
      clearTimeout(first);
      clearTimeout(second);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {bats.map((bat) => (
        <div
          key={bat.id}
          style={{
            position: 'absolute',
            top: `${bat.y}%`,
            left: 0,
            animation: `${bat.flip ? 'bat-fly-left' : 'bat-fly-right'} ${bat.duration}ms linear forwards`,
            opacity: bat.accent ? 0.26 : 0.18,
            filter: `drop-shadow(4px 4px 0 var(--void))`,
          }}
        >
          <div
            style={{
              animation: `bat-bob ${bat.flapSpeed * 3}ms steps(4, end) infinite`,
            }}
          >
            <BatSvg
              size={bat.size}
              color={bat.accent ? 'var(--pumpkin)' : 'var(--bone)'}
              eyeColor={bat.accent ? 'var(--void)' : 'var(--pumpkin)'}
              flapSpeedMs={bat.flapSpeed}
            />
          </div>
        </div>
      ))}

      <style>{`
        @keyframes bat-wing-up {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes bat-wing-down {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes bat-bob {
          0%   { transform: translateY(0px); }
          25%  { transform: translateY(-7px); }
          50%  { transform: translateY(0px); }
          75%  { transform: translateY(7px); }
          100% { transform: translateY(0px); }
        }
        @keyframes bat-fly-right {
          from { transform: translateX(-140px) scaleX(1); }
          to   { transform: translateX(calc(100vw + 140px)) scaleX(1); }
        }
        @keyframes bat-fly-left {
          from { transform: translateX(calc(100vw + 140px)) scaleX(-1); }
          to   { transform: translateX(-140px) scaleX(-1); }
        }
      `}</style>
    </div>
  );
};

export default BatsAnimation;
