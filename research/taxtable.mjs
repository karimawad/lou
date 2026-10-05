// Parse the official IRS Tax Table from instruction text into JSON fixture rows [atLeast, lessThan, single, mfj, mfs, hoh].
import fs from 'fs';
const [, , year] = process.argv;
const txt = fs.readFileSync(`research/instr/i1040gi-${year}.txt`, 'utf8');
const start = txt.indexOf('Sample Table');
const end = txt.indexOf(`${year} Tax Computation Worksheet`, start);
const rows = new Map();
for (const line of txt.slice(start, end).split('\n')) {
  const t = line.trim();
  if (!/^[\d,]+(\s+[\d,]+)+$/.test(t)) continue;
  const nums = t.split(/\s+/).map((s) => Number(s.replace(/,/g, '')));
  if (nums.length % 6 !== 0) continue;
  for (let i = 0; i < nums.length; i += 6) { const r = nums.slice(i, i + 6); if (r[1] > r[0]) rows.set(r[0], r); }
}
const out = [...rows.values()].sort((a, b) => a[0] - b[0]);
// Sanity: contiguous coverage 0 -> 100,000
let gaps = 0; for (let i = 1; i < out.length; i++) if (out[i][0] !== out[i - 1][1]) gaps++;
fs.writeFileSync(`app/src/tax/__fixtures__/taxTable-${year}.json`, JSON.stringify(out));
console.log(year, 'rows', out.length, 'first', out[0], 'last', out.at(-1), 'gaps', gaps);
