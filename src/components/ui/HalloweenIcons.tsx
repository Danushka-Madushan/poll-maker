import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Geometric flat Halloween SVG icons drawn with straight lines and single color
 * adhering strictly to Website Design Guide § 5.5.
 */

/** Pumpkin: Octagon body + stem + angular notch cut face */
export const PumpkinIcon: React.FC<IconProps> = ({
  size = 32,
  color = 'currentColor',
  className = '',
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {/* Stem */}
    <rect x="29" y="4" width="6" height="10" fill={color} />
    {/* Octagon body */}
    <polygon
      points="20,14 44,14 56,26 56,42 44,54 20,54 8,42 8,26"
      fill={color}
    />
    {/* Eyes (angled void triangles/rectangles) */}
    <polygon points="20,28 26,24 26,32" fill="var(--void)" />
    <polygon points="44,28 38,24 38,32" fill="var(--void)" />
    {/* Nose */}
    <polygon points="32,32 29,38 35,38" fill="var(--void)" />
    {/* Jagged mouth */}
    <polygon
      points="20,44 24,42 28,46 32,42 36,46 40,42 44,44 40,48 36,45 32,49 28,45 24,48"
      fill="var(--void)"
    />
  </svg>
);

/** Ghost: Rectangle head + torso + sharp zig-zag teeth base + square eyes */
export const GhostIcon: React.FC<IconProps> = ({
  size = 32,
  color = 'currentColor',
  className = '',
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {/* Ghost body with jagged zig-zag base */}
    <polygon
      points="12,16 20,8 44,8 52,16 52,52 44,44 36,52 28,44 20,52 12,44"
      fill={color}
    />
    {/* Flat square eyes */}
    <rect x="22" y="22" width="6" height="8" fill="var(--void)" />
    <rect x="36" y="22" width="6" height="8" fill="var(--void)" />
    {/* O-shaped mouth */}
    <rect x="29" y="34" width="6" height="6" fill="var(--void)" />
  </svg>
);

/** Bat: Angular silhouette wings + ears + eyes */
export const BatIcon: React.FC<IconProps> = ({
  size = 32,
  color = 'currentColor',
  className = '',
  style,
}) => (
  <svg
    width={size}
    height={Math.round(size * 0.5)}
    viewBox="0 0 64 32"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {/* Body */}
    <rect x="28" y="10" width="8" height="12" />
    {/* Left angular wing */}
    <polygon points="0,6 28,10 28,20 8,24 0,16" />
    {/* Right angular wing */}
    <polygon points="64,6 36,10 36,20 56,24 64,16" />
    {/* Ears */}
    <polygon points="28,10 30,4 32,10" />
    <polygon points="36,10 34,4 32,10" />
  </svg>
);

/** Skull: Angular cranium + square eye sockets + tooth notches */
export const SkullIcon: React.FC<IconProps> = ({
  size = 32,
  color = 'currentColor',
  className = '',
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {/* Cranium & jaw polygon */}
    <polygon
      points="16,16 26,8 38,8 48,16 52,30 46,42 42,42 42,54 22,54 22,42 18,42 12,30"
      fill={color}
    />
    {/* Square eye sockets */}
    <rect x="20" y="24" width="8" height="8" fill="var(--void)" />
    <rect x="36" y="24" width="8" height="8" fill="var(--void)" />
    {/* Inverted triangle nasal cavity */}
    <polygon points="32,34 29,40 35,40" fill="var(--void)" />
    {/* Teeth notches */}
    <rect x="26" y="46" width="3" height="8" fill="var(--void)" />
    <rect x="31" y="46" width="2" height="8" fill="var(--void)" />
    <rect x="35" y="46" width="3" height="8" fill="var(--void)" />
  </svg>
);

/** Candle: Rectangle body + dripping wax notches + diamond flame */
export const CandleIcon: React.FC<IconProps> = ({
  size = 32,
  color = 'currentColor',
  className = '',
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {/* Candle pillar */}
    <polygon points="22,24 42,24 42,56 22,56" fill={color} />
    {/* Base plate */}
    <rect x="14" y="56" width="36" height="4" fill={color} />
    {/* Wick */}
    <rect x="31" y="18" width="2" height="6" fill={color} />
    {/* Diamond flame */}
    <polygon points="32,4 37,14 32,18 27,14" fill="var(--pumpkin)" />
  </svg>
);
