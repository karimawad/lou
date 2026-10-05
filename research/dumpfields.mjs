// Dump each fillable field: page, kind, name, rect, export value, line-number box next to it, and row text.
// Usage: node dumpfields.mjs <in.pdf> <out.tsv>
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const [, , file, out] = process.argv;
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
const LINE_NO = /^\(?[0-9]{1,2}[a-z]?\)?$|^[a-z]$/;
const lines = [];

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const text = (await page.getTextContent()).items
    .filter((t) => t.str.trim())
    .map((t) => ({ s: t.str.trim(), x: t.transform[4], y: t.transform[5], w: t.width }));
  const annots = (await page.getAnnotations()).filter((a) => a.subtype === 'Widget');

  for (const a of annots) {
    const [x1, y1, , y2] = a.rect;
    // Small line-number box printed just left of the entry box, same baseline.
    const near = text
      .filter((t) => t.y >= y1 - 1 && t.y <= y2 && t.x + t.w <= x1 + 3 && t.x + t.w >= x1 - 30 && LINE_NO.test(t.s))
      .sort((m, n) => n.x - m.x)[0];
    const row = text.filter((t) => t.y >= y1 - 3 && t.y <= y2 + 3 && t.x < x1).sort((m, n) => m.x - n.x);
    const label = row.map((t) => t.s).join(' ').replace(/\s+/g, ' ').replace(/(\. ){3,}/g, '… ').slice(-120);
    const kind = a.fieldType === 'Btn' ? (a.checkBox ? 'chk' : a.radioButton ? 'radio' : 'btn') : a.fieldType;
    const name = a.fieldName.replace('topmostSubform[0].', '');
    lines.push([p, kind, name, `${Math.round(x1)},${Math.round(y1)}`, a.exportValue ?? a.buttonValue ?? '', near ? near.s : '', label].join('\t'));
  }
}
fs.writeFileSync(out, lines.join('\n'));
console.log(file, lines.length);
