"""Genera los iconos PNG/ICO y la imagen para redes (og.png) de CuántoGasta Ayudas. Uso: python tools/iconos.py"""
import os
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(RAIZ, 'src', 'assets')
INDIGO, ORO, ORO_OSC, NOCHE = (67, 56, 202), (251, 191, 36), (180, 83, 9), (30, 27, 75)


def logo(tam):
    k = 4  # dibujo a 4x y reduzco: bordes suaves
    s = tam * k
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 9 / 32), fill=INDIGO)
    c, r = s / 2, s * 9.5 / 32
    d.ellipse([c - r, c - r, c + r, c + r], fill=ORO)
    r2 = s * 6.6 / 32
    d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=ORO_OSC + (140,), width=max(1, int(s * 1.2 / 32)))
    pts = [(s * 11.6 / 32, s * 16.3 / 32), (s * 14.6 / 32, s * 19.3 / 32), (s * 20.4 / 32, s * 12.9 / 32)]
    d.line(pts, fill=NOCHE, width=int(s * 2.4 / 32), joint='curve')
    for p in (pts[0], pts[2]):
        w = s * 1.2 / 32
        d.ellipse([p[0] - w, p[1] - w, p[0] + w, p[1] + w], fill=NOCHE)
    return im.resize((tam, tam), Image.LANCZOS)


for n, t in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    logo(t).save(os.path.join(A, n))
logo(64).save(os.path.join(A, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# imagen para compartir en redes, 1200 x 630
W, H = 1200, 630
og = Image.new('RGB', (W, H), NOCHE)
d = ImageDraw.Draw(og)
for y in range(H):  # degradado índigo
    f = y / H
    d.line([(0, y), (W, y)], fill=(int(67 * (1 - f) + 30 * f), int(56 * (1 - f) + 27 * f), int(202 * (1 - f) + 75 * f)))
d.ellipse([820, 250, 1320, 750], outline=(251, 191, 36), width=6)
d.ellipse([880, 310, 1260, 690], outline=(251, 191, 36), width=3)
fuente = os.path.join(RAIZ, '..', 'editorial-pasatiempos', 'fuentes', 'AtkinsonHyperlegible-Bold.ttf')
f1 = ImageFont.truetype(fuente, 72)
f2 = ImageFont.truetype(fuente, 34)
f3 = ImageFont.truetype(fuente, 30)
og.paste(logo(96), (80, 70), logo(96))
d.text((196, 88), 'CuántoGasta Ayudas', font=f2, fill=(255, 255, 255))
d.text((80, 210), 'Ayudas y subvenciones', font=f1, fill=(255, 255, 255))
d.text((80, 292), 'abiertas hoy en España', font=f1, fill=(251, 191, 36))
d.text((80, 410), 'Para autónomos, particulares, empresas y asociaciones.', font=f3, fill=(212, 216, 251))
d.text((80, 455), 'Plazos, cuantías y requisitos con datos oficiales, cada día.', font=f3, fill=(212, 216, 251))
og.save(os.path.join(A, 'og.png'), optimize=True)
print('ok')
