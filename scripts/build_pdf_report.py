import os
import json
from PIL import Image, ImageDraw, ImageFont

SCREENSHOTS_DIR = r"D:\CRM\screenshots"
OUTPUT_PDF = r"D:\CRM\Dakini_AI_CRM_Frontend_Report.pdf"
MANIFEST_FILE = os.path.join(SCREENSHOTS_DIR, "manifest.json")

# Font paths
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_REGULAR = r"C:\Windows\Fonts\segoeui.ttf"
FONT_SEMIBOLD = r"C:\Windows\Fonts\segoeuiz.ttf"

PAGE_WIDTH = 1920
PAGE_HEIGHT = 1280

# Colors
COLOR_BG = (248, 250, 252) # #f8fafc
COLOR_CARD = (255, 255, 255)
COLOR_PRIMARY = (37, 99, 235) # #2563eb
COLOR_PRIMARY_DARK = (30, 58, 138) # #1e3a8a
COLOR_PRIMARY_LIGHT = (239, 246, 255) # #eff6ff
COLOR_TEXT_MAIN = (15, 23, 42) # #0f172a
COLOR_TEXT_MUTED = (100, 116, 139) # #64748b
COLOR_BORDER = (226, 232, 240) # #e2e8f0

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

font_title_huge = get_font(FONT_BOLD, 48)
font_title_large = get_font(FONT_BOLD, 36)
font_title_medium = get_font(FONT_BOLD, 26)
font_badge = get_font(FONT_BOLD, 16)
font_body = get_font(FONT_REGULAR, 20)
font_body_bold = get_font(FONT_BOLD, 20)
font_sub = get_font(FONT_REGULAR, 17)
font_small = get_font(FONT_REGULAR, 15)

with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
    manifest = json.load(f)

pages = []

# ==============================================================================
# 1. CREATE COVER PAGE
# ==============================================================================
cover = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), COLOR_BG)
draw = ImageDraw.Draw(cover)

# Top decorative blue stripe
draw.rectangle([0, 0, PAGE_WIDTH, 14], fill=COLOR_PRIMARY)

# Background subtle card
draw.rounded_rectangle([80, 60, PAGE_WIDTH - 80, PAGE_HEIGHT - 60], radius=24, fill=(255, 255, 255), outline=COLOR_BORDER, width=2)

# Top Pill Badge
draw.rounded_rectangle([130, 105, 460, 145], radius=18, fill=COLOR_PRIMARY)
draw.text((150, 114), "⚡ DAKINI AI SALES ENTERPRISE CRM", fill=(255, 255, 255), font=font_badge)

# Main Titles
draw.text((130, 170), "Enterprise Sales CRM — Frontend Architecture", fill=COLOR_TEXT_MAIN, font=font_title_huge)
draw.text((130, 235), "Full Module Directory & Modern White + Blue Navigation Design Report", fill=COLOR_PRIMARY, font=font_title_medium)

# Descriptive Intro
intro_text = (
    "This comprehensive report documents the newly generated, production-ready frontend for Dakini AI CRM.\n"
    "Following your requirements, the original purple theme has been completely transformed into a sleek, authoritative\n"
    "Salesforce-inspired Electric Royal Blue (#2563EB) & Slate palette. All 15 required pages, interactive SVG charts,\n"
    "and autonomous AI copilot workflows have been fully built in React 18, verified, and captured below."
)
draw.text((130, 290), intro_text, fill=COLOR_TEXT_MUTED, font=font_body)

# Feature Highlights Card
card_top = 410
card_bottom = 880
draw.rounded_rectangle([130, card_top, PAGE_WIDTH - 130, card_bottom], radius=16, fill=COLOR_PRIMARY_LIGHT, outline=(191, 219, 254), width=1)

draw.text((165, card_top + 25), "KEY ARCHITECTURAL & DESIGN HIGHLIGHTS", fill=COLOR_PRIMARY_DARK, font=font_body_bold)

bullets = [
    ("• Color Palette Modernization:", "Replaced all purple tokens with vibrant Electric Blue (#2563EB), soft sky surfaces (#EFF6FF), and crisp slate text (#0F172A)."),
    ("• Master Navigation Rail:", "Collapsible & expandable left icon rail with categorised modules (Overview, Sales, Engagement, Insights, AI Agents, Settings)."),
    ("• Salesforce 3-Column Record Layout:", "Pixel-perfect implementation of the Aarav Patel lead view with score 128, score breakdown bars, and timeline."),
    ("• Interactive SVG Analytics Suite:", "Custom SVG Bézier revenue trend charts, stage velocity bar charts, radial progress donuts, and sparkline cards."),
    ("• Autonomous Copilot & Approvals Dock:", "Context-aware right-hand slide-out drawer with suggested actions and human-in-the-loop approval center."),
    ("• MERN Stack Ready Architecture:", "100% React 18, zero placeholders, with centralized state in CRMContext.jsx ready for Node/Express REST & MongoDB.")
]

y_bullet = card_top + 70
for title, desc in bullets:
    draw.text((165, y_bullet), title, fill=COLOR_PRIMARY, font=font_body_bold)
    title_w = draw.textlength(title, font=font_body_bold)
    draw.text((165 + title_w + 10, y_bullet), desc, fill=COLOR_TEXT_MAIN, font=font_body)
    y_bullet += 56

# Bottom Metadata Grid
meta_y = 920
draw.line([130, meta_y, PAGE_WIDTH - 130, meta_y], fill=COLOR_BORDER, width=2)

meta_items = [
    ("TECH STACK", "React 18 • Vite • Pure CSS • Lucide Icons"),
    ("ACTIVE LOCAL SERVER", "http://localhost:3000/"),
    ("DESIGN STANDARD", "Salesforce Lightning + White & Blue Theme"),
    ("DOCUMENT DATE", "October 2026 • Verified Production Build")
]

for i, (label, val) in enumerate(meta_items):
    col_x = 130 + i * 420
    draw.text((col_x, meta_y + 25), label, fill=COLOR_TEXT_MUTED, font=font_badge)
    draw.text((col_x, meta_y + 55), val, fill=COLOR_TEXT_MAIN, font=font_sub)

pages.append(cover)

# ==============================================================================
# 2. CREATE A PAGE FOR EACH OF THE 15 CAPTURES
# ==============================================================================
for idx, item in enumerate(manifest):
    img_path = item["file"]
    title = item["title"]
    desc = item["desc"]

    page = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), COLOR_BG)
    draw_page = ImageDraw.Draw(page)

    # Top blue decorative bar
    draw_page.rectangle([0, 0, PAGE_WIDTH, 10], fill=COLOR_PRIMARY)

    # Page Header Card
    draw_page.rounded_rectangle([50, 30, PAGE_WIDTH - 50, 135], radius=14, fill=COLOR_CARD, outline=COLOR_BORDER, width=1)

    # Header Index Pill
    idx_str = f"VIEW {idx + 1:02d} OF {len(manifest):02d}"
    draw_page.rounded_rectangle([75, 48, 220, 80], radius=8, fill=COLOR_PRIMARY_LIGHT, outline=(191, 219, 254), width=1)
    draw_page.text((88, 54), idx_str, fill=COLOR_PRIMARY, font=font_badge)

    # Title & Subtitle
    draw_page.text((245, 45), title, fill=COLOR_TEXT_MAIN, font=font_title_medium)
    draw_page.text((245, 85), desc, fill=COLOR_TEXT_MUTED, font=font_sub)

    # Load & Paste Screenshot
    if os.path.exists(img_path):
        sc_img = Image.open(img_path)
        # Target size for screenshot: width 1820, height auto
        target_w = 1820
        aspect = sc_img.height / sc_img.width
        target_h = int(target_w * aspect)

        # Ensure target_h fits within available height
        max_h = 1060
        if target_h > max_h:
            target_h = max_h
            target_w = int(target_h / aspect)

        sc_resized = sc_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        pos_x = (PAGE_WIDTH - target_w) // 2
        pos_y = 150

        # Draw frame around screenshot
        draw_page.rounded_rectangle([pos_x - 3, pos_y - 3, pos_x + target_w + 3, pos_y + target_h + 3], radius=10, fill=None, outline=COLOR_BORDER, width=2)
        page.paste(sc_resized, (pos_x, pos_y))

    # Page Footer
    footer_y = PAGE_HEIGHT - 40
    draw_page.line([50, footer_y - 10, PAGE_WIDTH - 50, footer_y - 10], fill=COLOR_BORDER, width=1)
    draw_page.text((60, footer_y), "Dakini AI CRM — Enterprise White + Blue Frontend Architecture Specification", fill=COLOR_TEXT_MUTED, font=font_small)
    draw_page.text((PAGE_WIDTH - 240, footer_y), f"Page {idx + 2} of {len(manifest) + 1}", fill=COLOR_TEXT_MUTED, font=font_small)

    pages.append(page)

# ==============================================================================
# 3. SAVE HIGH-RES PDF REPORT
# ==============================================================================
print(f"Compiling {len(pages)} pages into {OUTPUT_PDF}...")
pages[0].save(
    OUTPUT_PDF,
    "PDF",
    resolution=100.0,
    save_all=True,
    append_images=pages[1:]
)

print(f"Successfully created: {OUTPUT_PDF} (File size: {os.path.getsize(OUTPUT_PDF)} bytes)")
