# Builds a Notice of Assessment test document in the CRA summary layout (Line / Description / Amount),
# as a text PDF and as a slightly rotated photo-like JPEG. The CRA doesn't publish a fillable NOA, so
# this mirrors the structure of the "Tax assessment summary" table; values are made up.
import pymupdf
from PIL import Image, ImageFilter

OUT = 'app/src/extract/__fixtures__'
ROWS = [
    ('15000', 'Total income', '103,760.00'),
    ('23600', 'Net income', '103,760.00'),
    ('26000', 'Taxable income', '103,760.00'),
    ('35000', 'Total federal non-refundable tax credits', '3,212.00'),
    ('42000', 'Net federal tax', '13,000.00'),
    ('42800', 'Net Ontario tax', '7,000.00'),
    ('43500', 'Total payable', '20,000.00'),
    ('43700', 'Total income tax deducted', '22,000.00'),
    ('48200', 'Total credits', '22,000.00'),
]

doc = pymupdf.open()
page = doc.new_page(width=612, height=792)
def text(x, y, s, size=10, bold=False):
    page.insert_text((x, y), s, fontsize=size, fontname='hebo' if bold else 'helv')
text(54, 60, 'Canada Revenue Agency', 9)
text(54, 90, 'Notice of assessment', 18, True)
text(54, 112, 'Tax year: 2025', 10)
text(54, 126, 'Date issued: April 28, 2026', 10)
text(54, 140, 'Social insurance number: XXX XX3 456', 10)
text(54, 180, 'Tax assessment summary', 13, True)
text(54, 204, 'Line', 9, True); text(110, 204, 'Description', 9, True); text(470, 204, '$', 9, True); text(500, 204, 'Amount', 9, True)
y = 224
for line, desc, amount in ROWS:
    text(54, y, line); text(110, y, desc)
    w = pymupdf.get_text_length(amount, fontname='helv', fontsize=10)
    text(556 - w, y, amount)
    y += 18
text(54, y + 10, 'Balance from this assessment', 10, True)
w = pymupdf.get_text_length('2,000.00 CR', fontname='helv', fontsize=10)
text(556 - w, y + 10, '2,000.00 CR')
doc.save(f'{OUT}/noa-2025.pdf')

pix = page.get_pixmap(dpi=200)
img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).rotate(1.5, expand=True, fillcolor='white')
img = img.filter(ImageFilter.GaussianBlur(0.6))
img.save(f'{OUT}/noa-2025-photo.jpg', quality=85)
print('wrote noa-2025.pdf and noa-2025-photo.jpg')
