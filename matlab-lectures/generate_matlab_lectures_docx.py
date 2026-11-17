#!/usr/bin/env python3
"""Generate an editable Arabic Word lecture pack: MATLAB from zero to pro."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUTPUT = ROOT / "محاضرات_ماتلاب_من_الصفر_إلى_الاحتراف.docx"

# Engineering palette (MATLAB-inspired orange + slate + teal)
SLATE = (15, 39, 68)
ORANGE = (227, 108, 10)
TEAL = (26, 166, 166)
LIGHT = (244, 247, 251)
INK = (26, 36, 51)
WHITE = (255, 255, 255)
SOFT = (230, 236, 244)
GREEN = (46, 139, 87)
SOFT_ORANGE = (255, 236, 220)
SOFT_TEAL = (220, 242, 242)

# DejaVu covers Arabic + Latin (needed for mixed labels like for/while)
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def draw_text(draw: ImageDraw.ImageDraw, xy, text: str, *, size: int = 24, bold: bool = False, fill=INK, anchor=None):
    """Draw Arabic/LTR-mixed text with HarfBuzz/raqm shaping."""
    kw = {"font": font(size, bold), "fill": fill, "direction": "rtl", "language": "ar"}
    if anchor:
        kw["anchor"] = anchor
    draw.text(xy, text, **kw)


def rounded_rect(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None, width: int = 2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def save_img(img: Image.Image, name: str) -> Path:
    ASSETS.mkdir(parents=True, exist_ok=True)
    path = ASSETS / name
    img.save(path, "PNG", optimize=True)
    return path


def make_cover() -> Path:
    w, h = 1600, 900
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    # atmospheric bands
    for i in range(0, h, 4):
        tone = 244 - int(18 * (i / h))
        d.line([(0, i), (w, i)], fill=(tone, tone + 2, min(255, tone + 8)))
    d.polygon([(0, 0), (980, 0), (720, h), (0, h)], fill=SLATE)
    d.polygon([(0, 0), (720, 0), (520, h), (0, h)], fill=(10, 28, 50))
    # accent bar
    d.rectangle([(0, 760), (w, 780)], fill=ORANGE)
    draw_text(d, (70, 160), "دورة تعليمية مرئية", size=36, fill=TEAL)
    draw_text(d, (70, 230), "ماتلاب", size=96, bold=True, fill=WHITE)
    draw_text(d, (70, 360), "من الصفر إلى الاحتراف", size=48, bold=True, fill=SOFT_ORANGE)
    draw_text(
        d,
        (70, 460),
        "محاضرات تعريفية + رسومات وإنفوجرافيك قابل للتعديل",
        size=28,
        fill=(200, 214, 230),
    )
    # right visual: abstract matrix grid
    ox, oy = 980, 180
    for r in range(4):
        for c in range(4):
            x0 = ox + c * 110
            y0 = oy + r * 110
            fill = ORANGE if (r + c) % 2 == 0 else TEAL
            rounded_rect(d, (x0, y0, x0 + 90, y0 + 90), 16, fill)
            d.text((x0 + 28, y0 + 24), f"{r+1}{c+1}", font=font(28, True), fill=WHITE)
    draw_text(d, (70, 820), "ملف Word جاهز للتعديل في Microsoft Word", size=24, fill=INK)
    return save_img(img, "00_cover.png")


def make_roadmap() -> Path:
    w, h = 1600, 780
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (80, 40), "خارطة الطريق التعليمية", size=42, bold=True, fill=SLATE)
    draw_text(d, (80, 100), "أربع مراحل متدرجة من المبتدئ إلى الاحتراف", size=26, fill=INK)

    stages = [
        ("١", "مبتدئ", "الواجهة\nالمتغيرات\nالمصفوفات", ORANGE),
        ("٢", "متوسط", "البرمجة\nالدوال\nالرسوم", TEAL),
        ("٣", "متقدم", "البيانات\nSimulink\nالأدوات", SLATE),
        ("٤", "احترافي", "المشاريع\nأفضل الممارسات\nالتوثيق", GREEN),
    ]
    y = 220
    gap = 60
    box_w = 280
    start_x = 90
    for i, (num, title, body, color) in enumerate(stages):
        x = start_x + i * (box_w + gap)
        rounded_rect(d, (x, y, x + box_w, y + 360), 28, WHITE, color, 4)
        d.ellipse((x + 100, y + 30, x + 180, y + 110), fill=color)
        d.text((x + 125, y + 48), num, font=font(36, True), fill=WHITE)
        draw_text(d, (x + 70, y + 140), title, size=34, bold=True, fill=color)
        for j, line in enumerate(body.split("\n")):
            draw_text(d, (x + 70, y + 210 + j * 40), line, size=24, fill=INK)
        if i < len(stages) - 1:
            ax = x + box_w + 12
            d.polygon([(ax, y + 180), (ax + 36, y + 200), (ax, y + 220)], fill=ORANGE)
    return save_img(img, "01_roadmap.png")


def make_ide() -> Path:
    w, h = 1600, 900
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (60, 30), "إنفوجرافيك: أجزاء سطح مكتب MATLAB", size=36, bold=True, fill=SLATE)
    # outer frame
    rounded_rect(d, (60, 110, 1540, 850), 18, WHITE, SLATE, 3)
    # title bar
    d.rectangle([(60, 110), (1540, 170)], fill=SLATE)
    d.text((90, 125), "MATLAB Desktop", font=font(26, True), fill=WHITE)
    # current folder
    rounded_rect(d, (80, 190, 420, 420), 12, SOFT, TEAL, 3)
    draw_text(d, (110, 210), "Current Folder", size=24, bold=True, fill=TEAL)
    draw_text(d, (110, 260), "تصفح الملفات", size=22, fill=INK)
    draw_text(d, (110, 300), "والمجلدات الحالية", size=22, fill=INK)
    # workspace
    rounded_rect(d, (80, 440, 420, 820), 12, SOFT_ORANGE, ORANGE, 3)
    draw_text(d, (110, 470), "Workspace", size=24, bold=True, fill=ORANGE)
    draw_text(d, (110, 530), "المتغيرات", size=22, fill=INK)
    draw_text(d, (110, 570), "في الذاكرة", size=22, fill=INK)
    # command window
    rounded_rect(d, (450, 190, 1100, 820), 12, (248, 250, 252), SLATE, 3)
    draw_text(d, (480, 220), "Command Window", size=26, bold=True, fill=SLATE)
    d.text((480, 290), ">> A = [1 2; 3 4]", font=font(28), fill=INK)
    d.text((480, 350), ">> B = A.^2", font=font(28), fill=INK)
    draw_text(d, (480, 420), "نافذة الأوامر للتنفيذ المباشر", size=24, fill=TEAL)
    # editor
    rounded_rect(d, (1130, 190, 1520, 820), 12, SOFT_TEAL, TEAL, 3)
    draw_text(d, (1160, 220), "Editor", size=26, bold=True, fill=TEAL)
    draw_text(d, (1160, 290), "كتابة السكربتات", size=22, fill=INK)
    draw_text(d, (1160, 340), "والدوال والملفات", size=22, fill=INK)
    d.text((1160, 400), ".m / .mlx", font=font(28, True), fill=ORANGE)
    return save_img(img, "02_ide.png")


def make_matrix() -> Path:
    w, h = 1600, 780
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 40), "مفهوم المصفوفة في MATLAB", size=40, bold=True, fill=SLATE)
    draw_text(d, (70, 100), "كل شيء تقريباً يُعامل كمصفوفة أو متجه", size=26, fill=INK)

    # scalar
    rounded_rect(d, (80, 200, 360, 520), 20, WHITE, ORANGE, 4)
    draw_text(d, (140, 230), "عدد قياسي", size=28, bold=True, fill=ORANGE)
    rounded_rect(d, (160, 320, 280, 440), 16, ORANGE)
    d.text((195, 355), "5", font=font(40, True), fill=WHITE)
    d.text((130, 470), "1×1", font=font(24), fill=INK)

    # vector
    rounded_rect(d, (420, 200, 860, 520), 20, WHITE, TEAL, 4)
    draw_text(d, (540, 230), "متجه صفي", size=28, bold=True, fill=TEAL)
    vals = ["2", "4", "6", "8"]
    for i, v in enumerate(vals):
        x = 470 + i * 90
        rounded_rect(d, (x, 330, x + 75, 420), 12, TEAL)
        d.text((x + 22, 350), v, font=font(28, True), fill=WHITE)
    d.text((560, 470), "1×4", font=font(24), fill=INK)

    # matrix
    rounded_rect(d, (920, 180, 1500, 620), 20, WHITE, SLATE, 4)
    draw_text(d, (1080, 210), "مصفوفة", size=28, bold=True, fill=SLATE)
    data = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]]
    for r, row in enumerate(data):
        for c, v in enumerate(row):
            x = 1020 + c * 120
            y = 290 + r * 100
            fill = ORANGE if (r + c) % 2 == 0 else TEAL
            rounded_rect(d, (x, y, x + 95, y + 80), 12, fill)
            d.text((x + 32, y + 18), v, font=font(28, True), fill=WHITE)
    d.text((1120, 580), "3×3", font=font(24), fill=INK)
    return save_img(img, "03_matrix.png")


def make_ops() -> Path:
    w, h = 1600, 720
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 40), "فرق مهم: ضرب المصفوفات × مقابل العنصر بعنصر", size=34, bold=True, fill=SLATE)

    rounded_rect(d, (80, 140, 740, 620), 24, WHITE, SLATE, 4)
    draw_text(d, (180, 180), "ضرب مصفوفي", size=32, bold=True, fill=SLATE)
    d.text((250, 250), "A * B", font=font(48, True), fill=ORANGE)
    draw_text(d, (140, 340), "يشترط توافق الأبعاد", size=26, fill=INK)
    draw_text(d, (140, 400), "(أعمدة A = صفوف B)", size=26, fill=INK)
    draw_text(d, (140, 480), "يُستخدم في الجبر الخطي", size=24, fill=TEAL)

    rounded_rect(d, (860, 140, 1520, 620), 24, WHITE, ORANGE, 4)
    draw_text(d, (980, 180), "ضرب عنصري", size=32, bold=True, fill=ORANGE)
    d.text((1000, 250), "A .* B", font=font(48, True), fill=TEAL)
    draw_text(d, (920, 340), "نفس الحجم للمصفوفتين", size=26, fill=INK)
    draw_text(d, (920, 400), "كل عنصر مع مقابله", size=26, fill=INK)
    draw_text(d, (920, 480), "شائع في معالجة الإشارات", size=24, fill=TEAL)
    return save_img(img, "04_operations.png")


def make_flow() -> Path:
    w, h = 1600, 900
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 30), "مخطط تدفق: الشروط والحلقات", size=36, bold=True, fill=SLATE)

    def box(x, y, tw, th, text, color):
        rounded_rect(d, (x, y, x + tw, y + th), 16, WHITE, color, 3)
        draw_text(d, (x + 30, y + 28), text, size=24, bold=True, fill=color)

    def diamond(cx, cy, text):
        pts = [(cx, cy - 70), (cx + 160, cy), (cx, cy + 70), (cx - 160, cy)]
        d.polygon(pts, fill=SOFT_ORANGE, outline=ORANGE)
        draw_text(d, (cx - 70, cy - 18), text, size=22, bold=True, fill=ORANGE)

    def arrow(x1, y1, x2, y2):
        d.line([(x1, y1), (x2, y2)], fill=SLATE, width=4)
        if y2 > y1:
            d.polygon([(x2 - 10, y2 - 16), (x2 + 10, y2 - 16), (x2, y2)], fill=SLATE)

    box(640, 90, 320, 90, "بداية البرنامج", SLATE)
    arrow(800, 180, 800, 230)
    diamond(800, 310, "شرط؟")
    # yes
    d.line([(960, 310), (1180, 310)], fill=GREEN, width=4)
    draw_text(d, (1020, 270), "نعم", size=22, bold=True, fill=GREEN)
    box(1080, 360, 340, 90, "نفّذ أوامر الشرط", GREEN)
    # no / loop side
    arrow(800, 380, 800, 450)
    box(640, 460, 320, 90, "حلقة تكرار for/while", TEAL)
    arrow(800, 550, 800, 620)
    box(640, 630, 320, 90, "نهاية ونتيجة", ORANGE)
    draw_text(d, (420, 300), "لا", size=22, bold=True, fill=ORANGE)
    d.line([(640, 310), (500, 310), (500, 505), (640, 505)], fill=ORANGE, width=4)
    return save_img(img, "05_control_flow.png")


def make_functions() -> Path:
    w, h = 1600, 780
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 40), "تشريح الدالة في MATLAB", size=38, bold=True, fill=SLATE)
    rounded_rect(d, (120, 140, 1480, 680), 24, WHITE, SLATE, 3)
    lines = [
        ("function y = area(r)", ORANGE, "التوقيع: مخرجات = اسم(مدخلات)"),
        ("    % حساب مساحة دائرة", TEAL, "تعليق توضيحي"),
        ("    y = pi * r.^2;", SLATE, "جسم الدالة"),
        ("end", ORANGE, "إغلاق الدالة"),
    ]
    for i, (code, color, note) in enumerate(lines):
        y = 200 + i * 110
        rounded_rect(d, (160, y, 820, y + 80), 12, SOFT, color, 2)
        d.text((190, y + 20), code, font=font(28, True), fill=color)
        draw_text(d, (880, y + 22), note, size=26, fill=INK)
    return save_img(img, "06_functions.png")


def make_plots() -> Path:
    w, h = 1600, 900
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 30), "أنواع الرسوم الأساسية", size=38, bold=True, fill=SLATE)
    cards = [
        (ORANGE, "plot", "منحنى خطي"),
        (TEAL, "scatter", "تبعثر"),
        (SLATE, "bar", "أعمدة"),
        (GREEN, "histogram", "مدرج تكراري"),
        (ORANGE, "surf", "سطح ثلاثي"),
        (TEAL, "imagesc", "صورة بيانات"),
    ]
    for i, (color, en, ar_title) in enumerate(cards):
        col, row = i % 3, i // 3
        x = 80 + col * 500
        y = 120 + row * 360
        rounded_rect(d, (x, y, x + 450, y + 300), 22, WHITE, color, 4)
        d.text((x + 40, y + 30), en, font=font(30, True), fill=color)
        draw_text(d, (x + 40, y + 90), ar_title, size=28, fill=INK)
        # mini fake chart
        if en == "plot":
            pts = [(x + 60 + k * 40, y + 220 - int(60 * abs(((k % 5) - 2)) / 2)) for k in range(8)]
            d.line(pts, fill=color, width=4)
        elif en == "scatter":
            for k in range(10):
                d.ellipse((x + 70 + k * 30, y + 180 + (k % 3) * 25, x + 86 + k * 30, y + 196 + (k % 3) * 25), fill=color)
        elif en == "bar":
            for k, hh in enumerate([60, 100, 40, 120, 80]):
                d.rectangle([(x + 80 + k * 55, y + 250 - hh), (x + 115 + k * 55, y + 250)], fill=color)
        elif en == "histogram":
            for k, hh in enumerate([40, 90, 140, 100, 50]):
                d.rectangle([(x + 80 + k * 55, y + 250 - hh), (x + 120 + k * 55, y + 250)], fill=color)
        elif en == "surf":
            for r in range(4):
                for c in range(5):
                    tone = 80 + r * 30 + c * 10
                    d.rectangle([(x + 80 + c * 55, y + 150 + r * 30), (x + 125 + c * 55, y + 175 + r * 30)], fill=(tone, 120, 80))
        else:
            for r in range(5):
                for c in range(6):
                    v = 40 + ((r * 6 + c) * 17) % 180
                    d.rectangle([(x + 70 + c * 50, y + 150 + r * 28), (x + 115 + c * 50, y + 174 + r * 28)], fill=(v, 160, 160))
    return save_img(img, "07_plots.png")


def make_data() -> Path:
    w, h = 1600, 700
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 40), "مسار تحليل البيانات", size=38, bold=True, fill=SLATE)
    steps = [
        ("استيراد", "readtable\nload / xlsread", ORANGE),
        ("تنظيف", "missing\nfillmissing", TEAL),
        ("تحليل", "mean / std\nfit / model", SLATE),
        ("تصور", "plot / heatmap", GREEN),
        ("تصدير", "writetable\nsave / export", ORANGE),
    ]
    for i, (title, body, color) in enumerate(steps):
        x = 70 + i * 300
        rounded_rect(d, (x, 160, x + 250, 520), 22, WHITE, color, 4)
        d.ellipse((x + 85, 190, x + 165, 270), fill=color)
        d.text((x + 110, 210), str(i + 1), font=font(32, True), fill=WHITE)
        draw_text(d, (x + 55, 300), title, size=28, bold=True, fill=color)
        for j, line in enumerate(body.split("\n")):
            d.text((x + 35, 370 + j * 40), line, font=font(22), fill=INK)
        if i < len(steps) - 1:
            d.polygon([(x + 260, 330), (x + 290, 350), (x + 260, 370)], fill=ORANGE)
    return save_img(img, "08_data_pipeline.png")


def make_simulink() -> Path:
    w, h = 1600, 780
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 40), "فكرة Simulink: نمذجة بالكتل", size=38, bold=True, fill=SLATE)
    blocks = [
        (120, "Source", "إشارة دخل", ORANGE),
        (470, "Process", "نقل / تحكم", TEAL),
        (820, "Plant", "النظام", SLATE),
        (1170, "Scope", "عرض المخرج", GREEN),
    ]
    for x, en, ar_t, color in blocks:
        rounded_rect(d, (x, 260, x + 280, 460), 18, WHITE, color, 4)
        d.text((x + 50, 300), en, font=font(28, True), fill=color)
        draw_text(d, (x + 50, 370), ar_t, size=26, fill=INK)
        if x < 1170:
            d.line([(x + 280, 360), (x + 350, 360)], fill=ORANGE, width=5)
            d.polygon([(x + 350, 350), (x + 370, 360), (x + 350, 370)], fill=ORANGE)
    draw_text(d, (120, 560), "اسحب كتل → اربط إشارات → شغّل المحاكاة → حلّل النتائج", size=28, fill=INK)
    return save_img(img, "09_simulink.png")


def make_pro() -> Path:
    w, h = 1600, 820
    img = Image.new("RGB", (w, h), LIGHT)
    d = ImageDraw.Draw(img)
    draw_text(d, (70, 40), "حزمة المحترف", size=40, bold=True, fill=SLATE)
    items = [
        ("Live Scripts", "شرح تفاعلي + كود + نتائج", ORANGE),
        ("App Designer", "واجهات تطبيقات هندسية", TEAL),
        ("Toolboxes", "تحسين، رؤية، تحكم، إشارة", SLATE),
        ("Projects", "تنظيم الملفات والإصدارات", GREEN),
        ("Testing", "اختبارات وحدات وتحقق", ORANGE),
        ("Publishing", "تقارير PDF / HTML", TEAL),
    ]
    for i, (title, desc, color) in enumerate(items):
        col, row = i % 3, i // 3
        x = 80 + col * 500
        y = 140 + row * 300
        rounded_rect(d, (x, y, x + 450, y + 240), 22, WHITE, color, 4)
        d.rectangle([(x, y), (x + 18, y + 240)], fill=color)
        d.text((x + 50, y + 50), title, font=font(30, True), fill=color)
        draw_text(d, (x + 50, y + 120), desc, size=24, fill=INK)
    return save_img(img, "10_pro_stack.png")


# ─── Word helpers ─────────────────────────────────────────────


def set_run_font(run, size=12, bold=False, color=None, name="Noto Sans Arabic"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    run._element.rPr.rFonts.set(qn("w:cs"), name)
    run.font.size = Pt(size)
    run.bold = bold
    if color:
        run.font.color.rgb = RGBColor(*color)


def set_rtl(paragraph):
    p = paragraph._p
    pPr = p.get_or_add_pPr()
    bidi = OxmlElement("w:bidi")
    bidi.set(qn("w:val"), "1")
    pPr.append(bidi)
    paragraph.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.RIGHT


def add_heading_ar(doc: Document, text: str, level: int = 1):
    p = doc.add_paragraph()
    set_rtl(p)
    run = p.add_run(text)
    sizes = {0: 28, 1: 22, 2: 16, 3: 13}
    set_run_font(run, size=sizes.get(level, 14), bold=True, color=SLATE)
    p.paragraph_format.space_before = Pt(14 if level <= 1 else 8)
    p.paragraph_format.space_after = Pt(8)
    return p


def add_body(doc: Document, text: str, size: int = 12, bold: bool = False, color=None):
    p = doc.add_paragraph()
    set_rtl(p)
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold, color=color or INK)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    return p


def add_bullets(doc: Document, items: list[str]):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        set_rtl(p)
        # clear default and rewrite
        if p.runs:
            p.runs[0].text = item
            set_run_font(p.runs[0], size=12, color=INK)
        else:
            run = p.add_run(item)
            set_run_font(run, size=12, color=INK)


def add_code(doc: Document, code: str):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), "F3F6FA")
    shading.set(qn("w:val"), "clear")
    cell._tePr = cell._tc.get_or_add_tcPr()
    cell._tc.get_or_add_tcPr().append(shading)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(code)
    set_run_font(run, size=11, name="Consolas")
    run.font.color.rgb = RGBColor(*SLATE)
    doc.add_paragraph()


def add_image(doc: Document, path: Path, width_cm: float = 16.5):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.add_picture(str(path), width=Cm(width_cm))
    p.paragraph_format.space_after = Pt(10)


def add_callout(doc: Document, title: str, body: str):
    table = doc.add_table(rows=1, cols=1)
    cell = table.cell(0, 0)
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), "FFF1E4")
    shading.set(qn("w:val"), "clear")
    cell._tc.get_or_add_tcPr().append(shading)
    p1 = cell.paragraphs[0]
    set_rtl(p1)
    r1 = p1.add_run(title)
    set_run_font(r1, size=12, bold=True, color=ORANGE)
    p2 = cell.add_paragraph()
    set_rtl(p2)
    r2 = p2.add_run(body)
    set_run_font(r2, size=11, color=INK)
    doc.add_paragraph()


def lecture_header(doc: Document, number: str, title: str, goals: list[str]):
    add_heading_ar(doc, f"المحاضرة {number}: {title}", 1)
    add_body(doc, "نواتج التعلم", size=13, bold=True, color=TEAL)
    add_bullets(doc, goals)


def build_docx(images: dict[str, Path]) -> Path:
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.right_margin = Cm(2.0)
    section.left_margin = Cm(2.0)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)

    # Cover
    add_image(doc, images["cover"], 17)
    add_heading_ar(doc, "ماتلاب من الصفر إلى الاحتراف", 0)
    add_body(doc, "حزمة محاضرات تعريفية قابلة للتعديل — رسومات وإنفوجرافيك احترافي", size=14, color=ORANGE)
    add_body(doc, "الصيغة: Microsoft Word (.docx) — عدّل النصوص والصور بحرية.")
    add_body(doc, "اللغة: العربية مع أمثلة أوامر MATLAB بالإنجليزية.")
    doc.add_page_break()

    # How to use
    add_heading_ar(doc, "كيف تستخدم هذا الملف؟", 1)
    add_bullets(
        doc,
        [
            "افتح الملف في Microsoft Word وعدّل أي عنوان أو فقرة مباشرة.",
            "الصور محفوظة أيضاً في مجلد assets ويمكن استبدالها بصورك.",
            "كل محاضرة تحتوي: أهدافاً، شرحاً، إنفوجرافيك، أمثلة كود، وتمارين.",
            "يمكنك نسخ شريحة/قسم ولصقه في PowerPoint عند الحاجة.",
        ],
    )
    doc.add_page_break()

    # Roadmap
    add_heading_ar(doc, "المحاضرة ٠: خارطة الطريق", 1)
    add_body(
        doc,
        "تبدأ الرحلة بفهم الواجهة والمتغيرات، ثم تنتقل للبرمجة والرسوم، ثم تحليل البيانات وSimulink، وتُختتم بمهارات المحترف: التطبيقات، المشاريع، والاختبارات.",
    )
    add_image(doc, images["roadmap"])
    add_callout(
        doc,
        "نصيحة المدرّب",
        "لا تتجاوز مرحلة المصفوفات بسرعة؛ معظم أخطاء المبتدئين تأتي من الخلط بين * و .* ومن أبعاد المصفوفات.",
    )
    doc.add_page_break()

    # L1
    lecture_header(
        doc,
        "١",
        "ما هو MATLAB وواجهة العمل؟",
        [
            "تعريف MATLAB ومجالات استخدامه الهندسية والعلمية.",
            "تمييز نوافذ سطح المكتب الأساسية.",
            "تنفيذ أوامر بسيطة في Command Window.",
        ],
    )
    add_body(
        doc,
        "MATLAB بيئة رقمية للحساب المصفوفي، المحاكاة، وتحليل البيانات. تُستخدم بكثافة في التحكم، الإشارات، الاتصالات، الميكانيك، والذكاء الاصطناعي الهندسي.",
    )
    add_image(doc, images["ide"])
    add_body(doc, "أول أوامر للتجربة:", size=13, bold=True)
    add_code(
        doc,
        ">> version\n"
        ">> a = 3\n"
        ">> b = 4\n"
        ">> c = hypot(a, b)\n"
        ">> clear; clc",
    )
    add_body(doc, "تمرين سريع", size=13, bold=True, color=ORANGE)
    add_bullets(
        doc,
        [
            "أنشئ متغيرين x و y واحسب مجموعهما وحاصل ضربهما.",
            "افتح Editor واحفظ سكربت باسم intro.m ينفّذ نفس الحساب.",
        ],
    )
    doc.add_page_break()

    # L2
    lecture_header(
        doc,
        "٢",
        "المتغيرات والمصفوفات",
        [
            "إنشاء متجهات ومصفوفات بطرق متعددة.",
            "الفهرسة (Indexing) الشرائحية.",
            "فهم أن العدد القياسي حالة خاصة من المصفوفة.",
        ],
    )
    add_image(doc, images["matrix"])
    add_code(
        doc,
        "A = [1 2 3; 4 5 6; 7 8 9];\n"
        "row = A(2, :);      % الصف الثاني بالكامل\n"
        "col = A(:, 3);      % العمود الثالث\n"
        "v = 1:2:10;         % 1 3 5 7 9\n"
        "Z = zeros(3);\n"
        "I = eye(3);\n"
        "R = rand(2, 4);",
    )
    add_callout(doc, "قاعدة ذهبية", "الفهارس في MATLAB تبدأ من 1 وليس من 0.")
    doc.add_page_break()

    # L3
    lecture_header(
        doc,
        "٣",
        "العمليات الحسابية والمنطقية",
        [
            "التفريق بين العمليات المصفوفية والعنصرية.",
            "استخدام العوامل المنطقية للتصفية.",
        ],
    )
    add_image(doc, images["ops"])
    add_code(
        doc,
        "A = [1 2; 3 4];\n"
        "B = [5 6; 7 8];\n"
        "C = A * B;     % ضرب مصفوفي\n"
        "D = A .* B;    % ضرب عنصري\n"
        "E = A .^ 2;    % تربيع كل عنصر\n"
        "mask = A > 2;\n"
        "A(mask)",
    )
    doc.add_page_break()

    # L4
    lecture_header(
        doc,
        "٤",
        "البرمجة: الشروط والحلقات",
        [
            "كتابة if / elseif / else.",
            "استخدام for و while بوعي للأداء.",
            "تجنّب الحلقات الثقيلة عندما تكفي العمليات المتجهة (Vectorization).",
        ],
    )
    add_image(doc, images["flow"])
    add_code(
        doc,
        "n = 10;\n"
        "s = 0;\n"
        "for k = 1:n\n"
        "    if mod(k, 2) == 0\n"
        "        s = s + k;\n"
        "    end\n"
        "end\n"
        "disp(s)\n\n"
        "% بديل متجه أسرع:\n"
        "s2 = sum(2:2:n);",
    )
    doc.add_page_break()

    # L5
    lecture_header(
        doc,
        "٥",
        "السكربتات والدوال",
        [
            "التمييز بين السكربت Script والدالة Function.",
            "تصميم دوال قابلة لإعادة الاستخدام.",
            "توثيق الدالة بتعليقات واضحة.",
        ],
    )
    add_image(doc, images["functions"])
    add_code(
        doc,
        "function [area, peri] = circle_metrics(r)\n"
        "%CIRCLE_METRICS مساحة ومحيط دائرة\n"
        "    area = pi * r.^2;\n"
        "    peri = 2 * pi * r;\n"
        "end",
    )
    add_bullets(
        doc,
        [
            "احفظ الدالة في ملف بنفس الاسم: circle_metrics.m",
            "لا تضع أوامر غير متعلقة خارج الدالة في نفس الملف للمبتدئين.",
        ],
    )
    doc.add_page_break()

    # L6
    lecture_header(
        doc,
        "٦",
        "الرسوم البيانية والتصور",
        [
            "رسم منحنيات أساسية وتحسين مظهرها.",
            "اختيار نوع الرسم المناسب للبيانات.",
            "تصدير الأشكال بجودة عالية.",
        ],
    )
    add_image(doc, images["plots"])
    add_code(
        doc,
        "x = linspace(0, 2*pi, 200);\n"
        "y = sin(x);\n"
        "figure;\n"
        "plot(x, y, 'LineWidth', 2);\n"
        "grid on;\n"
        "xlabel('x'); ylabel('sin(x)');\n"
        "title('Sine Wave');\n"
        "exportgraphics(gcf, 'sine.png', 'Resolution', 300);",
    )
    doc.add_page_break()

    # L7
    lecture_header(
        doc,
        "٧",
        "تحليل البيانات والملفات",
        [
            "استيراد جداول CSV/Excel.",
            "التنظيف الإحصائي الأولي.",
            "حفظ النتائج بصيغ قابلة للمشاركة.",
        ],
    )
    add_image(doc, images["data"])
    add_code(
        doc,
        "T = readtable('data.csv');\n"
        "summary(T);\n"
        "T = fillmissing(T, 'linear');\n"
        "mu = mean(T.Value, 'omitnan');\n"
        "writetable(T, 'clean_data.csv');",
    )
    doc.add_page_break()

    # L8
    lecture_header(
        doc,
        "٨",
        "مقدمة Simulink",
        [
            "فهم فلسفة النمذجة بالكتل.",
            "بناء نموذج بسيط: مصدر → نظام → Scope.",
            "تشغيل المحاكاة وقراءة الإشارات.",
        ],
    )
    add_image(doc, images["simulink"])
    add_bullets(
        doc,
        [
            "ابدأ بنموذج درجة أولى أو توافقي بسيط.",
            "اضبط زمن المحاكاة وحجم الخطوة بوعي.",
            "اربط النتائج لاحقاً مع سكربتات MATLAB للتحليل.",
        ],
    )
    doc.add_page_break()

    # L9
    lecture_header(
        doc,
        "٩",
        "أدوات الاحتراف",
        [
            "التعرف على Live Scripts و App Designer.",
            "تنظيم العمل عبر Projects.",
            "اختيار Toolbox حسب التخصص.",
        ],
    )
    add_image(doc, images["pro"])
    add_body(
        doc,
        "أمثلة أدوات تخصصية: Control System Toolbox، Signal Processing، Optimization، Image Processing، Statistics and Machine Learning.",
    )
    doc.add_page_break()

    # L10
    lecture_header(
        doc,
        "١٠",
        "مشروع ختامي ومسار الاحتراف",
        [
            "تطبيق دورة كاملة: بيانات → نموذج → تصور → تقرير.",
            "اتباع أفضل ممارسات التسمية والتوثيق.",
            "بناء ملف إنجاز شخصي (Portfolio).",
        ],
    )
    add_heading_ar(doc, "مقترح مشروع تطبيقي", 2)
    add_bullets(
        doc,
        [
            "استورد إشارة أو بيانات تجربة مخبرية.",
            "نظّف البيانات وارسمها.",
            "ابنِ نموذجاً بسيطاً (ملاءمة منحنى أو مرشح أو متحكم).",
            "اعرض النتائج في Live Script أو تطبيق App Designer صغير.",
            "صدّر تقريراً قصيراً مع الأشكال والكود.",
        ],
    )
    add_heading_ar(doc, "قائمة أفضل الممارسات", 2)
    add_bullets(
        doc,
        [
            "أسماء متغيرات واضحة: temp_c وليس t1.",
            "دوال قصيرة ذات مسؤولية واحدة.",
            "تعليقات لماذا وليس فقط ماذا.",
            "فصّل البيانات الخام عن النتائج المعالجة.",
            "احفظ أشكالاً بدقة مناسبة للمنشورات العلمية.",
        ],
    )
    add_callout(
        doc,
        "خطوة تالية",
        "بعد إنهاء المحاضرات العشر، خصص مشروعاً من تخصصك (تحكم، إشارة، ميكانيك، بيانات…) وطوّره أسبوعياً كملف إنجاز.",
    )
    doc.add_page_break()

    # Appendix
    add_heading_ar(doc, "ملحق أ: جدول أوامر سريعة", 1)
    table = doc.add_table(rows=1, cols=2)
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    hdr[0].text = "الأمر"
    hdr[1].text = "الوظيفة"
    rows = [
        ("clc", "مسح نافذة الأوامر"),
        ("clear", "حذف المتغيرات من Workspace"),
        ("whos", "عرض تفاصيل المتغيرات"),
        ("help plot", "مساعدة لأمر معين"),
        ("doc mean", "توثيق تفصيلي"),
        ("save my.mat", "حفظ المتغيرات"),
        ("load my.mat", "تحميل ملف MAT"),
        ("size(A)", "أبعاد المصفوفة"),
        ("length(v)", "طول المتجه"),
        ("linspace(a,b,n)", "تقسيم منتظم"),
    ]
    for cmd, meaning in rows:
        cells = table.add_row().cells
        cells[0].text = cmd
        cells[1].text = meaning
    doc.add_paragraph()

    add_heading_ar(doc, "ملحق ب: خطة مراجعة أسبوعية مقترحة", 1)
    add_bullets(
        doc,
        [
            "الأسبوع 1–2: الواجهة + المصفوفات + العمليات.",
            "الأسبوع 3: البرمجة والدوال.",
            "الأسبوع 4: الرسوم والبيانات.",
            "الأسبوع 5: Simulink وأدوات الاحتراف.",
            "الأسبوع 6: مشروع ختامي وتوثيق.",
        ],
    )
    add_body(doc, "نهاية الحزمة — جاهزة للتعديل والنشر كمواد تدريبية.", size=12, bold=True, color=TEAL)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    return OUTPUT


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    images = {
        "cover": make_cover(),
        "roadmap": make_roadmap(),
        "ide": make_ide(),
        "matrix": make_matrix(),
        "ops": make_ops(),
        "flow": make_flow(),
        "functions": make_functions(),
        "plots": make_plots(),
        "data": make_data(),
        "simulink": make_simulink(),
        "pro": make_pro(),
    }
    out = build_docx(images)
    print(f"Wrote: {out}")
    print(f"Assets: {ASSETS}")


if __name__ == "__main__":
    main()
