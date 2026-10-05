# Builds test slips from the official CRA fillable PDFs: one fillable copy and one flattened copy each.
import pymupdf
OUT = 'app/src/extract/__fixtures__'
SLIPS = {
  't4': ('research/cra/t4-2025.pdf', {
    'Slip1EmployersName[0]': 'Maple Co', 'Slip1Year[0]': '2025',
    'Slip1Box14[0]': '100000.00', 'Slip1Box22[0]': '22000.00', 'Slip1Box16[0]': '4034.10',
    'Slip1Box18[0]': '1077.48', 'Slip1Box20[0]': '5000.00', 'Slip1Box44[0]': '650.00'}),
  't5': ('research/cra/t5-2025.pdf', {
    'Slip1PayersName[0]': 'RBC', 'Slip1Year[0]': '2025', 'Slip1Box13[0]': '1000.00',
    'Slip1Box24[0]': '2000.00', 'Slip1Box25[0]': '2760.00', 'Slip1Box26[0]': '414.55'}),
  # T4A: main boxes are named "Line16" etc.; box 028 sits in the "Other information" area (code + amount).
  't4a': ('research/cra/t4a-2025.pdf', {
    'Slip1EmployersName[0]': 'Pine Pension Plan', 'Slip1Year[0]': '2025',
    'Slip1Line16[0]': '24000.00', 'Slip1Line22[0]': '4800.00', 'Slip1Line24[0]': '1200.00',
    'Slip1Box1[0]': '028', 'Slip1Amount1[0]': '350.00'}),
}
for name, (src, values) in SLIPS.items():
    for flat in (False, True):
        doc = pymupdf.open(src)
        if doc.needs_pass: doc.authenticate('')
        hit = set()
        for page in doc:
            for w in page.widgets():
                if 'Slip1[0]' not in w.field_name: continue
                for suffix, v in values.items():
                    if w.field_name.endswith(suffix):
                        w.field_value = v; w.update(); hit.add(suffix)
        missing = set(values) - hit
        if missing: raise SystemExit(f'{name}: missing {missing}')
        if flat: doc.bake()
        path = f"{OUT}/{name}-2025-{'flat' if flat else 'fillable'}.pdf"
        doc.save(path, garbage=3, deflate=True)
        print('wrote', path)
