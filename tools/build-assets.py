#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pipeline de assets da LP do Aulao "Nova Cartilha do ENEM" (Profa. Taci x Academy Cards).

Le APENAS de identidade-academy/ e identidade-taci/ e escreve em assets/.
Nunca modifica, move ou renomeia os arquivos originais de identidade.

Uso:
    python tools/build-assets.py

Requer: Pillow. Acesso a rede apenas para baixar as fontes (Google Fonts);
se a rede falhar, o passo de fontes e pulado e a pagina usa o <link> do Google.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC_ACADEMY = ROOT / "identidade-academy"
SRC_TACI = ROOT / "identidade-taci"
OUT = ROOT / "assets"
OUT_IMG = OUT / "img"
OUT_FONTS = OUT / "fonts"
OUT_CSS = OUT / "css"

UA_MODERN = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
# UA sem suporte a woff2: a API do Google devolve .ttf, que o Pillow le.
UA_LEGACY = "Mozilla/5.0 (Windows NT 6.1)"

# Paleta-ponte (ver plano / manual da marca)
NAVY = (0, 26, 39)
TEAL = (24, 67, 74)
BONE = (227, 227, 222)
BLUE = (63, 191, 255)
ROSE = (203, 165, 147)

# --- Fontes -----------------------------------------------------------------

FONT_QUERY = "family=Nunito:wght@400;600;700;800"
# Só 'latin': ja cobre todo o pt-BR (a-cedilha e os tis vivem em U+00C0-00FF).
# 'latin-ext' custaria ~60 KB sem acrescentar nenhum glifo que a pagina use.
WANTED_SUBSETS = ("latin",)


def log(msg: str) -> None:
    print(f"  {msg}")


def fetch(url: str, ua: str = UA_MODERN, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": ua})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def parse_font_css(css: str):
    """Devolve [(family, weight, style, subset, url)] para os subsets desejados."""
    out = []
    current_subset = None
    for block in re.split(r"(/\*\s*[a-z-]+\s*\*/)", css):
        m = re.match(r"/\*\s*([a-z-]+)\s*\*/", block.strip())
        if m:
            current_subset = m.group(1)
            continue
        if "@font-face" not in block:
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", block)
        wgt = re.search(r"font-weight:\s*(\d+)", block)
        sty = re.search(r"font-style:\s*(\w+)", block)
        url = re.search(r"url\((https://[^)]+)\)", block)
        if not (fam and wgt and url):
            continue
        if current_subset not in WANTED_SUBSETS:
            continue
        out.append(
            (fam.group(1), int(wgt.group(1)), (sty.group(1) if sty else "normal"),
             current_subset, url.group(1))
        )
    return out


def build_fonts() -> bool:
    """
    Self-host da Nunito, a fonte oficial do manual da Academy Cards - a
    unica familia usada na pagina.

    O Google serve a Nunito como *variable font*: o mesmo arquivo e devolvido
    para cada peso pedido, entao baixar 400/600/700/800 separadamente traria 4
    copias identicas. Aqui a familia vira um unico arquivo com `font-weight`
    em faixa, no subset 'latin' - que ja cobre todo o pt-BR.
    """
    print("[fontes] Nunito (self-host, dedupe, subset latin)")
    try:
        css = fetch(
            f"https://fonts.googleapis.com/css2?{FONT_QUERY}&display=swap"
        ).decode("utf-8")
    except Exception as e:  # noqa: BLE001
        log(f"!! rede indisponivel ({e}); pulando self-host de fontes")
        return False

    faces = parse_font_css(css)
    if not faces:
        log("!! nenhuma @font-face reconhecida; pulando")
        return False

    OUT_FONTS.mkdir(parents=True, exist_ok=True)

    # 1 arquivo por familia; guarda a faixa de pesos vista no CSS.
    by_family: dict[str, dict] = {}
    for fam, wgt, sty, _subset, url in faces:
        if sty != "normal":
            continue
        e = by_family.setdefault(fam, {"urls": set(), "weights": set()})
        e["urls"].add(url)
        e["weights"].add(wgt)

    rules = [
        "/* Fontes self-hosted. Gerado por tools/build-assets.py - nao editar a mao. */",
        "/* Nunito: fonte oficial da Academy Cards (manual de marca), unica da pagina. */",
        "/* Variable font; um arquivo cobre todos os pesos.                            */",
        "",
    ]
    total = 0
    for fam, info in by_family.items():
        slug = fam.lower().replace(" ", "-")
        raw = fetch(sorted(info["urls"])[0])
        dest = OUT_FONTS / f"{slug}.woff2"
        dest.write_bytes(raw)
        size = dest.stat().st_size
        total += size
        lo, hi = min(info["weights"]), max(info["weights"])
        wrule = f"{lo}" if lo == hi else f"{lo} {hi}"
        rules.append(
            "@font-face {\n"
            f"  font-family: '{fam}';\n"
            "  font-style: normal;\n"
            f"  font-weight: {wrule};\n"
            "  font-display: swap;\n"
            f"  src: url('../fonts/{dest.name}') format('woff2');\n"
            "}"
        )
        log(f"{dest.name}  {size/1024:.1f} KB  (1 arquivo, pesos {wrule})")

    # limpa arquivos de execucoes antigas do script
    for old in OUT_FONTS.glob("*.woff2"):
        if old.name not in {f"{f.lower().replace(' ', '-')}.woff2" for f in by_family}:
            old.unlink()

    OUT_CSS.mkdir(parents=True, exist_ok=True)
    (OUT_CSS / "fonts.css").write_text("\n".join(rules) + "\n", encoding="utf-8")
    log(f"total de fontes: {total/1024:.1f} KB -> assets/css/fonts.css")
    return True


def fetch_ttf(family_query: str) -> io.BytesIO | None:
    """
    TTF estatico no peso pedido, so para o Pillow desenhar a imagem OG.
    Nao entra no site: a pagina usa os woff2 self-hosted.
    """
    try:
        css = fetch(
            f"https://fonts.googleapis.com/css?{family_query}", ua=UA_LEGACY
        ).decode("utf-8")
        m = re.search(r"url\((https://[^)]+)\)", css)
        if not m:
            return None
        return io.BytesIO(fetch(m.group(1)))
    except Exception as e:  # noqa: BLE001
        log(f"!! TTF indisponivel para '{family_query}' ({e})")
        return None


# --- Imagens ----------------------------------------------------------------

def save_web(img: Image.Image, stem: str, widths: list[int], jpeg: bool = True) -> None:
    """Salva WebP (+ JPEG de fallback) em cada largura pedida."""
    for w in widths:
        h = round(img.height * w / img.width)
        r = img.resize((w, h), Image.LANCZOS)
        suffix = "" if w == max(widths) else f"-{w}"
        wp = OUT_IMG / f"{stem}{suffix}.webp"
        r.save(wp, "WEBP", quality=82, method=6)
        log(f"{wp.name}  {w}x{h}  {wp.stat().st_size/1024:.1f} KB")
        if jpeg:
            jp = OUT_IMG / f"{stem}{suffix}.jpg"
            r.convert("RGB").save(jp, "JPEG", quality=84, optimize=True,
                                  progressive=True, subsampling=1)
            log(f"{jp.name}  {w}x{h}  {jp.stat().st_size/1024:.1f} KB")


def build_hero() -> Image.Image:
    """Foto principal: em pe, camisa branca, tablet + caneta, sorriso aberto."""
    print("[foto] hero da Profa. Taci")
    src = SRC_TACI / "WhatsApp Image 2026-09-18 at 19.30.11 (2).jpeg"
    im = Image.open(src).convert("RGB")
    log(f"origem {im.width}x{im.height}  {src.stat().st_size/1024:.1f} KB")

    # Crop retrato ~4:5: headroom confortavel no topo, corte na barra da camisa.
    # (coordenadas conferidas visualmente sobre o original 1066x1600)
    x0, y0 = 70, 120
    crop_h = 1290
    crop_w = round(crop_h * 4 / 5)
    x1 = min(im.width, x0 + crop_w)
    x0 = max(0, x1 - crop_w)
    y1 = min(im.height, y0 + crop_h)
    hero = im.crop((x0, y0, x1, y1))

    # Leve realce: o original vem recomprimido do WhatsApp.
    hero = hero.filter(ImageFilter.UnsharpMask(radius=1.6, percent=48, threshold=3))

    save_web(hero, "taci-hero", [520, 860])
    return hero


def build_wordmark() -> Image.Image:
    """Logotipo 'Projeto Redacao com Taciane Weber' - versao bone, ja com alpha."""
    print("[logo] wordmark Projeto Redacao (bone)")
    src = SRC_TACI / "Logotipo sem fundo (32).png"
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getbbox())  # remove a folga transparente
    # Exibido com no maximo 168px de largura; 420 cobre telas 2.5x.
    w = 420
    h = round(im.height * w / im.width)
    r = im.resize((w, h), Image.LANCZOS)
    dest = OUT_IMG / "taci-wordmark.webp"
    r.save(dest, "WEBP", quality=88, method=6, exact=True)
    log(f"{dest.name}  {w}x{h}  {dest.stat().st_size/1024:.1f} KB")
    return r


def build_academy_svgs() -> None:
    """Recolore o unico asset realmente vetorial da Academy. Originais intactos."""
    print("[logo] Academy Cards (SVG vetorial)")
    src = (SRC_ACADEMY / "logo-hero.svg").read_text(encoding="utf-8")

    navy = OUT_IMG / "academy-navy.svg"
    navy.write_text(src, encoding="utf-8")
    log(f"{navy.name}  {navy.stat().st_size/1024:.1f} KB")

    # #001a27 -> bone, para uso sobre o fundo escuro. Os 3 flashcards continuam coloridos.
    bone_src = re.sub(r"#001[aA]27", "#E3E3DE", src)
    bone = OUT_IMG / "academy-bone.svg"
    bone.write_text(bone_src, encoding="utf-8")
    log(f"{bone.name}  {bone.stat().st_size/1024:.1f} KB")

    # Favicon vetorial: quadrado navy + lampada em bone, legivel a 16px em
    # qualquer tema de aba. O icone ocupa x[1.16,17.0] y[0.82,21.2] no viewBox original.
    inner = bone_src.split(">", 1)[1].rsplit("</svg>", 1)[0]
    # so a lampada (path 0) + os 3 flashcards
    icon_parts = re.findall(r"<rect[^>]*/>", inner)
    first_path = re.search(r"<path[^>]*?/>", inner)
    icon = (first_path.group(0) if first_path else "") + "".join(icon_parts)
    fav = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        '<rect width="32" height="32" rx="7" fill="#001A27"/>'
        '<g transform="translate(6.9 4.2) scale(0.8) translate(-1.16 -0.82)">'
        f"{icon}</g></svg>"
    )
    fp = OUT_IMG / "favicon.svg"
    fp.write_text(fav, encoding="utf-8")
    log(f"{fp.name}  {fp.stat().st_size/1024:.1f} KB")


def build_raster_favicons() -> None:
    """PNGs de favicon a partir da lampada do lockup vertical (Pillow nao rasteriza SVG)."""
    print("[favicon] PNGs")
    src = SRC_ACADEMY / "Logo branca - PNG.png (2).png"
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        log("!! logo sem conteudo visivel; pulando")
        return

    # A lampada e o bloco de cima; acha a primeira faixa de linhas totalmente
    # transparentes depois dela para separar do lettering.
    x0, y0, x1, y1 = bbox
    rows = [
        any(alpha.getpixel((x, y)) > 8 for x in range(x0, x1, 3))
        for y in range(y0, y1)
    ]
    gap_start = None
    run = 0
    for i, filled in enumerate(rows):
        if not filled:
            run += 1
            if run >= 12 and i > 40:
                gap_start = i - run + 1
                break
        else:
            run = 0
    bulb_bottom = y0 + (gap_start if gap_start else (y1 - y0))
    bulb = im.crop((x0, y0, x1, bulb_bottom))
    bulb = bulb.crop(bulb.getchannel("A").getbbox())

    for size, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png")):
        pad = round(size * 0.20)
        box = size - 2 * pad
        scale = min(box / bulb.width, box / bulb.height)
        bw, bh = max(1, round(bulb.width * scale)), max(1, round(bulb.height * scale))
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        radius = round(size * 0.22)
        ImageDraw.Draw(canvas).rounded_rectangle(
            (0, 0, size - 1, size - 1), radius=radius, fill=NAVY + (255,)
        )
        # a lampada vem branca; sobre o navy fica exatamente como o manual pede
        canvas.alpha_composite(
            bulb.resize((bw, bh), Image.LANCZOS),
            ((size - bw) // 2, (size - bh) // 2),
        )
        dest = OUT_IMG / name
        canvas.save(dest, "PNG", optimize=True)
        log(f"{name}  {size}x{size}  {dest.stat().st_size/1024:.1f} KB")


def hero_backdrop(w: int, h: int) -> Image.Image:
    """Fundo da pagina em imagem: navy da Academy + bloom teal da Taci."""
    bg = Image.new("RGB", (w, h), NAVY)
    bloom = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(bloom)
    cx, cy, r = int(w * 0.66), int(h * 0.42), int(h * 0.85)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=190)
    bloom = bloom.filter(ImageFilter.GaussianBlur(radius=max(w, h) // 6))
    return Image.composite(Image.new("RGB", (w, h), TEAL), bg, bloom)


def build_og_image(hero: Image.Image, wordmark: Image.Image) -> None:
    """Card 1200x630 para compartilhamento no Instagram / WhatsApp."""
    print("[og] imagem de compartilhamento 1200x630")
    W, H = 1200, 630
    card = hero_backdrop(W, H).convert("RGBA")

    # Pauta de folha de redacao, o mesmo motivo do hero
    rule = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rule)
    for y in range(64, H, 46):
        rd.line((56, y, W - 56, y), fill=BONE + (16,), width=1)
    card.alpha_composite(rule)

    # Foto a direita, com fade na borda esquerda para fundir com o fundo
    ph = H
    pw = round(hero.width * ph / hero.height)
    photo = hero.resize((pw, ph), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (pw, ph), 255)
    md = ImageDraw.Draw(mask)
    for i in range(round(pw * 0.42)):
        md.line((i, 0, i, ph), fill=int(255 * (i / (pw * 0.42)) ** 1.5))
    photo.putalpha(mask)
    card.alpha_composite(photo, (W - pw + 40, 0))

    d = ImageDraw.Draw(card)

    _ttf_cache: dict[tuple[str, int], io.BytesIO | None] = {}
    _QUERY = {"nunito": "family=Nunito:{w}"}

    def font(slug: str, size: int, weight: int = 400):
        key = (slug, weight)
        if key not in _ttf_cache:
            _ttf_cache[key] = fetch_ttf(_QUERY[slug].format(w=weight))
        stream = _ttf_cache[key]
        if stream is None:
            return ImageFont.load_default()
        stream.seek(0)
        return ImageFont.truetype(stream, size)

    x = 64
    # tag
    f_tag = font("nunito", 23, 800)
    tag = "AULÃO ON-LINE E GRATUITO"
    tw = d.textlength(tag, font=f_tag)
    d.rounded_rectangle((x, 66, x + tw + 48, 66 + 46), radius=999, fill=BLUE + (255,))
    d.text((x + 24, 66 + 23), tag, font=f_tag, fill=NAVY + (255,), anchor="lm")

    # titulo em Nunito 800, tracking fechado - mesma voz do H1 da pagina
    f_h1 = font("nunito", 58, 800)
    y = 178
    for line in ("Nova Cartilha do ENEM:", "o que muda na sua redação?"):
        d.text((x, y), line, font=f_h1, fill=BONE + (255,))
        y += 74

    # meta
    d.text((x, y + 30), "08/10   •   20h   •   On-line   •   Gratuito",
           font=font("nunito", 28, 700), fill=BLUE + (255,))

    # assinatura da parceria, alinhada pela base
    base = H - 58
    wm_w = 232
    wm = wordmark.resize((wm_w, round(wordmark.height * wm_w / wordmark.width)),
                         Image.LANCZOS)
    card.alpha_composite(wm, (x, base - wm.height))
    d = ImageDraw.Draw(card)
    rx = x + wm_w + 30
    d.line((rx, base - wm.height + 6, rx, base), fill=ROSE + (190,), width=2)
    d.text((rx + 26, base - wm.height // 2), "Academy Cards",
           font=font("nunito", 27, 800), fill=BONE + (255,), anchor="lm")

    dest = OUT_IMG / "og-image.jpg"
    card.convert("RGB").save(dest, "JPEG", quality=86, optimize=True, subsampling=1)
    log(f"{dest.name}  {W}x{H}  {dest.stat().st_size/1024:.1f} KB")


# --- Integridade dos originais ----------------------------------------------

def snapshot_sources() -> dict:
    snap = {}
    for folder in (SRC_ACADEMY, SRC_TACI):
        for p in sorted(folder.rglob("*")):
            if p.is_file():
                st = p.stat()
                snap[str(p.relative_to(ROOT))] = (st.st_size, int(st.st_mtime))
    return snap


def main() -> int:
    for folder in (SRC_ACADEMY, SRC_TACI):
        if not folder.is_dir():
            print(f"ERRO: pasta de identidade ausente: {folder}")
            return 1

    before = snapshot_sources()
    OUT_IMG.mkdir(parents=True, exist_ok=True)

    build_fonts()
    hero = build_hero()
    wordmark = build_wordmark()
    build_academy_svgs()
    build_raster_favicons()
    build_og_image(hero, wordmark)

    after = snapshot_sources()
    print()
    if before != after:
        print("!! ATENCAO: arquivos de identidade mudaram. Isso nao deveria acontecer.")
        for k in set(before) | set(after):
            if before.get(k) != after.get(k):
                print(f"   {k}: {before.get(k)} -> {after.get(k)}")
        return 1
    print(f"OK - {len(before)} arquivos de identidade intactos.")

    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"OK - assets/ gerado: {total/1024:.1f} KB no total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
