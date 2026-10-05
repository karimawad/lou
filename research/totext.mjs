import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
for (const file of process.argv.slice(2)) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items;
    let lastY = null, line = '';
    out += `\n\n=== PAGE ${p} ===\n`;
    for (const t of items) { const y = Math.round(t.transform[5]); if (lastY !== null && Math.abs(y - lastY) > 2) { out += line + '\n'; line = ''; } line += (line && !line.endsWith(' ') ? ' ' : '') + t.str; lastY = y; }
    out += line;
  }
  fs.writeFileSync(file.replace(/\.pdf$/, '.txt'), out);
  console.log(file, doc.numPages);
}
