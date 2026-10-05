# Builds made-up T1 returns from the official CRA fillable 5006-R (2025):
#  t1-2025-fillable.pdf  values in the form fields (CRA fillable / most software)
#  t1-2025-flat.pdf      fields removed, amounts printed as separate dollars and cents with
#                        watermark words on some rows (the layout of a Wealthsimple Tax export)
# Run from the repo root: python research/make_t1_fixture.py
import pymupdf

SRC = 'research/cra/5006-r-fill-25e.pdf'
OUT = 'app/src/extract/__fixtures__'
VALUES = {
    'Line_15000_Amount': '91987.42', 'Line_23600_Amount': '95000.12', 'Line_26000_Amount': '95000.12',
    'Line_10100_Amount': '90000.00', 'Line_12100_Amount': '39.42', 'Line_12900_Amount': '453.00',
    'Line_12000_Amount': '1495.00', 'Line_12010_Amount': '115.00',
    'Line_42000_Amount': '11234.56', 'Line_42800_Amount': '5432.10', 'Line_43700_Amount': '17000.00',
}
SPOUSE = ('Info_Spouse_CLP[0].Line23600[0].Amount', '55555.55')  # spouse's net income: must not be read as line 23600
WATERMARK = {'Line_42800_Amount': 'LA', 'Line_15000_Amount': 'DUPLICATA'}


def target(name):
    for k, v in VALUES.items():
        if f'{k}[0]' in name:
            return k, v
    if SPOUSE[0] in name:
        return 'spouse', SPOUSE[1]
    return None, None


for flat in (False, True):
    doc = pymupdf.open(SRC)
    doc.set_metadata({})
    for page in doc:
        for w in list(page.widgets()):
            key, value = target(w.field_name)
            if not key:
                if flat:
                    page.delete_widget(w)
                continue
            if not flat:
                w.field_value = value
                w.update()
                continue
            r = w.rect
            page.delete_widget(w)
            dollars, cents = value.split('.')
            dollars = f'{int(dollars):,}'
            size = 9
            # Dollars right-aligned before the cents divider, cents in the last 14 points, like the printed form.
            page.insert_text((r.x1 - 18 - pymupdf.get_text_length(dollars, fontsize=size), r.y1 - 2.5), dollars, fontsize=size)
            page.insert_text((r.x1 - 13, r.y1 - 2.5), cents, fontsize=size)
            if key in WATERMARK:
                page.insert_text((r.x0 + 2, r.y1 - 2.5), WATERMARK[key], fontsize=size, color=(0.7, 0.7, 0.7))
    name = 't1-2025-flat.pdf' if flat else 't1-2025-fillable.pdf'
    doc.save(f'{OUT}/{name}', garbage=4, deflate=True)
    print('wrote', name)
