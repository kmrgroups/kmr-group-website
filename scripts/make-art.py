#!/usr/bin/env python3
"""Builds the website's built-in illustrations (public/img/kmr/*.svg) in the KMR navy & gold style.
They are shown wherever no photo has been uploaded in KMR Console › Website CMS; an uploaded photo always wins.
Run:  python3 scripts/make-art.py"""
import os, math

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "img", "kmr")
NAVY, NAVY2, NAVY3 = "#0A1F4D", "#0F2C6B", "#163A86"
GOLD, GOLD2, CREAM = "#C9A24B", "#E8C77A", "#FBF7EE"
INK, MUTED, LINE = "#16233A", "#8A95A8", "#E6E9F0"
OK, AMBER, RED = "#16A34A", "#F59E0B", "#DC2626"
FONT = "font-family='Segoe UI,Roboto,Arial,sans-serif'"
W, H = 640, 400


def svg(body, title):
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' role='img' aria-label='{title}'>"
            f"<title>{title}</title>{body}</svg>")


def bg(accent):
    """navy backdrop with soft glows, a gold arc and a dot grid"""
    dots = "".join(f"<circle cx='{x}' cy='{y}' r='1.3' fill='#ffffff' opacity='.10'/>" for x in range(24, 640, 26) for y in range(20, 400, 26))
    return (f"<defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{NAVY}'/><stop offset='1' stop-color='{NAVY3}'/></linearGradient>"
            f"<radialGradient id='glow' cx='.85' cy='.15' r='.6'><stop offset='0' stop-color='{accent}' stop-opacity='.55'/><stop offset='1' stop-color='{accent}' stop-opacity='0'/></radialGradient>"
            f"<radialGradient id='glow2' cx='.05' cy='.95' r='.5'><stop offset='0' stop-color='{GOLD}' stop-opacity='.35'/><stop offset='1' stop-color='{GOLD}' stop-opacity='0'/></radialGradient>"
            f"<filter id='sh' x='-10%' y='-10%' width='120%' height='130%'><feDropShadow dx='0' dy='10' stdDeviation='12' flood-color='#000' flood-opacity='.35'/></filter></defs>"
            f"<rect width='{W}' height='{H}' fill='url(#bg)'/>{dots}<rect width='{W}' height='{H}' fill='url(#glow)'/><rect width='{W}' height='{H}' fill='url(#glow2)'/>"
            f"<circle cx='590' cy='370' r='120' fill='none' stroke='{GOLD}' stroke-opacity='.35' stroke-width='2'/>"
            f"<circle cx='590' cy='370' r='90' fill='none' stroke='{GOLD}' stroke-opacity='.2' stroke-width='1.5'/>")


def window(accent, name, body, nav=5):
    """an app window: title bar, coloured sidebar, content area at (150, 70)"""
    items = "".join(f"<rect x='62' y='{112 + i * 26}' width='{52 if i % 2 else 64}' height='7' rx='3.5' fill='#ffffff' opacity='{.9 if i == 0 else .45}'/>"
                    f"<rect x='48' y='{110 + i * 26}' width='8' height='11' rx='2' fill='#ffffff' opacity='{.9 if i == 0 else .45}'/>" for i in range(nav))
    return (f"<g filter='url(#sh)'><rect x='36' y='34' width='568' height='336' rx='14' fill='#ffffff'/></g>"
            f"<path d='M36 48a14 14 0 0 1 14-14h540a14 14 0 0 1 14 14v12H36z' fill='{CREAM}'/>"
            f"<circle cx='54' cy='47' r='4.5' fill='#F87171'/><circle cx='68' cy='47' r='4.5' fill='{AMBER}'/><circle cx='82' cy='47' r='4.5' fill='{OK}'/>"
            f"<rect x='250' y='40' width='140' height='14' rx='7' fill='#ffffff' stroke='{LINE}'/>"
            f"<path d='M36 60h100v296a14 14 0 0 1-14 14H50a14 14 0 0 1-14-14z' fill='{accent}'/>"
            f"<rect x='48' y='74' width='18' height='18' rx='5' fill='{GOLD2}'/>"
            f"<text x='72' y='87' {FONT} font-size='11' font-weight='700' fill='#fff'>{name}</text>{items}"
            f"<g transform='translate(150 70)'>{body}</g>")


def kpi(x, y, w, label, value, color):
    return (f"<rect x='{x}' y='{y}' width='{w}' height='54' rx='9' fill='#F6F8FC' stroke='{LINE}'/>"
            f"<rect x='{x}' y='{y}' width='4' height='54' rx='2' fill='{color}'/>"
            f"<text x='{x + 14}' y='{y + 26}' {FONT} font-size='18' font-weight='800' fill='{INK}'>{value}</text>"
            f"<text x='{x + 14}' y='{y + 43}' {FONT} font-size='9.5' fill='{MUTED}'>{label}</text>")


def bars(x, y, w, h, vals, color, base=None, labels=None):
    n = len(vals); bw = w / n * .56; mx = max(vals + ([base] if base else []))
    out = f"<line x1='{x}' y1='{y + h}' x2='{x + w}' y2='{y + h}' stroke='{LINE}'/>"
    for i, v in enumerate(vals):
        bh = h * v / mx; bx = x + i * w / n + (w / n - bw) / 2
        c = color(i, v) if callable(color) else color
        out += f"<rect x='{bx:.1f}' y='{y + h - bh:.1f}' width='{bw:.1f}' height='{bh:.1f}' rx='3' fill='{c}'/>"
        if labels: out += f"<text x='{bx + bw / 2:.1f}' y='{y + h + 13}' {FONT} font-size='8.5' fill='{MUTED}' text-anchor='middle'>{labels[i]}</text>"
    if base:
        by = y + h - h * base / mx
        out += f"<line x1='{x}' y1='{by:.1f}' x2='{x + w}' y2='{by:.1f}' stroke='{RED}' stroke-dasharray='4 3' stroke-width='1.5'/>"
    return out


def chip(x, y, text, color, w=None):
    w = w or len(text) * 6 + 14
    return f"<rect x='{x}' y='{y}' width='{w}' height='16' rx='8' fill='{color}' opacity='.15'/><text x='{x + w / 2}' y='{y + 11.5}' {FONT} font-size='9' font-weight='700' fill='{color}' text-anchor='middle'>{text}</text>"


def rows(x, y, w, data, colw, head=None, rh=20):
    out = ""
    if head:
        out += f"<rect x='{x}' y='{y}' width='{w}' height='{rh}' rx='5' fill='{NAVY}'/>"
        cx = x + 8
        for i, t in enumerate(head):
            out += f"<text x='{cx}' y='{y + 13.5}' {FONT} font-size='9' font-weight='700' fill='#fff'>{t}</text>"; cx += colw[i]
        y += rh + 2
    for r, row in enumerate(data):
        out += f"<rect x='{x}' y='{y}' width='{w}' height='{rh}' fill='{'#F6F8FC' if r % 2 == 0 else '#fff'}'/>"
        cx = x + 8
        for i, cell in enumerate(row):
            if isinstance(cell, tuple): out += chip(cx - 2, y + 2, cell[0], cell[1])
            else: out += f"<text x='{cx}' y='{y + 13.5}' {FONT} font-size='9' fill='{INK}'>{cell}</text>"
            cx += colw[i]
        y += rh
    return out


def heading(t, sub=""):
    return (f"<text x='0' y='14' {FONT} font-size='14' font-weight='800' fill='{INK}'>{t}</text>"
            + (f"<text x='0' y='28' {FONT} font-size='9.5' fill='{MUTED}'>{sub}</text>" if sub else ""))


# ---------------------------------------------------------------- apps
def app_hrm():
    a = "#0EA5E9"
    b = heading("Today · Plant 1", "Attendance from biometric devices")
    b += kpi(0, 38, 132, "Employees", "248", a) + kpi(142, 38, 132, "Present", "231", OK) + kpi(284, 38, 132, "On leave", "9", AMBER)
    b += f"<rect x='0' y='104' width='274' height='176' rx='10' fill='#fff' stroke='{LINE}'/><text x='12' y='124' {FONT} font-size='10.5' font-weight='700' fill='{INK}'>Attendance this week</text>"
    b += bars(14, 136, 246, 112, [92, 95, 89, 97, 94, 90], a, labels=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    # ID card
    b += (f"<g transform='translate(288 104)'><rect width='130' height='176' rx='10' fill='{NAVY}'/><rect width='130' height='34' rx='10' fill='{GOLD}'/><rect y='24' width='130' height='10' fill='{GOLD}'/>"
          f"<text x='65' y='22' {FONT} font-size='9.5' font-weight='800' fill='{NAVY}' text-anchor='middle'>EMPLOYEE ID</text>"
          f"<circle cx='65' cy='72' r='24' fill='{CREAM}'/><circle cx='65' cy='66' r='9' fill='{MUTED}'/><path d='M47 90a18 14 0 0 1 36 0' fill='{MUTED}'/>"
          f"<rect x='28' y='106' width='74' height='8' rx='4' fill='#fff'/><rect x='38' y='120' width='54' height='6' rx='3' fill='#fff' opacity='.5'/>"
          f"<g fill='#fff'>" + "".join(f"<rect x='{44 + (i % 6) * 7}' y='{136 + (i // 6) * 7}' width='5' height='5' opacity='{.95 if (i * 7) % 3 else .3}'/>" for i in range(30)) + "</g></g>")
    return window(a, "HRM Suite", b)


def app_balloon():
    a = "#A855F7"
    b = heading("DF-2040 · Drive flange", "24 characteristics ballooned")
    b += f"<rect x='0' y='38' width='250' height='242' rx='10' fill='#FBFCFE' stroke='{LINE}'/>"
    # drawing: flange front view with dims
    cx, cy = 125, 160
    b += f"<g stroke='{NAVY2}' fill='none' stroke-width='1.6'><circle cx='{cx}' cy='{cy}' r='78'/><circle cx='{cx}' cy='{cy}' r='30'/><circle cx='{cx}' cy='{cy}' r='54' stroke-dasharray='6 3 1 3' stroke-width='.9'/>"
    b += "".join(f"<circle cx='{cx + 54 * math.cos(t):.1f}' cy='{cy + 54 * math.sin(t):.1f}' r='7'/>" for t in [i * math.pi / 3 for i in range(6)]) + "</g>"
    b += f"<g stroke='{MUTED}' stroke-width='.8'><line x1='{cx - 78}' y1='{cy + 96}' x2='{cx + 78}' y2='{cy + 96}'/><line x1='{cx - 78}' y1='{cy + 82}' x2='{cx - 78}' y2='{cy + 100}'/><line x1='{cx + 78}' y1='{cy + 82}' x2='{cx + 78}' y2='{cy + 100}'/></g>"
    b += f"<text x='{cx}' y='{cy + 92}' {FONT} font-size='9' fill='{INK}' text-anchor='middle'>Ø120 h8</text>"
    for n, (x, y) in enumerate([(30, 70), (205, 84), (186, 236), (36, 228), (125, 112)], 1):
        b += f"<circle cx='{x}' cy='{y}' r='11' fill='{a}'/><text x='{x}' y='{y + 3.6}' {FONT} font-size='10' font-weight='800' fill='#fff' text-anchor='middle'>{n}</text>"
    b += rows(262, 38, 156, [["1", "Ø120 h8", ("OK", OK)], ["2", "Ø62 H7", ("SC", AMBER)], ["3", "Ø80 k5", ("OK", OK)], ["4", "45 ±0.05", ("OK", OK)], ["5", "Ø40 +0.025", ("CC", RED)],
                              ["6", "6X Ø9", ("OK", OK)], ["7", "⌖ Ø0.1 A B", ("SC", AMBER)], ["8", "M8x1.25", ("OK", OK)], ["9", "PCD Ø100", ("OK", OK)], ["10", "Ra 0.8", ("OK", OK)]],
              [22, 82, 50], head=["#", "Characteristic", "Status"])
    return window(a, "Balloon Inspector", b)


def app_pd():
    a = "#F59E0B"
    b = heading("Process flow · PFMEA · Control plan", "Generated from the ballooned drawing")
    steps = [("10", "Receive"), ("20", "Turn OP1"), ("30", "Turn OP2"), ("40", "VMC"), ("50", "Inspect")]
    for i, (no, nm) in enumerate(steps):
        x = i * 86
        shape = (f"<rect x='{x}' y='40' width='72' height='46' rx='8' fill='#fff' stroke='{a}' stroke-width='2'/>" if i != 4 else
                 f"<rect x='{x}' y='40' width='72' height='46' fill='#fff' stroke='{NAVY2}' stroke-width='2'/>")
        b += shape + f"<text x='{x + 36}' y='59' {FONT} font-size='10' font-weight='800' fill='{INK}' text-anchor='middle'>OP {no}</text><text x='{x + 36}' y='74' {FONT} font-size='9' fill='{MUTED}' text-anchor='middle'>{nm}</text>"
        if i < 4: b += f"<path d='M{x + 74} 63h10' stroke='{NAVY2}' stroke-width='2'/><path d='M{x + 84} 59l5 4-5 4z' fill='{NAVY2}'/>"
    b += rows(0, 102, 418, [["OP 20", "Ø62 H7 oversize", "7", "3", "4", ("M", AMBER)], ["OP 30", "Ø40 bore taper", "8", "4", "3", ("H", RED)], ["OP 40", "Hole missing", "7", "2", "2", ("L", OK)],
                            ["OP 40", "Thread NG", "6", "3", "3", ("M", AMBER)], ["OP 50", "Burr on edge", "4", "3", "2", ("L", OK)], ["OP 50", "Mix-up of parts", "8", "2", "3", ("M", AMBER)]],
              [52, 168, 46, 46, 46, 50], head=["Op", "Failure mode", "S", "O", "D", "AP"], rh=22)
    return window(a, "Process Docs", b)


def app_capacity():
    a = "#10B981"
    b = heading("Machine loading · October", "Plan vs available hours (100% line)")
    ms = [("CNC-T01", 82), ("CNC-T02", 96), ("CNC-T03", 112), ("VMC-M01", 74), ("VMC-M02", 104), ("HMC-H01", 61), ("CGR-01", 88)]
    for i, (m, p) in enumerate(ms):
        y = 42 + i * 32; w = 300 * p / 120
        c = RED if p > 100 else AMBER if p > 90 else a
        b += f"<text x='0' y='{y + 13}' {FONT} font-size='9.5' font-weight='600' fill='{INK}'>{m}</text><rect x='62' y='{y + 2}' width='300' height='16' rx='8' fill='#F1F4F9'/><rect x='62' y='{y + 2}' width='{w:.0f}' height='16' rx='8' fill='{c}'/>"
        b += f"<text x='{62 + w + 6:.0f}' y='{y + 14}' {FONT} font-size='9.5' font-weight='800' fill='{c}'>{p}%</text>"
    b += f"<line x1='312' y1='38' x2='312' y2='266' stroke='{NAVY2}' stroke-dasharray='4 3' stroke-width='1.5'/><text x='312' y='280' {FONT} font-size='9' fill='{NAVY2}' text-anchor='middle'>100%</text>"
    return window(a, "Capacity", b)


def app_sales():
    a = "#E11D48"
    b = heading("Sales plan vs despatch", "This month · all customers")
    b += kpi(0, 38, 132, "Plan value", "₹48.6 L", NAVY2) + kpi(142, 38, 132, "Despatched", "₹41.2 L", OK) + kpi(284, 38, 132, "Pending", "₹7.4 L", a)
    b += f"<rect x='0' y='104' width='274' height='176' rx='10' fill='#fff' stroke='{LINE}'/><text x='12' y='124' {FONT} font-size='10.5' font-weight='700' fill='{INK}'>Plan vs actual by customer</text>"
    pl, ac = [90, 70, 55, 40], [86, 58, 54, 26]
    for i in range(4):
        x = 24 + i * 62
        b += f"<rect x='{x}' y='{262 - pl[i] * 1.1:.0f}' width='18' height='{pl[i] * 1.1:.0f}' rx='3' fill='#CBD5E1'/><rect x='{x + 20}' y='{262 - ac[i] * 1.1:.0f}' width='18' height='{ac[i] * 1.1:.0f}' rx='3' fill='{a}'/>"
        b += f"<text x='{x + 19}' y='275' {FONT} font-size='8.5' fill='{MUTED}' text-anchor='middle'>CUS-00{i + 1}</text>"
    # donut of loss reasons
    b += f"<g transform='translate(288 104)'><rect width='130' height='176' rx='10' fill='#fff' stroke='{LINE}'/><text x='10' y='20' {FONT} font-size='10.5' font-weight='700' fill='{INK}'>Loss reasons</text>"
    start = -math.pi / 2
    for frac, col in [(.4, a), (.25, AMBER), (.2, NAVY2), (.15, MUTED)]:
        end = start + frac * 2 * math.pi; r = 36; cx, cy = 65, 82
        x1, y1, x2, y2 = cx + r * math.cos(start), cy + r * math.sin(start), cx + r * math.cos(end), cy + r * math.sin(end)
        b += f"<path d='M{x1:.1f} {y1:.1f}A{r} {r} 0 {1 if frac > .5 else 0} 1 {x2:.1f} {y2:.1f}' stroke='{col}' stroke-width='16' fill='none'/>"; start = end
    for i, (t, c) in enumerate([("Raw material", a), ("Machine", AMBER), ("Manpower", NAVY2), ("Others", MUTED)]):
        b += f"<rect x='12' y='{132 + i * 10}' width='7' height='7' rx='2' fill='{c}'/><text x='24' y='{138.5 + i * 10}' {FONT} font-size='8.5' fill='{INK}'>{t}</text>"
    b += "</g>"
    return window(a, "Sales Flow", b)


def app_calib():
    a = "#6366F1"
    b = heading("Calibration due control", "152 instruments · 3 due this week")
    # dial gauge
    b += (f"<g transform='translate(70 150)'><circle r='70' fill='#fff' stroke='{NAVY2}' stroke-width='4'/><circle r='60' fill='{CREAM}'/>"
          + "".join(f"<line x1='{52 * math.cos(t):.1f}' y1='{52 * math.sin(t):.1f}' x2='{(46 if i % 5 else 40) * math.cos(t):.1f}' y2='{(46 if i % 5 else 40) * math.sin(t):.1f}' stroke='{INK}' stroke-width='{1.8 if i % 5 == 0 else 1}'/>"
                    for i, t in enumerate([k * 2 * math.pi / 50 for k in range(50)]))
          + f"<line x1='0' y1='0' x2='30' y2='-34' stroke='{RED}' stroke-width='3' stroke-linecap='round'/><circle r='6' fill='{NAVY}'/>"
          f"<rect x='-8' y='-96' width='16' height='26' rx='3' fill='{NAVY2}'/><rect x='-3' y='70' width='6' height='34' fill='{MUTED}'/></g>")
    b += rows(160, 38, 258, [["GA-MC-001", "Micrometer 0–25", ("Due 3 d", AMBER)], ["GA-BG-001", "Bore gauge 35–50", ("Overdue", RED)], ["GA-VC-002", "Vernier 0–200", ("OK", OK)],
                             ["GA-PG-001", "Plug gauge Ø12 H7", ("OK", OK)], ["GA-RG-001", "Ring gauge Ø30 h6", ("Due 6 d", AMBER)], ["GA-HG-001", "Height gauge 300", ("OK", OK)],
                             ["GA-CMM-01", "CMM 700×1000", ("OK", OK)], ["GA-TW-002", "Torque wrench 50 Nm", ("OOT", RED)]],
              [70, 118, 70], head=["Gauge ID", "Instrument", "Status"], rh=24)
    return window(a, "Calibration", b)


# ---------------------------------------------------------------- business verticals / services / training (scenes)
def card(x, y, w, h, fill="#fff"):
    return f"<g filter='url(#sh)'><rect x='{x}' y='{y}' width='{w}' height='{h}' rx='14' fill='{fill}'/></g>"


def scene_shop():
    b = bg(GOLD)
    # shelf with boxes and tools
    b += card(60, 70, 340, 270) + f"<rect x='60' y='70' width='340' height='40' rx='14' fill='{NAVY2}'/><rect x='60' y='96' width='340' height='14' fill='{NAVY2}'/>"
    b += f"<text x='80' y='96' {FONT} font-size='15' font-weight='800' fill='#fff'>Industrial supplies</text>"
    for sy in (190, 300):
        b += f"<rect x='76' y='{sy}' width='308' height='8' rx='3' fill='{GOLD}'/>"
    boxes = [(84, 140, 60, 50, "#D8B36A"), (150, 154, 46, 36, "#C29548"), (204, 128, 70, 62, "#E2C27F"), (282, 148, 54, 42, "#D8B36A"), (342, 160, 36, 30, "#C29548")]
    for x, y, w, h, c in boxes:
        b += f"<rect x='{x}' y='{y}' width='{w}' height='{h}' rx='3' fill='{c}'/><rect x='{x + w / 2 - 5}' y='{y}' width='10' height='{h}' fill='#fff' opacity='.35'/>"
    # tools on lower shelf: wrench, gear, drill bit
    b += f"<g transform='translate(110 250)' fill='{NAVY2}'><rect x='-32' y='-6' width='64' height='12' rx='6'/><circle cx='-34' cy='0' r='14'/><circle cx='-34' cy='0' r='6' fill='#fff'/></g>"
    b += "<g transform='translate(220 252)'>" + "".join(f"<rect x='-5' y='-34' width='10' height='14' rx='2' fill='{GOLD}' transform='rotate({k * 45})'/>" for k in range(8)) + f"<circle r='26' fill='{GOLD}'/><circle r='10' fill='#fff'/></g>"
    b += f"<g transform='translate(320 250) rotate(-30)'><rect x='-6' y='-40' width='12' height='70' rx='3' fill='{MUTED}'/><path d='M-6 30l6 16 6-16z' fill='{MUTED}'/></g>"
    # cart + invoice
    b += card(430, 150, 170, 190) + f"<text x='448' y='180' {FONT} font-size='13' font-weight='800' fill='{INK}'>Your order</text>"
    for i, (t, p) in enumerate([("Safety gloves ×20", "₹1,800"), ("Cutting oil 5 L", "₹1,450"), ("Insert CNMG ×10", "₹3,900")]):
        b += f"<text x='448' y='{206 + i * 22}' {FONT} font-size='10' fill='{INK}'>{t}</text><text x='584' y='{206 + i * 22}' {FONT} font-size='10' font-weight='700' fill='{INK}' text-anchor='end'>{p}</text>"
    b += f"<line x1='448' y1='272' x2='584' y2='272' stroke='{LINE}'/><text x='448' y='290' {FONT} font-size='10' fill='{MUTED}'>GST invoice included</text>"
    b += f"<rect x='448' y='302' width='136' height='26' rx='13' fill='{GOLD}'/><text x='516' y='319' {FONT} font-size='11' font-weight='800' fill='{NAVY}' text-anchor='middle'>Pay securely</text>"
    return svg(b, "Industrial supplies shop")


def scene_software():
    b = bg("#38BDF8")
    b += card(70, 60, 380, 240) + f"<rect x='70' y='60' width='380' height='28' rx='14' fill='{CREAM}'/><rect x='70' y='76' width='380' height='12' fill='{CREAM}'/>"
    b += f"<circle cx='88' cy='74' r='4.5' fill='#F87171'/><circle cx='102' cy='74' r='4.5' fill='{AMBER}'/><circle cx='116' cy='74' r='4.5' fill='{OK}'/>"
    for i, (x, c, v, l) in enumerate([(88, NAVY2, "92%", "OEE"), (206, OK, "0.6%", "Rejection"), (324, GOLD, "98%", "On-time")]):
        b += f"<rect x='{x}' y='104' width='108' height='58' rx='10' fill='#F6F8FC' stroke='{LINE}'/><rect x='{x}' y='104' width='4' height='58' rx='2' fill='{c}'/><text x='{x + 14}' y='134' {FONT} font-size='20' font-weight='800' fill='{INK}'>{v}</text><text x='{x + 14}' y='151' {FONT} font-size='10' fill='{MUTED}'>{l}</text>"
    pts = [(96, 270), (150, 248), (204, 256), (258, 224), (312, 230), (366, 196), (420, 186)]
    b += f"<polyline points='{' '.join(f'{x},{y}' for x, y in pts)}' fill='none' stroke='{NAVY2}' stroke-width='3' stroke-linejoin='round'/>"
    b += f"<polygon points='96,286 {' '.join(f'{x},{y}' for x, y in pts)} 420,286' fill='{NAVY2}' opacity='.08'/>" + "".join(f"<circle cx='{x}' cy='{y}' r='4' fill='{GOLD}'/>" for x, y in pts)
    b += f"<rect x='230' y='300' width='60' height='22' fill='#CBD5E1'/><rect x='190' y='320' width='140' height='10' rx='5' fill='#CBD5E1'/>"
    # phone
    b += card(470, 110, 120, 220, NAVY) + f"<rect x='480' y='126' width='100' height='186' rx='10' fill='#fff'/><rect x='510' y='116' width='40' height='5' rx='2.5' fill='#fff' opacity='.4'/>"
    for i in range(5):
        b += f"<rect x='490' y='{140 + i * 32}' width='80' height='24' rx='6' fill='#F6F8FC'/><circle cx='502' cy='{152 + i * 32}' r='6' fill='{[NAVY2, GOLD, OK, '#38BDF8', AMBER][i]}'/><rect x='514' y='{148 + i * 32}' width='{40 - i * 3}' height='6' rx='3' fill='{MUTED}'/>"
    b += f"<text x='482' y='100' {FONT} font-size='26' font-weight='800' fill='{GOLD2}'>&lt;/&gt;</text>"
    return svg(b, "Software for manufacturers")


def scene_training():
    b = bg("#A78BFA")
    b += card(70, 56, 330, 200) + f"<rect x='86' y='72' width='298' height='168' rx='6' fill='{NAVY}'/>"
    b += f"<text x='104' y='102' {FONT} font-size='15' font-weight='800' fill='{GOLD2}'>IATF 16949 · Core tools</text>"
    for i, t in enumerate(["APQP", "PPAP", "FMEA", "SPC", "MSA"]):
        b += f"<rect x='{104 + i * 54}' y='120' width='46' height='26' rx='13' fill='#fff' opacity='.12'/><text x='{127 + i * 54}' y='137' {FONT} font-size='10' font-weight='700' fill='#fff' text-anchor='middle'>{t}</text>"
    pts = [(104, 220), (150, 206), (196, 212), (242, 188), (288, 194), (334, 172), (368, 176)]
    b += f"<polyline points='{' '.join(f'{x},{y}' for x, y in pts)}' fill='none' stroke='{GOLD2}' stroke-width='2.5'/><line x1='104' y1='190' x2='368' y2='190' stroke='#fff' stroke-opacity='.4' stroke-dasharray='5 4'/>"
    b += f"<rect x='225' y='256' width='20' height='40' fill='{MUTED}'/>"
    # trainer
    b += f"<g transform='translate(450 190)'><circle cx='0' cy='-56' r='22' fill='#F2C9A0'/><path d='M-22 -62a22 22 0 0 1 44 0q-6-14-22-14t-22 14z' fill='{NAVY}'/><path d='M-36 40v-46a20 20 0 0 1 20-20h32a20 20 0 0 1 20 20v46z' fill='{GOLD}'/><path d='M-30 -8l-46-30' stroke='{GOLD}' stroke-width='12' stroke-linecap='round'/><circle cx='-80' cy='-40' r='7' fill='#F2C9A0'/><path d='M-6 -26l6 12 6-12' fill='#fff'/></g>"
    # audience heads
    for i, c in enumerate([NAVY2, "#475569", NAVY3, "#334155", NAVY2]):
        x = 110 + i * 92
        b += f"<g transform='translate({x} 352)'><circle cx='0' cy='-28' r='15' fill='#E8B98E'/><path d='M-15 -32a15 15 0 0 1 30 0q-4-10-15-10t-15 10z' fill='#1F2937'/><path d='M-26 24v-18a16 16 0 0 1 16-16h20a16 16 0 0 1 16 16v18z' fill='{c}'/></g>"
    return svg(b, "Training and development")


def scene_trade():
    b = bg("#22D3EE")
    # globe
    b += f"<g transform='translate(190 180)'><circle r='110' fill='{NAVY2}' stroke='{GOLD}' stroke-width='3'/>"
    b += "".join(f"<ellipse rx='{r}' ry='110' fill='none' stroke='#fff' stroke-opacity='.25'/>" for r in (36, 76))
    b += "".join(f"<line x1='-110' y1='{y}' x2='110' y2='{y}' stroke='#fff' stroke-opacity='.2'/>" for y in (-60, 0, 60))
    b += f"<path d='M-70 -40q20-30 50-20t40 20q-10 20 10 40t-20 40q-30 0-40-30t-40-50z' fill='{OK}' opacity='.75'/><path d='M30 -80q30 0 50 30t0 40q-20-10-30 10t-30-20z' fill='{OK}' opacity='.75'/>"
    b += f"<path d='M-60 50Q10-110 80-20' fill='none' stroke='{GOLD2}' stroke-width='3' stroke-dasharray='7 5'/><circle cx='-60' cy='50' r='7' fill='{GOLD2}'/><circle cx='80' cy='-20' r='7' fill='{GOLD2}'/></g>"
    # ship with containers
    b += f"<g transform='translate(330 300)'><path d='M0 0h260l-28 44H24z' fill='{NAVY}'/><rect x='170' y='-50' width='44' height='50' fill='#fff'/><rect x='178' y='-42' width='28' height='10' fill='{NAVY2}'/>"
    for i, c in enumerate([GOLD, "#E11D48", "#0EA5E9", OK, GOLD2, "#6366F1"]):
        x, y = 14 + (i % 3) * 52, -26 - (i // 3) * 26
        b += f"<rect x='{x}' y='{y}' width='48' height='24' fill='{c}'/>" + "".join(f"<line x1='{x + k}' y1='{y + 3}' x2='{x + k}' y2='{y + 21}' stroke='#000' stroke-opacity='.15'/>" for k in range(8, 48, 8))
    b += "</g><path d='M300 352q30-10 60 0t60 0 60 0 60 0 60 0' stroke='#fff' stroke-opacity='.5' stroke-width='3' fill='none'/>"
    return svg(b, "Import, export and trading")


def scene_invest():
    b = bg(OK) + card(70, 70, 330, 260) + f"<text x='92' y='108' {FONT} font-size='15' font-weight='800' fill='{INK}'>Growth together</text>"
    vals = [40, 58, 52, 74, 88, 104, 130]
    for i, v in enumerate(vals):
        b += f"<rect x='{96 + i * 42}' y='{300 - v * 1.2:.0f}' width='26' height='{v * 1.2:.0f}' rx='4' fill='{NAVY2 if i < 6 else GOLD}'/>"
    b += f"<polyline points='{' '.join(f'{109 + i * 42},{300 - v * 1.2 - 12:.0f}' for i, v in enumerate(vals))}' fill='none' stroke='{OK}' stroke-width='3'/><path d='M362 132l14-4-4 14' fill='{OK}'/>"
    # handshake
    b += (f"<g transform='translate(510 210)'><circle r='92' fill='#fff' opacity='.1'/><path d='M-80 10l40-30h30l24 18-20 22-24-14z' fill='{GOLD}'/><path d='M80 10l-40-30h-26l-34 26 14 16 30-18 22 16z' fill='#F2C9A0'/>"
          f"<path d='M-34 20q10 14 22 8t20 6 16-6 14 0' stroke='{NAVY}' stroke-width='3' fill='none'/><rect x='-96' y='-4' width='22' height='34' rx='4' fill='{NAVY2}'/><rect x='74' y='-4' width='22' height='34' rx='4' fill='{NAVY2}'/></g>")
    return svg(b, "Investment and partnerships")


def doc_scene(accent, title, lines, art, label):
    """a document card on the left + a topic badge on the right"""
    title, lines = title.replace("&", "&amp;"), [t.replace("&", "&amp;") for t in lines]
    b = bg(accent) + card(70, 60, 300, 280) + f"<rect x='70' y='60' width='300' height='56' rx='14' fill='{NAVY2}'/><rect x='70' y='100' width='300' height='16' fill='{NAVY2}'/>"
    b += f"<text x='92' y='96' {FONT} font-size='17' font-weight='800' fill='#fff'>{title}</text>"
    for i, t in enumerate(lines):
        y = 146 + i * 34
        b += f"<circle cx='100' cy='{y - 4}' r='10' fill='{OK}' opacity='.15'/><path d='M95 {y - 4}l4 4 7-8' stroke='{OK}' stroke-width='2.4' fill='none' stroke-linecap='round'/><text x='120' y='{y}' {FONT} font-size='13' fill='{INK}'>{t}</text>"
    return svg(b + art, label)


def badge_shield():
    return (f"<g transform='translate(500 200)'><path d='M0-110l90 34v60q0 74-90 120-90-46-90-120v-60z' fill='{GOLD}'/><path d='M0-92l72 27v50q0 60-72 98-72-38-72-98v-50z' fill='{NAVY}'/>"
            f"<path d='M-30 0l22 24 42-48' stroke='{GOLD2}' stroke-width='12' fill='none' stroke-linecap='round' stroke-linejoin='round'/></g>")


def badge_hex():
    out = "<g transform='translate(495 200)'>"
    for i, (t, dx, dy) in enumerate([("APQP", 0, -84), ("PPAP", 74, -42), ("FMEA", 74, 42), ("SPC", 0, 84), ("MSA", -74, 42), ("CP", -74, -42)]):
        pts = " ".join(f"{dx + 40 * math.cos(math.pi / 3 * k + math.pi / 6):.1f},{dy + 40 * math.sin(math.pi / 3 * k + math.pi / 6):.1f}" for k in range(6))
        out += f"<polygon points='{pts}' fill='{GOLD if i % 2 == 0 else NAVY2}' stroke='{GOLD2}' stroke-width='2'/><text x='{dx}' y='{dy + 4}' {FONT} font-size='12' font-weight='800' fill='{NAVY if i % 2 == 0 else '#fff'}' text-anchor='middle'>{t}</text>"
    return out + f"<circle r='30' fill='#fff'/><text y='5' {FONT} font-size='13' font-weight='800' fill='{NAVY}' text-anchor='middle'>IATF</text></g>"


def badge_fishbone():
    out = f"<g transform='translate(410 200)' stroke='{GOLD2}' stroke-width='3' fill='none'><line x1='0' y1='0' x2='170' y2='0'/>"
    for x in (30, 80, 130):
        out += f"<line x1='{x}' y1='-70' x2='{x + 30}' y2='0'/><line x1='{x}' y1='70' x2='{x + 30}' y2='0'/>"
    out += f"</g><rect x='580' y='180' width='46' height='40' rx='6' fill='{RED}'/><text x='603' y='205' {FONT} font-size='11' font-weight='800' fill='#fff' text-anchor='middle'>8D</text>"
    for i, t in enumerate(["Man", "Machine", "Method", "Material", "Measure", "Env."]):
        x, y = 430 + (i % 3) * 50, 118 if i < 3 else 290
        out += f"<text x='{x}' y='{y}' {FONT} font-size='11' font-weight='700' fill='#fff'>{t}</text>"
    return out


def badge_5s():
    out = "<g transform='translate(420 90)'>"
    for i, (k, t) in enumerate([("1S", "Sort"), ("2S", "Set in order"), ("3S", "Shine"), ("4S", "Standardise"), ("5S", "Sustain")]):
        y = i * 46
        out += f"<rect x='0' y='{y}' width='190' height='38' rx='10' fill='#fff' opacity='{1 - i * .08}'/><rect x='0' y='{y}' width='44' height='38' rx='10' fill='{GOLD}'/><text x='22' y='{y + 24}' {FONT} font-size='13' font-weight='800' fill='{NAVY}' text-anchor='middle'>{k}</text><text x='58' y='{y + 24}' {FONT} font-size='13' font-weight='700' fill='{INK}'>{t}</text>"
    return out + "</g>"


def badge_code():
    return (f"<g transform='translate(410 110)'><rect width='200' height='180' rx='12' fill='#0B1226'/><circle cx='16' cy='16' r='4' fill='#F87171'/><circle cx='30' cy='16' r='4' fill='{AMBER}'/><circle cx='44' cy='16' r='4' fill='{OK}'/>"
            + "".join(f"<rect x='{16 + ind * 14}' y='{36 + i * 16}' width='{w}' height='7' rx='3.5' fill='{c}'/>" for i, (ind, w, c) in enumerate(
                [(0, 70, "#C084FC"), (1, 110, "#38BDF8"), (2, 90, GOLD2), (2, 120, "#86EFAC"), (1, 60, "#38BDF8"), (0, 40, "#C084FC"), (0, 100, "#F9A8D4"), (1, 80, GOLD2), (1, 130, "#86EFAC")]))
            + "</g>")


def badge_people():
    out = ""
    for i, (x, y, c) in enumerate([(470, 150, GOLD), (560, 150, "#38BDF8"), (515, 250, OK)]):
        out += f"<g transform='translate({x} {y})'><circle r='38' fill='#fff' opacity='.12'/><circle cy='-8' r='13' fill='#F2C9A0'/><path d='M-20 22v-6a14 14 0 0 1 14-14h12a14 14 0 0 1 14 14v6z' fill='{c}'/></g>"
    return out + f"<path d='M500 160h30M492 180l14 40M538 180l-14 40' stroke='{GOLD2}' stroke-width='2.5' stroke-dasharray='5 4'/>"


def badge_web():
    return (f"<g transform='translate(405 100)'><rect width='210' height='200' rx='12' fill='#fff'/><rect width='210' height='26' rx='12' fill='{CREAM}'/><rect y='14' width='210' height='12' fill='{CREAM}'/>"
            f"<rect x='14' y='40' width='182' height='60' rx='8' fill='{NAVY2}'/><rect x='26' y='56' width='90' height='9' rx='4.5' fill='#fff'/><rect x='26' y='72' width='60' height='14' rx='7' fill='{GOLD}'/>"
            + "".join(f"<rect x='{14 + i * 62}' y='112' width='54' height='50' rx='6' fill='#F1F4F9'/><rect x='{24 + i * 62}' y='122' width='34' height='22' rx='3' fill='{[GOLD, '#38BDF8', OK][i]}' opacity='.6'/><rect x='{20 + i * 62}' y='150' width='40' height='6' rx='3' fill='{MUTED}'/>" for i in range(3))
            + f"<rect x='120' y='172' width='76' height='18' rx='9' fill='{GOLD}'/><text x='158' y='185' {FONT} font-size='10' font-weight='800' fill='{NAVY}' text-anchor='middle'>Buy now</text></g>")


def app_apqp():
    a = "#0891B2"
    b = heading("APQP programme · DP-1101", "Five phases, gates and deliverables")
    names = ["Plan and define", "Design and dev.", "Process design", "Validation", "Feedback"]
    prog = [100, 100, 78, 38, 0]
    for i, (nm, pg) in enumerate(zip(names, prog)):
        x = i * 84
        col = OK if pg == 100 else a if pg else MUTED
        b += (f"<rect x='{x}' y='40' width='76' height='62' rx='9' fill='#fff' stroke='{col}' stroke-width='2'/>"
              f"<text x='{x + 38}' y='58' {FONT} font-size='9.5' font-weight='800' fill='{INK}' text-anchor='middle'>PHASE {i + 1}</text>"
              f"<text x='{x + 38}' y='71' {FONT} font-size='8' fill='{MUTED}' text-anchor='middle'>{nm}</text>"
              f"<rect x='{x + 9}' y='80' width='58' height='7' rx='3.5' fill='#EEF1F6'/><rect x='{x + 9}' y='80' width='{58 * pg / 100:.0f}' height='7' rx='3.5' fill='{col}'/>"
              f"<text x='{x + 38}' y='96' {FONT} font-size='8.5' font-weight='700' fill='{col}' text-anchor='middle'>{pg}%</text>")
        if i < 4:
            b += f"<path d='M{x + 78} 71h4' stroke='{MUTED}' stroke-width='2'/>"
        if pg == 100:
            b += f"<circle cx='{x + 38}' cy='113' r='7' fill='{OK}'/><path d='M{x + 34} 113l3 3 5-6' stroke='#fff' stroke-width='2' fill='none' stroke-linecap='round'/>"
    b += rows(0, 128, 418, [["3.5", "Process FMEA", "Process Documents", ("Linked", OK)], ["3.7", "Pre-launch control plan", "Process Documents", ("Linked", OK)], ["3.9", "MSA plan", "Process Documents", ("Partly", AMBER)],
                            ["4.3", "Preliminary capability study", "Process Documents", ("Not yet", MUTED)], ["4.4", "Production part approval", "PPAP Submissions", ("Open", AMBER)], ["2.12", "Gages / testing equipment", "Calibration Hub", ("Linked", OK)]],
              [34, 150, 130, 70], head=["#", "Deliverable", "Evidence from", "Status"], rh=21)
    return window(a, "APQP", b)


def app_ppap():
    a = "#B45309"
    b = heading("PPAP · Level 3 · DP-1101", "18 elements assembled from your apps")
    els = [("Design records", "Balloon", OK), ("Process flow", "PD", OK), ("Process FMEA", "PD", OK), ("Control plan", "PD", OK), ("MSA studies", "PD", OK), ("Dimensional results", "Balloon", OK),
           ("Initial process studies", "PD", AMBER), ("Checking aids", "Calib.", OK), ("Material tests", "—", RED)]
    for i, (nm, srcn, c) in enumerate(els):
        y = 38 + i * 24
        b += (f"<rect x='0' y='{y}' width='238' height='20' rx='5' fill='#F6F8FC'/><circle cx='11' cy='{y + 10}' r='5.5' fill='{c}'/>"
              f"<text x='24' y='{y + 14}' {FONT} font-size='9.5' font-weight='600' fill='{INK}'>{nm}</text><text x='232' y='{y + 14}' {FONT} font-size='8.5' fill='{MUTED}' text-anchor='end'>{srcn}</text>")
    # warrant
    b += (f"<g transform='translate(252 38)'><rect width='166' height='222' rx='6' fill='#fff' stroke='{INK}' stroke-width='1.6'/><text x='83' y='18' {FONT} font-size='10.5' font-weight='800' fill='{INK}' text-anchor='middle'>PART SUBMISSION WARRANT</text>"
          + "".join(f"<rect x='10' y='{30 + k * 17}' width='{70 if k % 2 else 100}' height='6' rx='3' fill='#D8DEE9'/><rect x='{92 if k % 2 else 118}' y='{30 + k * 17}' width='{54 if k % 2 else 36}' height='6' rx='3' fill='#EEF1F6'/>" for k in range(6))
          + f"<rect x='10' y='140' width='146' height='1' fill='#D8DEE9'/><text x='10' y='156' {FONT} font-size='8' font-weight='700' fill='{INK}'>Level 3 · Initial submission</text>"
          f"<rect x='10' y='166' width='146' height='28' rx='4' fill='#FBF3E0'/><text x='16' y='184' {FONT} font-size='8' fill='{INK}'>Dimensional · Material · Appearance · SPC</text>"
          f"<path d='M14 214q16-14 28-2t26-4' stroke='{NAVY}' stroke-width='1.6' fill='none'/><rect x='104' y='204' width='44' height='16' rx='8' fill='{OK}'/><text x='126' y='215' {FONT} font-size='8' font-weight='800' fill='#fff' text-anchor='middle'>APPROVED</text></g>")
    return window(a, "PPAP", b)


def app_rmp():
    a = "#0D9488"
    b = heading("Raw material · this month", "Needed vs stock, in kg")
    rows = [("EN8 bar Ø65", 9800, 3400, OK), ("EN19 bar Ø45", 7000, 600, RED), ("EN353 forging", 4650, 900, AMBER), ("SS304 bar", 2100, 2600, OK)]
    for i, (nm, need, st, c) in enumerate(rows):
        y = 40 + i * 44
        b += (f"<text x='0' y='{y + 10}' {FONT} font-size='10' font-weight='700' fill='{INK}'>{nm}</text>"
              f"<rect x='0' y='{y + 16}' width='260' height='9' rx='4.5' fill='#E6E9F0'/><rect x='0' y='{y + 16}' width='{min(260, int(260 * need / 10000))}' height='9' rx='4.5' fill='{a}' opacity='.35'/>"
              f"<rect x='0' y='{y + 16}' width='{min(260, int(260 * st / 10000))}' height='9' rx='4.5' fill='{c}'/>"
              f"<text x='270' y='{y + 25}' {FONT} font-size='9' fill='{MUTED}'>{need:,} kg · stock {st:,}</text>")
    b += f"<rect x='0' y='222' width='420' height='34' rx='8' fill='#FBF3E0'/><text x='12' y='243' {FONT} font-size='10' font-weight='700' fill='{INK}'>Order 6,750 kg EN19 · MOQ 1,000 · pack 250 · order by 12 Oct</text>"
    return window(a, "RMP", b)


def app_mmd():
    a = "#2563EB"
    b = heading("Route sheet RS-2610-0001", "Where the parts are, machine by machine")
    steps = [("RM store", 400, OK), ("Turning", 392, OK), ("Drilling", 388, OK), ("Heat treat · supplier", 388, AMBER), ("Grinding", 200, a)]
    for i, (nm, q, c) in enumerate(steps):
        y = 38 + i * 30
        b += (f"<circle cx='8' cy='{y + 8}' r='6' fill='{c}'/><text x='22' y='{y + 12}' {FONT} font-size='10' font-weight='700' fill='{INK}'>{nm}</text>"
              f"<rect x='160' y='{y + 3}' width='{int(q / 400 * 100)}' height='9' rx='4.5' fill='{c}' opacity='.8'/><text x='266' y='{y + 12}' {FONT} font-size='9' fill='{MUTED}'>{q} pcs</text>")
    qx = 318
    cells = "".join(f"<rect x='{qx + (i % 7) * 7}' y='{58 + (i // 7) * 7}' width='6' height='6' fill='{INK}'/>" for i in range(49) if (i * 7 + i // 3) % 3 != 0 or i in (0, 6, 42))
    b += f"<rect x='{qx - 8}' y='46' width='66' height='66' rx='6' fill='#fff' stroke='{LINE}'/>{cells}"
    b += f"<text x='{qx - 8}' y='128' {FONT} font-size='9' font-weight='700' fill='{INK}'>TG-2610-00012</text><text x='{qx - 8}' y='140' {FONT} font-size='8' fill='{MUTED}'>OK tag · 388 pcs</text>"
    b += f"<rect x='0' y='196' width='420' height='34' rx='8' fill='#FBE9E9'/><text x='12' y='217' {FONT} font-size='10' font-weight='700' fill='{INK}'>Moving slowly: Gear housing · 6 days at Milling</text>"
    return window(a, "MMD", b)


def app_mnt():
    a = "#EA580C"
    b = heading("Machine health · last 90 days", "Breakdowns, MTBF and MTTR")
    for i, (nm, mtbf, mttr, c) in enumerate([("CNC Turning 1", 612, 2.4, OK), ("VMC 1", 380, 3.2, OK), ("Gear Hobbing 1", 150, 5.1, AMBER), ("Press 100T", 62, 7.5, RED)]):
        y = 40 + i * 38
        b += (f"<text x='0' y='{y + 10}' {FONT} font-size='10' font-weight='700' fill='{INK}'>{nm}</text>"
              f"<rect x='110' y='{y + 2}' width='{int(min(200, mtbf / 3))}' height='9' rx='4.5' fill='{c}'/><text x='{118 + int(min(200, mtbf / 3))}' y='{y + 10}' {FONT} font-size='9' fill='{MUTED}'>MTBF {mtbf} h</text>"
              f"<text x='110' y='{y + 26}' {FONT} font-size='9' fill='{MUTED}'>MTTR {mttr} h</text>")
    b += f"<rect x='0' y='196' width='420' height='34' rx='8' fill='#FBE9E9'/><text x='12' y='217' {FONT} font-size='10' font-weight='700' fill='{INK}'>Press 100T: 3 hydraulic failures — fix the cause</text>"
    return window(a, "MNT", b)


ART = {
    "app-hrm": lambda: svg(bg("#0EA5E9") + app_hrm(), "HRM Suite"),
    "app-balloon": lambda: svg(bg("#A855F7") + app_balloon(), "Balloon Inspector"),
    "app-pd": lambda: svg(bg("#F59E0B") + app_pd(), "Process Documents"),
    "app-capacity": lambda: svg(bg("#10B981") + app_capacity(), "Capacity Planner"),
    "app-sales": lambda: svg(bg("#E11D48") + app_sales(), "Sales Flow"),
    "app-apqp": lambda: svg(bg("#0891B2") + app_apqp(), "APQP Planner"),
    "app-rmp": lambda: svg(bg("#0D9488") + app_rmp(), "Raw Material Planning"),
    "app-mmd": lambda: svg(bg("#2563EB") + app_mmd(), "Material Movement"),
    "app-mnt": lambda: svg(bg("#EA580C") + app_mnt(), "Maintenance"),
    "app-ppap": lambda: svg(bg("#B45309") + app_ppap(), "PPAP Submissions"),
    "app-calib": lambda: svg(bg("#6366F1") + app_calib(), "Calibration Hub"),
    "v-shop": scene_shop, "v-software": scene_software, "v-training": scene_training, "v-trade": scene_trade, "v-invest": scene_invest,
    "t-quality": lambda: doc_scene(GOLD, "Internal audit plan", ["Clause-wise checklist", "Process audit · turtle", "Clear nonconformities", "Verified corrective action"], badge_shield(), "Quality systems training"),
    "t-coretools": lambda: doc_scene("#38BDF8", "Core tools workshop", ["APQP phases & gates", "PPAP levels", "PFMEA (AIAG-VDA)", "SPC & MSA studies"], badge_hex(), "Core tools training"),
    "t-problem": lambda: doc_scene(RED, "8D report", ["D3 containment", "D4 root cause", "D5 permanent action", "D8 lessons learned"], badge_fishbone(), "Problem solving training"),
    "t-shopfloor": lambda: doc_scene(OK, "Daily review board", ["Safety · quality · delivery", "Standard work", "Visual management", "Escalation rules"], badge_5s(), "Shop-floor training"),
    "s-custom": lambda: doc_scene("#C084FC", "Your software", ["Requirement study", "Fixed-scope quote", "Cloud, data in India", "Training & support"], badge_code(), "Custom business software"),
    "s-consulting": lambda: doc_scene("#38BDF8", "IT roadmap", ["Process review", "ERP / HR / QMS selection", "Data migration", "Staff training"], badge_people(), "IT consulting"),
    "s-web": lambda: doc_scene(GOLD, "Website & store", ["Design & content", "Payments & GST invoice", "Enquiry forms", "Hand-over training"], badge_web(), "Website and online store set-up"),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in ART.items():
        with open(os.path.join(OUT, name + ".svg"), "w", encoding="utf-8") as f:
            f.write(fn())
    print(f"{len(ART)} illustrations written to public/img/kmr/")
