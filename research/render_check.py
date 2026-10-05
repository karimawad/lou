# Fill each mapped field with its own key, check mapped boxes, render pages to PNG for eyeballing.
import json, pymupdf, sys, os
maps = json.load(open('maps2025.json'))
out = 'render_check'; os.makedirs(out, exist_ok=True)
def run(fm, tag):
    doc = pymupdf.open(f"irs-pdfs/2025/{fm['file']}")
    want = {v: k for k, v in fm['lines'].items()}
    want.update({v: k for k, v in fm['text'].items()})
    checks = {v[0]: (k, v[1]) for k, v in fm['checks'].items()}
    seen = set(); bad = []
    for page in doc:
        for w in page.widgets():
            n = w.field_name
            if n in want:
                w.field_value = want[n][:12]; w.update(); seen.add(n)
            elif n in checks:
                states = w.on_state()
                bad.append(f"check {checks[n][0]}: on_state={states} we_use={checks[n][1]}")
                w.field_value = states; w.update(); seen.add(n)
    missing = [k for k in list(want) + list(checks) if k not in seen]
    for i, page in enumerate(doc):
        page.get_pixmap(dpi=110).save(f"{out}/{tag}-p{i+1}.png")
    print(tag, 'missing fields:', missing)
    for b in bad: print('  ', b)
for key in ['F1040_2025','SCH1_2025','SCH1A_2025','SCH2_2025','SCH3_2025','SCH8812_2025','F1116_2025']:
    run(maps[key], key)
sb = maps['SCHB_2025']; fm = dict(sb['map']); fm['file'] = sb['file']
fm['text'] = dict(fm['text'])
for i, (a, b) in enumerate(sb['interestRows']): fm['text'][f'i{i}'] = a; fm['lines'][f'ia{i}'] = b
for i, (a, b) in enumerate(sb['dividendRows']): fm['text'][f'd{i}'] = a; fm['lines'][f'da{i}'] = b
run(fm, 'SCHB_2025')
