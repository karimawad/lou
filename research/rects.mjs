// Lists widget rectangles (x1..x2, y) for fields whose name matches a pattern, with the row label nearby.
// Usage: node rects.mjs <pdf> <regex>
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const [, , file, pattern] = process.argv;
const re = new RegExp(pattern ?? '.');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const text = (await page.getTextContent()).items.filter((t) => t.str.trim()).map((t) => ({ s: t.str.trim(), x: t.transform[4], y: t.transform[5] }));
  for (const a of (await page.getAnnotations()).filter((a) => a.subtype === 'Widget' && re.test(a.fieldName))) {
    const [x1, y1, x2, y2] = a.rect.map((n) => Math.round(n));
    const label = text.filter((t) => t.y >= y1 - 2 && t.y <= y2 + 2 && t.x < x1).sort((a, b) => b.x - a.x).slice(0, 4).map((t) => t.s).reverse().join(' ');
    console.log(`${p}\t${a.fieldName.replace('topmostSubform[0].', '')}\t${a.fieldType}${a.exportValue ? '=' + a.exportValue : ''}\t${x1}-${x2},${y1}\t${label.slice(0, 80)}`);
  }
}
