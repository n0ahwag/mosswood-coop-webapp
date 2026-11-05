import { useId, type ReactNode } from 'react';

// Handgezeichnete, plastisch wirkende Rohstoff-Icons (Verläufe + Glanzlichter).

function Shadow() {
  return <ellipse cx="24" cy="42" rx="15" ry="3.4" fill="#3a2a1d" opacity="0.18" />;
}

function icon(resource: string, id: (name: string) => string): ReactNode {
  const url = (name: string) => `url(#${id(name)})`;
  switch (resource) {
    case 'wood':
      return (
        <>
          <defs>
            <linearGradient id={id('bark')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c48b55" />
              <stop offset="1" stopColor="#6e4628" />
            </linearGradient>
            <radialGradient id={id('ring')} cx="0.45" cy="0.4" r="0.7">
              <stop offset="0" stopColor="#f6d7a4" />
              <stop offset="1" stopColor="#d8a46a" />
            </radialGradient>
          </defs>
          <Shadow />
          <rect x="5" y="16" width="33" height="19" rx="9.5" fill={url('bark')} stroke="#5a3820" strokeWidth="1.5" />
          <path d="M11 22h14M9 28h18M14 32h9" stroke="#5a3820" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          <rect x="10" y="18.5" width="20" height="2.6" rx="1.3" fill="#fff" opacity="0.28" />
          <ellipse cx="37" cy="25.5" rx="6.5" ry="9.5" fill={url('ring')} stroke="#5a3820" strokeWidth="1.5" />
          <ellipse cx="37" cy="25.5" rx="3.6" ry="5.6" fill="none" stroke="#b98250" strokeWidth="1.2" />
          <ellipse cx="37" cy="25.5" rx="1.3" ry="2" fill="#b98250" />
        </>
      );
    case 'stone':
      return (
        <>
          <defs>
            <radialGradient id={id('g')} cx="0.38" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#efe9df" />
              <stop offset="0.55" stopColor="#bdb3a4" />
              <stop offset="1" stopColor="#857a6c" />
            </radialGradient>
          </defs>
          <Shadow />
          <path d="M7 35c-2-8 3-17 12-19.5 7-2 13 0 17 4.5 4 4.5 5 10 3 14.5-1 2-3 3-5 3H11c-2 0-3.5-1-4-2.5z" fill={url('g')} stroke="#6f6559" strokeWidth="1.5" />
          <path d="M27 21l-3 6 3 4" fill="none" stroke="#6f6559" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
          <ellipse cx="17" cy="22" rx="5" ry="2.6" fill="#fff" opacity="0.4" transform="rotate(-25 17 22)" />
        </>
      );
    case 'clay':
      return (
        <>
          <defs>
            <radialGradient id={id('g')} cx="0.4" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#e5a77c" />
              <stop offset="0.6" stopColor="#b8724a" />
              <stop offset="1" stopColor="#874c2e" />
            </radialGradient>
          </defs>
          <Shadow />
          <path d="M6 36c0-6 4-10 8.5-11 1-6.5 6-10.5 11.5-9.5 6 1 9 6 9 10.5 4.5 1 7.5 4.5 7.5 8.5 0 2-2 3.5-4 3.5H9.5C7.5 38 6 37.5 6 36z" fill={url('g')} stroke="#6e3c22" strokeWidth="1.5" />
          <ellipse cx="22" cy="21" rx="4.5" ry="2.2" fill="#fff" opacity="0.35" transform="rotate(-20 22 21)" />
          <path d="M15 30c3 1.5 7 1.5 10 0" stroke="#6e3c22" strokeWidth="1.2" fill="none" opacity="0.45" strokeLinecap="round" />
        </>
      );
    case 'berries':
      return (
        <>
          <defs>
            <radialGradient id={id('b')} cx="0.35" cy="0.3" r="0.75">
              <stop offset="0" stopColor="#a3a7ff" />
              <stop offset="0.6" stopColor="#5b5fc7" />
              <stop offset="1" stopColor="#34368a" />
            </radialGradient>
          </defs>
          <Shadow />
          <path d="M24 13c-1-4 1-7 4-8" stroke="#5d7a32" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M25 11c4-5 11-5 14-2-4 4-10 5-14 2z" fill="#7fb64a" stroke="#4f7429" strokeWidth="1.2" />
          {[[17, 29], [31, 29], [24, 19]].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="8.5" fill={url('b')} stroke="#2c2d70" strokeWidth="1.3" />
              <circle cx={cx - 3} cy={cy - 3} r="2.2" fill="#fff" opacity="0.7" />
            </g>
          ))}
        </>
      );
    case 'wheat':
      return (
        <>
          <defs>
            <linearGradient id={id('g')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe38a" />
              <stop offset="1" stopColor="#d79f2e" />
            </linearGradient>
          </defs>
          <Shadow />
          {[[-10, 12], [0, 7], [10, 12]].map(([dx, top]) => (
            <g key={dx}>
              <path d={`M24 40 Q${24 + dx * 0.4} 28 ${24 + dx} ${top + 8}`} stroke="#c99a3a" strokeWidth="2" fill="none" />
              {[0, 1, 2, 3].map((k) => (
                <ellipse
                  key={k}
                  cx={24 + dx + (k % 2 ? 2.6 : -2.6) * (1 - k * 0.15)}
                  cy={top + 4 + k * 3.6}
                  rx="2.6"
                  ry="4"
                  fill={url('g')}
                  stroke="#a8762a"
                  strokeWidth="0.9"
                  transform={`rotate(${k % 2 ? 25 : -25} ${24 + dx} ${top + 4 + k * 3.6})`}
                />
              ))}
              <ellipse cx={24 + dx} cy={top + 1.5} rx="2" ry="3.4" fill={url('g')} stroke="#a8762a" strokeWidth="0.9" />
            </g>
          ))}
          <rect x="17" y="29" width="14" height="4.5" rx="2" fill="#c4613f" stroke="#8a3e25" strokeWidth="1.1" />
        </>
      );
    case 'fiber':
      return (
        <>
          <Shadow />
          {[
            ['#9fc27c', 'M12 38 C14 26 13 16 9 8'],
            ['#c8d79a', 'M18 39 C19 26 19 15 17 6'],
            ['#8fb36d', 'M24 39 C24 26 25 15 27 6'],
            ['#d6cf98', 'M30 39 C29 27 31 16 35 8'],
            ['#a9c48a', 'M36 38 C34 27 36 18 41 11'],
          ].map(([color, d]) => (
            <path key={d} d={d} stroke={color} strokeWidth="3.6" fill="none" strokeLinecap="round" />
          ))}
          <path d="M13 26 Q24 31 35 26" stroke="#7a5a3d" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M14 25 Q24 29 34 25" stroke="#a87b52" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      );
    case 'planks':
      return (
        <>
          <Shadow />
          {[10, 0].map((dy, i) => (
            <g key={dy} transform={`translate(0 ${dy})`}>
              <polygon points="5,21 29,13 43,19 19,27" fill={i ? '#f0c58c' : '#e8b679'} stroke="#7a4f2a" strokeWidth="1.3" strokeLinejoin="round" />
              <polygon points="5,21 19,27 19,31.5 5,25.5" fill="#b98250" stroke="#7a4f2a" strokeWidth="1.3" strokeLinejoin="round" />
              <polygon points="19,27 43,19 43,23.5 19,31.5" fill="#cf9a5f" stroke="#7a4f2a" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M12 20 L30 14.5 M17 23 L35 17" stroke="#b98250" strokeWidth="0.9" opacity="0.7" />
            </g>
          ))}
        </>
      );
    case 'bricks':
      return (
        <>
          <defs>
            <linearGradient id={id('f')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e5805a" />
              <stop offset="1" stopColor="#b4502f" />
            </linearGradient>
          </defs>
          <Shadow />
          {[[6, 27], [24, 27], [15, 16]].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <polygon points={`${x},${y} ${x + 4},${y - 4} ${x + 22},${y - 4} ${x + 18},${y}`} fill="#ef9a74" stroke="#7d3520" strokeWidth="1.2" strokeLinejoin="round" />
              <rect x={x} y={y} width="18" height="10" fill={url('f')} stroke="#7d3520" strokeWidth="1.2" />
              <polygon points={`${x + 18},${y} ${x + 22},${y - 4} ${x + 22},${y + 6} ${x + 18},${y + 10}`} fill="#a1462a" stroke="#7d3520" strokeWidth="1.2" strokeLinejoin="round" />
              <rect x={x + 2} y={y + 2} width="9" height="1.8" rx="0.9" fill="#fff" opacity="0.3" />
            </g>
          ))}
        </>
      );
    case 'cloth':
      return (
        <>
          <defs>
            <linearGradient id={id('g')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f39c88" />
              <stop offset="1" stopColor="#c45e4c" />
            </linearGradient>
          </defs>
          <Shadow />
          <path d="M10 33 L30 33 L38 39 L14 39 Z" fill="#e8d6b0" stroke="#9a7a4e" strokeWidth="1.2" strokeLinejoin="round" />
          <rect x="7" y="15" width="28" height="18" rx="9" fill={url('g')} stroke="#8a3a2e" strokeWidth="1.5" />
          {[13, 19, 25].map((x) => (
            <rect key={x} x={x} y="15.6" width="2.6" height="16.8" fill="#fbe7c8" opacity="0.85" />
          ))}
          <ellipse cx="35" cy="24" rx="5.5" ry="9" fill="#e27d6a" stroke="#8a3a2e" strokeWidth="1.5" />
          <path d="M35 19c2.5 0 3 3 0 5s-2.5 4 0 4" stroke="#8a3a2e" strokeWidth="1.2" fill="none" />
          <rect x="10" y="17.4" width="18" height="2.4" rx="1.2" fill="#fff" opacity="0.3" />
        </>
      );
    case 'meals':
      return (
        <>
          <defs>
            <radialGradient id={id('crust')} cx="0.45" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#fbd88a" />
              <stop offset="1" stopColor="#d08b34" />
            </radialGradient>
          </defs>
          <Shadow />
          <ellipse cx="24" cy="33" rx="19" ry="7" fill="#f6efe2" stroke="#b9a98a" strokeWidth="1.3" />
          <path d="M8 28 L8 31 C8 35 15 38 24 38 C33 38 40 35 40 31 L40 28" fill="#b9732f" stroke="#7a4a20" strokeWidth="1.3" />
          <ellipse cx="24" cy="27.5" rx="16" ry="7.5" fill={url('crust')} stroke="#7a4a20" strokeWidth="1.3" />
          <path d="M14 25 L30 32 M20 22.5 L36 29.5 M14 30 L30 23 M19 32.5 L35 25.5" stroke="#b46d28" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
          <ellipse cx="19" cy="24.5" rx="4" ry="1.6" fill="#fff" opacity="0.35" />
          <path d="M19 15c-2-2 2-4 0-7M25 14c-2-2 2-4 0-7M31 15c-2-2 2-4 0-7" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8" />
        </>
      );
    default:
      return (
        <>
          <Shadow />
          <circle cx="24" cy="24" r="14" fill="#e9d6ad" stroke="#8a5a34" strokeWidth="1.5" />
        </>
      );
  }
}

export function ResourceIcon({
  resource, size = 28, className = '', title,
}: {
  resource: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `ri-${base}-${name}`;
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`inline-block shrink-0 drop-shadow-[0_1px_0_rgba(255,255,255,0.4)] ${className}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {icon(resource, id)}
    </svg>
  );
}
