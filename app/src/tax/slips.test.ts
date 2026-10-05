import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLIPS } from './slips';

// Cross-checks the catalog against the official CRA slip PDFs (converted to text
// in research/cra). Service Canada slips (T4A(P), T4A(OAS)) are not on CRA's site.
const CRA_DIR = resolve(__dirname, '../../../research/cra');
const FILE: Record<string, string> = {
  T4: 't4', T4A: 't4a', T5: 't5', T3: 't3', T5008: 't5008', T4RSP: 't4rsp', T4RIF: 't4rif', T4E: 't4e', T5007: 't5007',
};

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');

describe('slip catalog matches official CRA slips', () => {
  for (const [type, file] of Object.entries(FILE)) {
    for (const year of [2025, 2024, 2023]) {
      const path = `${CRA_DIR}/${file}-${year}.txt`;
      if (!existsSync(path)) continue;
      it(`${type} ${year}`, () => {
        const text = norm(readFileSync(path, 'utf8'));
        const misses: string[] = [];
        for (const b of SLIPS[type as keyof typeof SLIPS].boxes) {
          if (b.years && !b.years.includes(year)) continue;
          // First two significant words of our label must appear within 120 chars after the box number.
          const words = norm(b.label).replace(/[()]/g, ' ').split(' ').filter((w) => w.length > 2).slice(0, 2);
          const boxRe = new RegExp(`(^|[^0-9a-z])(box |case )?${norm(b.box)}([^0-9a-z]|$)`, 'g');
          let found = false;
          for (const m of text.matchAll(boxRe)) {
            const window = text.slice(m.index!, m.index! + 160);
            if (words.every((w) => window.includes(w))) { found = true; break; }
          }
          if (!found) misses.push(`${b.box} "${b.label}"`);
        }
        expect(misses).toEqual([]);
      });
    }
  }
});
