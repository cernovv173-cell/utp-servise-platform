from pathlib import Path
from PIL import Image
import qrcode
from qrcode.constants import ERROR_CORRECT_Q
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

OUT = Path('deliverables')
OUT.mkdir(exist_ok=True)
source = Image.open(OUT / 'raccoon-card-art.png').convert('RGB')
portrait = source.crop((395, 76, 798, 505))
portrait_path = Path('.tmp/enot-raccoon-portrait.png')
portrait.save(portrait_path, format='PNG', optimize=True)

qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_Q, box_size=16, border=4)
qr.add_data('https://xn----dtbhbq0ahshee.xn--p1ai')
qr.make(fit=True)
qr_path = Path('.tmp/enot-service-qr.png')
qr.make_image(fill_color='#102b4e', back_color='#ffffff').convert('RGB').save(qr_path, optimize=True)

pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVu-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
NAVY = HexColor('#102B4E')
DARK = HexColor('#0B1E36')
CYAN = HexColor('#16C7D9')
WHITE = HexColor('#FFFFFF')
INK = HexColor('#102B4E')
MUTED = HexColor('#47708A')
PAGE_W, PAGE_H = 110 * mm, 70 * mm
X, Y = 10 * mm, 10 * mm
CW, CH = 90 * mm, 50 * mm
BLEED = 3 * mm
pdf = OUT / 'Визитка_ЕНОТ_СЕРВИС.pdf'
c = canvas.Canvas(str(pdf), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
c.setTitle('Визитка ЕНОТ СЕРВИС')
c.setAuthor('ЕНОТ СЕРВИС')
c.setSubject('Двусторонний макет визитки, размер после обрезки 90 x 50 мм')

def bleed_base(color):
    c.setFillColor(color)
    c.rect(X - BLEED, Y - BLEED, CW + 2 * BLEED, CH + 2 * BLEED, fill=1, stroke=0)

def crop_marks():
    c.saveState()
    c.setStrokeColor(HexColor('#272727'))
    c.setLineWidth(0.25)
    a, b = 3.5 * mm, 6.5 * mm
    for y in (Y, Y + CH):
        c.line(a, y, b, y)
        c.line(PAGE_W - b, y, PAGE_W - a, y)
    for x in (X, X + CW):
        c.line(x, a, x, b)
        c.line(x, PAGE_H - b, x, PAGE_H - a)
    c.restoreState()

# Front: navy brand panel and the generated raccoon repair mascot.
bleed_base(NAVY)
c.drawImage(ImageReader(str(portrait_path)), X + 40 * mm, Y - BLEED,
            width=53 * mm, height=CH + 2 * BLEED, preserveAspectRatio=False, mask='auto')
c.setFillColor(NAVY)
c.rect(X + 40 * mm, Y - BLEED, 1.5 * mm, CH + 2 * BLEED, fill=1, stroke=0)
c.setFillColor(CYAN)
c.roundRect(X + 7 * mm, Y + 39.5 * mm, 8 * mm, 1.1 * mm, 0.55 * mm, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont('DejaVu-Bold', 20)
c.drawString(X + 7 * mm, Y + 30.5 * mm, 'ЕНОТ')
c.setFillColor(CYAN)
c.setFont('DejaVu-Bold', 10.5)
c.drawString(X + 7.2 * mm, Y + 24 * mm, 'СЕРВИС')
c.setStrokeColor(CYAN)
c.setLineWidth(0.7)
c.line(X + 7 * mm, Y + 20.5 * mm, X + 32 * mm, Y + 20.5 * mm)
c.setFillColor(WHITE)
c.setFont('DejaVu-Bold', 6.6)
c.drawString(X + 7 * mm, Y + 16.4 * mm, 'РЕМОНТ ТЕХНИКИ')
c.setFont('DejaVu', 5.7)
c.drawString(X + 7 * mm, Y + 12.7 * mm, 'Компьютеры, ноутбуки')
c.drawString(X + 7 * mm, Y + 9.5 * mm, 'Телефоны, планшеты')
crop_marks()
c.showPage()

# Back: legible contact details and a QR code to the official service site.
bleed_base(DARK)
c.setFillColor(WHITE)
c.rect(X + 60 * mm, Y - BLEED, 33 * mm, CH + 2 * BLEED, fill=1, stroke=0)
c.setFillColor(CYAN)
c.rect(X + 59.3 * mm, Y - BLEED, 0.7 * mm, CH + 2 * BLEED, fill=1, stroke=0)
c.setFillColor(CYAN)
c.setFont('DejaVu-Bold', 6.1)
c.drawString(X + 7 * mm, Y + 42 * mm, 'КОНТАКТЫ')
c.setFillColor(WHITE)
c.setFont('DejaVu-Bold', 12.8)
c.drawString(X + 7 * mm, Y + 33.6 * mm, '+7 (977) 616-06-22')
c.setStrokeColor(CYAN)
c.setLineWidth(0.65)
c.line(X + 7 * mm, Y + 30.2 * mm, X + 53 * mm, Y + 30.2 * mm)
c.setFillColor(WHITE)
c.setFont('DejaVu-Bold', 6.1)
c.drawString(X + 7 * mm, Y + 24.8 * mm, 'г. Пушкино, ул. Боголюбская, д. 6')
c.setFont('DejaVu', 5.8)
c.drawString(X + 7 * mm, Y + 19.8 * mm, 'Доставка и обслуживание по Москве')
c.drawString(X + 7 * mm, Y + 16.5 * mm, 'и Московской области')
c.setFillColor(CYAN)
c.setFont('DejaVu-Bold', 5.9)
c.drawString(X + 7 * mm, Y + 11.5 * mm, '8:30-21:30')
c.setFillColor(WHITE)
c.setFont('DejaVu', 5.5)
c.drawString(X + 7 * mm, Y + 6.5 * mm, 'regiregi94@mail.ru')
c.setFillColor(INK)
c.setFont('DejaVu-Bold', 7.1)
c.drawCentredString(X + 75 * mm, Y + 41.8 * mm, 'САЙТ')
qr_size = 21 * mm
c.drawImage(ImageReader(str(qr_path)), X + 64.5 * mm, Y + 15.5 * mm,
            width=qr_size, height=qr_size, preserveAspectRatio=True, mask='auto')
c.setFillColor(MUTED)
c.setFont('DejaVu', 5.0)
c.drawCentredString(X + 75 * mm, Y + 11 * mm, 'Откройте камерой')
crop_marks()
c.showPage()
c.save()
print(f'created={pdf}; bytes={pdf.stat().st_size}; qr_url=https://xn----dtbhbq0ahshee.xn--p1ai')
