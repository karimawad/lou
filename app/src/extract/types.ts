import type { SlipType } from '../tax/slips';

/** Where a value came from, strongest first. */
export type ExtractSource = 'field' | 'text' | 'ocr' | 'csv' | 'manual';

export interface BoxRead {
  value: number;
  source: ExtractSource;
  /** 0-1. Form fields and CSV are 1; layout matching and OCR less. */
  confidence: number;
  /** Page index (0-based) and rectangle in page units [x, y, w, h], top-left origin, for highlighting. */
  page?: number;
  rect?: [number, number, number, number];
  /** The raw text Lou read, shown in the review screen. */
  raw?: string;
}

export interface ExtractedSlip {
  type: SlipType | null;
  year?: number;
  payer?: string;
  boxes: Record<string, BoxRead>;
  /** Text Lou saw, for the "why did Lou think this is a T4" explanation. */
  evidence: string[];
}

/** A positioned piece of text from a PDF text layer or OCR, top-left origin. */
export interface Token {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
}
