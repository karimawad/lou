import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.pdf') && f.startsWith('f'))) {
  try {
    const doc = await PDFDocument.load(fs.readFileSync(`${dir}/${f}`), {ignoreEncryption:true});
    const form = doc.getForm();
    const xfa = !!doc.catalog.lookup(doc.context.obj('AcroForm')) ;
    const fields = form.getFields();
    const subj = doc.getSubject?.() || ''; const title = doc.getTitle?.() || '';
    console.log(f, 'pages', doc.getPageCount(), 'fields', fields.length, '|', title, '|', subj);
  } catch(e) { console.log(f, 'ERR', e.message); }
}
