// Gemalte Tal-Landschaft als SVG: sanfte Hügel, runde Bäume, ein Bach, kleine Häuser
// und in der Mitte die Baustelle des Tal-Monuments.

function Tree({ x, y, s = 1, c = '#79b84a' }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-2.5" y="-4" width="5" height="16" rx="2" fill="#7b5232" />
      <circle cx="0" cy="-14" r="13" fill={c} />
      <circle cx="-8" cy="-8" r="9" fill={c} />
      <circle cx="8" cy="-8" r="9" fill={c} />
      <circle cx="-4" cy="-19" r="5" fill="#fff" opacity="0.18" />
    </g>
  );
}

function Hut({ x, y, s = 1, roof = '#cf6a3d' }: { x: number; y: number; s?: number; roof?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-14" y="-16" width="28" height="18" fill="#f6eedb" stroke="#6e4a2d" strokeWidth="2" />
      <path d="M-14 -7H14M-14 -16V2M14 -16V2" stroke="#6e4a2d" strokeWidth="2" />
      <path d="M-19 -15 L0 -32 L19 -15 Z" fill={roof} stroke="#8a3e1f" strokeWidth="2" strokeLinejoin="round" />
      <rect x="-4" y="-9" width="8" height="11" fill="#7a4b2a" />
      <rect x="6" y="-13" width="5" height="5" fill="#ffd98a" />
      <rect x="6" y="-30" width="5" height="9" fill="#bdb3a4" />
      <circle cx="9" cy="-36" r="3.5" fill="#fff" opacity="0.8" />
      <circle cx="12" cy="-42" r="4.5" fill="#fff" opacity="0.55" />
    </g>
  );
}

export function ValleyScenery({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 220" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="sv-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cdeaf0" stopOpacity="0" />
          <stop offset="0.45" stopColor="#d9eff0" stopOpacity="0.6" />
          <stop offset="0.75" stopColor="#eef4e6" />
          <stop offset="1" stopColor="#fbf0d2" />
        </linearGradient>
        <radialGradient id="sv-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.5" stopColor="#ffe48a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffe48a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sv-river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fe0ea" />
          <stop offset="1" stopColor="#4aa7bd" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#sv-sky)" />
      <circle cx="660" cy="52" r="70" fill="url(#sv-sun)" />
      <circle cx="660" cy="52" r="22" fill="#fff4c0" />
      {/* Wolken */}
      <g fill="#fff" opacity="0.95">
        <ellipse cx="140" cy="50" rx="44" ry="14" />
        <circle cx="122" cy="42" r="16" />
        <circle cx="152" cy="38" r="19" />
        <ellipse cx="460" cy="34" rx="34" ry="10" />
        <circle cx="450" cy="28" r="12" />
        <circle cx="472" cy="26" r="14" />
      </g>
      {/* ferne Hügel */}
      <path d="M0 140 C90 100 170 108 250 128 C330 92 430 88 520 120 C600 96 700 98 800 124 V220 H0Z" fill="#b8d98a" />
      <path d="M0 160 C110 128 220 134 330 152 C430 126 540 128 640 150 C710 136 760 138 800 146 V220 H0Z" fill="#9fcd5d" />
      {/* Bach */}
      <path d="M520 220 C500 196 560 186 540 170 C520 156 590 150 600 140" stroke="url(#sv-river)" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M520 214 C510 198 552 188 536 172" stroke="#fff" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="6 10" />
      {/* vordere Wiese */}
      <path d="M0 186 C120 164 260 170 380 182 C500 166 640 168 800 184 V220 H0Z" fill="#8fc458" />
      {/* Monument-Baustelle */}
      <g transform="translate(400 164)">
        <rect x="-36" y="-34" width="72" height="34" fill="#e8dcc2" stroke="#8a5a34" strokeWidth="2" />
        <path d="M-44 -34 L0 -62 L44 -34 Z" fill="#f2bb45" stroke="#93621a" strokeWidth="2" strokeLinejoin="round" />
        <rect x="-10" y="-22" width="20" height="22" rx="10" fill="#7a4b2a" />
        <path d="M-52 2 V-70 M-52 -70 H-14 M-26 -70 V-52" stroke="#8a5a34" strokeWidth="3" fill="none" />
        <rect x="-31" y="-52" width="10" height="8" fill="#bdb3a4" stroke="#6f6559" strokeWidth="1.5" />
        <path d="M-44 -40 L44 -40" stroke="#fff" strokeWidth="1.5" opacity="0.4" />
      </g>
      <Hut x={240} y={184} s={1} />
      <Hut x={590} y={186} s={0.9} roof="#d9b25f" />
      <Hut x={120} y={192} s={0.8} roof="#b3552d" />
      <Tree x={40} y={184} s={1.1} />
      <Tree x={300} y={180} s={0.9} c="#8cc653" />
      <Tree x={480} y={182} s={1} c="#69a83f" />
      <Tree x={690} y={186} s={1.2} />
      <Tree x={760} y={182} s={0.8} c="#9fcd5d" />
      <Tree x={180} y={176} s={0.7} c="#69a83f" />
      {/* Blumen */}
      <g>
        {[30, 90, 160, 330, 360, 450, 640, 720, 780].map((x, i) => (
          <circle key={x} cx={x} cy={204 + (i % 3) * 4} r="3" fill={['#f6a6b8', '#fbe27a', '#fff'][i % 3]} />
        ))}
      </g>
    </svg>
  );
}
