# Builds OCR layout templates from the official CRA fillable slips.
# For each money box on the first slip copy: amount rect, cents divider x, and
# anchor words (unique words with positions) used to register a photo to the layout.
import json, re, pymupdf, collections
TYPES = {'t4':'T4','t4a':'T4A','t5':'T5','t3':'T3','t4rsp':'T4RSP','t4rif':'T4RIF','t4e':'T4E','t5007':'T5007','t5008':'T5008'}
OUT = 'app/src/extract/templates'
index = {}
for f, T in TYPES.items():
    for y in (2025, 2024, 2023):
        path = f'research/cra/{f}-{y}.pdf'
        try: d = pymupdf.open(path)
        except Exception: continue
        if d.needs_pass: d.authenticate('')
        p = d[0]
        ws = [w for w in p.widgets() if 'Slip1[0]' in w.field_name]
        if not ws: print('no Slip1 widgets', f, y); continue
        region = pymupdf.Rect(ws[0].rect)
        for w in ws: region |= w.rect
        region = pymupdf.Rect(region.x0 - 20, max(0, region.y0 - 70), region.x1 + 20, region.y1 + 10)
        rects = [it[1] for dr in p.get_drawings() for it in dr['items'] if it[0] == 're']
        boxes = {}
        for w in ws:
            last = w.field_name.split('.')[-2] if '.' in w.field_name else w.field_name
            # Most slips name amount fields "Box14"; the T4A uses "Line16" (box 016).
            m = re.search(r'(?:Box|Line)(\d{2,3}[A-Z]?)\[', w.field_name.split('.')[-1])
            if not m or 'OtherInformation' in w.field_name: continue
            b = m.group(1)
            r = w.rect
            div = None; right = r.x1
            for rr in rects:
                if r.x0 + 10 < rr.x0 < r.x1 - 2 and rr.x1 > r.x1 - 1 and abs((rr.y0 + rr.y1) / 2 - (r.y0 + r.y1) / 2) < r.height:
                    div = rr.x0; right = max(r.x1, rr.x1)
            boxes[b] = {'rect': [round(r.x0,1), round(r.y0,1), round(right - r.x0,1), round(r.height,1)], 'divider': round(div,1) if div else None}
        words = [w for w in p.get_text('words') if pymupdf.Rect(w[:4]).intersects(region)]
        cnt = collections.Counter(re.sub(r'[^a-z0-9]', '', w[4].lower()) for w in words)
        anchors = []
        for w in words:
            k = re.sub(r'[^a-z0-9]', '', w[4].lower())
            if cnt[k] != 1: continue
            if (k.isalpha() and len(k) >= 5) or (k.isdigit() and k.lstrip('0') in [b.lstrip('0') for b in boxes]):
                anchors.append({'text': k, 'x': round((w[0]+w[2])/2,1), 'y': round((w[1]+w[3])/2,1), 'h': round(w[3]-w[1],1)})
        tpl = {'type': T, 'year': y, 'page': [round(p.rect.width,1), round(p.rect.height,1)], 'region': [round(v,1) for v in region], 'boxes': boxes, 'anchors': anchors}
        json.dump(tpl, open(f'{OUT}/{f}-{y}.json', 'w'))
        index[f'{T}-{y}'] = f'{f}-{y}.json'
        print(f'{T} {y}: {len(boxes)} boxes, {sum(1 for b in boxes.values() if b["divider"])} with cents divider, {len(anchors)} anchors')
json.dump(index, open(f'{OUT}/index.json', 'w'), indent=1)
