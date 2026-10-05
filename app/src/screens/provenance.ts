// How Lou got a number, in words, for the review screen, the mapping guide and the review package.
// Levels follow the reading order in extract/index.ts: form fields and CSV are exact; a PDF text
// layer is read by position; photos are OCR. The "Please check" line (0.5) is the one the OCR
// guarantee is tested against (extract/ocr.test.ts).

import type { BoxRead } from '../extract/types';

export type ConfidenceLevel = 'exact' | 'high' | 'good' | 'low' | 'entered' | 't1';

export interface Confidence { level: ConfidenceLevel; label: string; detail: string; tone: 'ok' | 'accent' | 'warn' | 'muted' }

export function confidenceOf(read: BoxRead | undefined, edited: boolean, fromT1Line?: string): Confidence {
  if (edited) return { level: 'entered', label: 'You entered this', detail: 'Typed or corrected by you.', tone: 'muted' };
  if (fromT1Line) return { level: 't1', label: `From T1 line ${fromT1Line}`, detail: `Taken from line ${fromT1Line} of your T1 return because no slip covers it.`, tone: 'accent' };
  if (!read) return { level: 'entered', label: 'You entered this', detail: 'Typed in by you.', tone: 'muted' };
  if (read.source === 'field' || read.source === 'csv') {
    return { level: 'exact', label: 'Exact', detail: read.source === 'csv' ? 'Copied from your CSV file.' : "Copied from the PDF's own form field.", tone: 'ok' };
  }
  if (read.confidence <= 0.5) return { level: 'low', label: 'Low: please check', detail: 'Lou wasn\'t sure of this read. Compare it with your document.', tone: 'warn' };
  if (read.source === 'text') return { level: 'high', label: 'High', detail: "Read from the PDF's text by position on the page.", tone: 'ok' };
  return { level: 'good', label: 'Good', detail: 'Read from the photo or scan. Worth a glance against your document.', tone: 'accent' };
}
