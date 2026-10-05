// For a form TSV, list each detected line number -> amount field(s). Ambiguous lines are printed with all candidates.
import fs from 'fs';
const [, , file, ...want] = process.argv;
const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map((r) => r.split('\t'));
const byLine = {};
for (const [pg, kind, name, pos, , line] of rows) {
  if (kind !== 'Tx' || !line) continue;
  (byLine[line] ??= []).push({ name, x: +pos.split(',')[0], pg });
}
const out = {};
for (const k of want) {
  const c = byLine[k];
  if (!c) { console.log(`MISSING ${k}`); continue; }
  if (c.length > 1) console.log(`AMBIG ${k}: ${c.map((f) => `${f.name}@${f.x}`).join(' | ')}`);
  out[k] = c.sort((a, b) => b.x - a.x)[0].name; // rightmost = amount column
}
console.log(JSON.stringify(out));
