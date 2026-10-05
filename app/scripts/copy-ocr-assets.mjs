// Copies the OCR engine into public/ so Lou never fetches it from a CDN.
// The English language data (public/tesseract/lang/eng.traineddata.gz) is committed separately.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
const out = 'public/tesseract';
mkdirSync(`${out}/core`, { recursive: true });
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const f of readdirSync('node_modules/tesseract.js-core')) {
  if (/lstm\.wasm\.js$/.test(f)) copyFileSync(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`);
}
console.log('OCR assets copied');
