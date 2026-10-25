import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Geometric flat Halloween SVG icons drawn strictly with straight-line polygons
 * adhering to Website Design Guide §5.5.
 */

/** Pumpkin: Bold octagon body + angled stem + deep carved jack-o'-lantern face */
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
    style={{ flexShrink: 0, ...style }}
    aria-hidden="true"
  >
    {/* Angular Stem */}
    <polygon points="27,3 37,3 35,12 29,12" fill={color} />
    {/* Wide Octagon Body */}
    <polygon
      points="16,12 48,12 60,24 60,46 48,58 16,58 4,46 4,24"
      fill={color}
    />
    {/*Fierce Angled Triangle Eyes */}
    <polygon points="14,25 28,29 17,35" fill="var(--void)" />
    <polygon points="50,25 36,29 47,35" fill="var(--void)" />
    {/* Center Triangular Nose */}
    <polygon points="32,31 27,39 37,39" fill="var(--void)" />
    {/* Bold Jagged Jack-O'-Lantern Grin */}
    <polygon
      points="
        13,43
        21,47
        26,42
        32,47
        38,42
        43,47
        51,43
        47,53
        39,50
        32,54
        25,50
        17,53
      "
      fill="var(--void)"
    />
  </svg>
);

/** Ghost: Chamfered shroud head + 4 deep jagged zig-zag teeth + hollow eyes & howling mouth */
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
    style={{ flexShrink: 0, ...style }}
    aria-hidden="true"
  >
    {/* Ghost shroud with sharp chamfered crown & deep 4-tooth zig-zag hem */}
    <polygon
      points="
        18,6
        46,6
        54,14
        54,58
        46,48
        39,58
        32,48
        25,58
        18,48
        10,58
        10,14
      "
      fill={color}
    />
    {/* Angled menacing eyes */}
    <polygon points="18,20 28,22 28,30 18,28" fill="var(--void)" />
    <polygon points="46,20 36,22 36,30 46,28" fill="var(--void)" />
    {/* Jagged howling mouth */}
    <polygon points="26,35 38,35 40,43 32,41 24,43" fill="var(--void)" />
  </svg>
);

/** Bat: Broad predatory vampire bat with wing hooks, 3-point scalloped membrane, ears & eyes */
export const BatIcon: React.FC<IconProps> = ({
  size = 32,
  color = 'currentColor',
  className = '',
  style,
}) => (
  <svg
    width={size}
    height={Math.round(size * 0.55)}
    viewBox="0 0 120 65"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ flexShrink: 0, ...style }}
    aria-hidden="true"
  >
    {/* Left Swept Wing (Wing thumb hook + 3 sharp scalloped tips) */}
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
    {/* Central Armored Torso, Pointed Vampire Ears & Forked Tail */}
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
    {/* Slanted Glowing Eyes */}
    <polygon points="52,21 58,24 53,27" fill="var(--void)" />
    <polygon points="68,21 62,24 67,27" fill="var(--void)" />
  </svg>
);

/** Skull: Brutalist cranium + sharp cheekbone cutouts + angled eye sockets + carved teeth */
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
    style={{ flexShrink: 0, ...style }}
    aria-hidden="true"
  >
    {/* Angular Cranium, Cheekbones & Jaw */}
    <polygon
      points="
        18,6
        46,6
        56,16
        56,34
        48,40
        46,40
        46,58
        18,58
        18,40
        16,40
        8,34
        8,16
      "
      fill={color}
    />
    {/* Temple / Brow Cutouts */}
    <polygon points="14,22 28,25 28,33 14,31" fill="var(--void)" />
    <polygon points="50,22 36,25 36,33 50,31" fill="var(--void)" />
    {/* Inverted Triangle Nasal Cavity */}
    <polygon points="32,33 27,42 37,42" fill="var(--void)" />
    {/* Bold Carved Teeth Separators */}
    <rect x="23" y="47" width="3" height="11" fill="var(--void)" />
    <rect x="30.5" y="47" width="3" height="11" fill="var(--void)" />
    <rect x="38" y="47" width="3" height="11" fill="var(--void)" />
  </svg>
);

/** Candle: Pillar body + actual geometric dripping wax notches + holder base + layered diamond flame */
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
    style={{ flexShrink: 0, ...style }}
    aria-hidden="true"
  >
    {/* Outer Diamond Flame */}
    <polygon points="32,2 40,14 32,22 24,14" fill="var(--pumpkin)" />
    {/* Inner Flame Core */}
    <polygon points="32,8 35,14 32,18 29,14" fill="var(--void)" />
    {/* Wick */}
    <rect x="30.5" y="21" width="3" height="4" fill={color} />
    {/* Candle Pillar */}
    <polygon points="20,25 44,25 44,54 20,54" fill={color} />
    {/* Geometric Wax Drip Cutouts (Left & Right) */}
    <polygon
      points="20,29 26,29 26,41 23,44 20,41"
      fill="var(--void)"
    />
    <polygon
      points="34,29 40,29 40,36 37,39 34,36"
      fill="var(--void)"
    />
    {/* Altar Holder Base Plate */}
    <polygon points="12,54 52,54 55,60 9,60" fill={color} />
  </svg>
);
