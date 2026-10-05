// Recognizes which slip a document is from its printed text (English or French).

import type { SlipType } from '../tax/slips';
import { isT1Return } from './t1';

interface Signature { type: SlipType; patterns: RegExp[] }

// Order matters: more specific first (T4RSP before T4, T4A(P) before T4A).
const SIGNATURES: Signature[] = [
  { type: 'NOA', patterns: [/notice of (re)?assessment/i, /avis de (nouvelle )?cotisation/i] },
  { type: 'T4RSP', patterns: [/\bT4RSP\b/, /statement of RRSP income/i, /revenus d'un REER/i] },
  { type: 'T4RIF', patterns: [/\bT4RIF\b/, /income from a registered retirement income fund/i, /revenus d'un FERR/i] },
  { type: 'T4AP', patterns: [/T4A\s*\(P\)/i, /canada pension plan benefits/i, /prestations du r[ée]gime de pensions du canada/i] },
  { type: 'T4AOAS', patterns: [/T4A\s*\(OAS\)/i, /old age security/i, /s[ée]curit[ée] de la vieillesse/i] },
  { type: 'T4E', patterns: [/\bT4E\b/, /employment insurance and other benefits/i, /prestations d'assurance-emploi/i] },
  { type: 'T4A', patterns: [/\bT4A\b(?!\s*\(|-NR)/, /pension, retirement, annuity,? and other income/i] },
  { type: 'T5008', patterns: [/\bT5008\b/, /statement of securities transactions/i] },
  { type: 'T5007', patterns: [/\bT5007\b/, /statement of benefits/i] },
  { type: 'T5', patterns: [/\bT5\b(?!0)/, /statement of investment income/i, /revenus de placement/i] },
  { type: 'T3', patterns: [/\bT3\b/, /statement of trust income/i, /revenus de fiducie/i] },
  { type: 'T4', patterns: [/\bT4\b(?![AERS])/, /statement of remuneration paid/i, /r[ée]tribution vers[ée]e/i] },
];

export interface Detection { type: SlipType | null; evidence: string[] }

export function detectSlipType(text: string): Detection {
  // A full T1 return mentions most slips (T4, T4A(OAS), ...) in its line labels; its lines are the ones Lou reads from a Notice of Assessment.
  if (isT1Return(text)) return { type: 'NOA', evidence: ['Income Tax and Benefit Return (T1)'] };
  let best: Detection = { type: null, evidence: [] };
  let bestScore = 0;
  for (const sig of SIGNATURES) {
    const hits = sig.patterns.map((p) => text.match(p)?.[0]).filter((m): m is string => !!m);
    // A title phrase counts more than a bare form code (which also appears in cross-references).
    const score = hits.reduce((acc, h) => acc + (/^T\d|^T4/.test(h) ? 1 : 2), 0);
    if (score > bestScore) { bestScore = score; best = { type: sig.type, evidence: hits }; }
  }
  return best;
}

/** Tax year printed on a slip ("Year / Année 2025"), if any. */
export function detectYear(text: string): number | undefined {
  const m = text.match(/(?:year|ann[ée]e)\D{0,20}(20[1-3]\d)/i) ?? text.match(/\b(202[0-9])\b/);
  return m ? Number(m[1]) : undefined;
}
