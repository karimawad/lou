// One hand-drawn icon set: 20px grid, 1.75 stroke, round joins.

import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 20, ...rest }: P) => ({
  width: size, height: size, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...rest,
});

export const Lock = (p: P) => (<svg {...base(p)}><rect x="4" y="9" width="12" height="8" rx="2" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>);
export const Check = (p: P) => (<svg {...base(p)}><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>);
export const Upload = (p: P) => (<svg {...base(p)}><path d="M10 13V3.5M6 7l4-4 4 4" /><path d="M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" /></svg>);
export const Camera = (p: P) => (<svg {...base(p)}><path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h2L8 3.5h4l1.5 2h2A1.5 1.5 0 0 1 17 7v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5Z" /><circle cx="10" cy="10.5" r="3" /></svg>);
export const FileIcon = (p: P) => (<svg {...base(p)}><path d="M5.5 2.5h6l3.5 3.5v10a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 4 16V4a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M11.5 2.5V6H15" /></svg>);
export const Alert = (p: P) => (<svg {...base(p)}><path d="M10 3 2.5 16h15Z" /><path d="M10 8v3.5M10 14v.01" /></svg>);
export const Info = (p: P) => (<svg {...base(p)}><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5M10 6.5v.01" /></svg>);
export const Stop = (p: P) => (<svg {...base(p)}><circle cx="10" cy="10" r="7.5" /><path d="M10 6v5M10 13.8v.01" /></svg>);
export const Arrow = (p: P) => (<svg {...base(p)}><path d="M4 10h12M11 5l5 5-5 5" /></svg>);
export const Back = (p: P) => (<svg {...base(p)}><path d="M16 10H4M9 5l-5 5 5 5" /></svg>);
export const Plus = (p: P) => (<svg {...base(p)}><path d="M10 4v12M4 10h12" /></svg>);
export const Trash = (p: P) => (<svg {...base(p)}><path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 10a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-10" /></svg>);
export const Download = (p: P) => (<svg {...base(p)}><path d="M10 3v9.5M6 8.5l4 4 4-4" /><path d="M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" /></svg>);
/** Fold indicator: points down when closed; the fold styles rotate it when open. */
export const Chevron = (p: P) => (<svg {...base(p)} className="fold-chev" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>);
export const Printer = (p: P) => (<svg {...base(p)}><path d="M5.5 7.5v-4h9v4" /><rect x="3" y="7.5" width="14" height="6.5" rx="1.5" /><path d="M6 12h8v5H6Z" /></svg>);
export const Pencil = (p: P) => (<svg {...base(p)}><path d="M12.5 4.5 15.5 7.5 7 16H4v-3Z" /></svg>);
export const Mark = (p: P) => (<svg {...base({ ...p, strokeWidth: 2.4 })}><path d="M7 4.5v11h7" /></svg>);
export const Heart = (p: P) => (<svg {...base({ ...p, fill: 'currentColor', strokeWidth: 1.2 })}><path d="M10 16.6S3 12.4 3 7.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.6c0 4.8-7 9-7 9Z" /></svg>);
