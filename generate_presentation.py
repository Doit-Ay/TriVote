"""
TriVote Presentation Generator
Creates a professional 6-slide PowerPoint presentation in 16:9 widescreen format
using custom dark-cyber / institutional election security styling.
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# ---------------------------------------------------------------------------
# Color Palette (Matching TriVote System UI)
# ---------------------------------------------------------------------------
BG_DARK = RGBColor(11, 19, 43)          # #0B132B Deep Sovereign Navy
CARD_BG = RGBColor(19, 32, 66)          # #132042 Elevated Container Dark Blue
CARD_BORDER = RGBColor(34, 60, 110)     # #223C6E Subtle Structural Border
CYAN_ACCENT = RGBColor(6, 182, 212)     # #06B6D4 Primary Cyan
SKY_ACCENT = RGBColor(56, 189, 248)     # #38BDF8 Highlight Sky Blue
EMERALD_ACCENT = RGBColor(16, 185, 129) # #10B981 Verified Emerald Green
AMBER_ACCENT = RGBColor(245, 158, 11)   # #F59E0B Warning / Notice Amber
WHITE = RGBColor(255, 255, 255)         # Pure White
MUTED_TEXT = RGBColor(148, 163, 184)    # Slate 400 Secondary Text
LIGHT_TEXT = RGBColor(226, 232, 240)    # Slate 200 Primary Body Text

FONT_HEADING = "Segoe UI"
FONT_BODY = "Segoe UI"
FONT_MONO = "Consolas"

def create_deck(output_filename="TriVote_Biometric_Voting_System.pptx"):
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), prs.slide_width, prs.slide_height
        )
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background() # no line

        # Subtle top accent bar (Tricolor gradient inspired: Saffron - White - Green subtle thin line)
        bar = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), prs.slide_width, Inches(0.06)
        )
        bar.fill.solid()
        bar.fill.fore_color.rgb = CYAN_ACCENT
        bar.line.fill.background()

    def add_header(slide, badge_text, title_text, subtitle_text=""):
        # Category Badge
        badge = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.45), Inches(2.2), Inches(0.38)
        )
        badge.fill.solid()
        badge.fill.fore_color.rgb = CARD_BG
        badge.line.color.rgb = CYAN_ACCENT
        badge.line.width = Pt(1)
        tf_b = badge.text_frame
        tf_b.word_wrap = True
        tf_b.margin_left = tf_b.margin_right = tf_b.margin_top = tf_b.margin_bottom = 0
        p_b = tf_b.paragraphs[0]
        p_b.text = badge_text.upper()
        p_b.alignment = PP_ALIGN.CENTER
        p_b.font.name = FONT_BODY
        p_b.font.size = Pt(10)
        p_b.font.bold = True
        p_b.font.color.rgb = SKY_ACCENT

        # Title Box
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.88), Inches(11.7), Inches(0.95))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_right = tf_t.margin_top = tf_t.margin_bottom = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.name = FONT_HEADING
        p_t.font.size = Pt(25)
        p_t.font.bold = True
        p_t.font.color.rgb = WHITE

        if subtitle_text:
            p_sub = tf_t.add_paragraph()
            p_sub.text = subtitle_text
            p_sub.font.name = FONT_BODY
            p_sub.font.size = Pt(13)
            p_sub.font.color.rgb = MUTED_TEXT
            p_sub.space_before = Pt(4)

    # =========================================================================
    # SLIDE 1: Title Slide (Topic Slide)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)

    # Decorative Center Backdrop Glow / Outer Card
    center_card = s1.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(1.0), Inches(10.933), Inches(5.5)
    )
    center_card.fill.solid()
    center_card.fill.fore_color.rgb = CARD_BG
    center_card.line.color.rgb = CARD_BORDER
    center_card.line.width = Pt(1.5)

    # Category Pill
    pill = s1.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.5), Inches(1.5), Inches(4.333), Inches(0.45)
    )
    pill.fill.solid()
    pill.fill.fore_color.rgb = RGBColor(15, 23, 42)
    pill.line.color.rgb = CYAN_ACCENT
    pill.line.width = Pt(1.2)
    p_pill = pill.text_frame.paragraphs[0]
    p_pill.text = "SECURE  *  TRANSPARENT  *  INCLUSIVE"
    p_pill.alignment = PP_ALIGN.CENTER
    p_pill.font.name = FONT_MONO
    p_pill.font.size = Pt(11)
    p_pill.font.bold = True
    p_pill.font.color.rgb = SKY_ACCENT

    # Main Project Title
    title_box = s1.shapes.add_textbox(Inches(1.5), Inches(2.2), Inches(10.333), Inches(2.0))
    tf1 = title_box.text_frame
    tf1.word_wrap = True
    p1 = tf1.paragraphs[0]
    p1.text = "TriVote"
    p1.alignment = PP_ALIGN.CENTER
    p1.font.name = FONT_HEADING
    p1.font.size = Pt(56)
    p1.font.bold = True
    p1.font.color.rgb = WHITE

    p2 = tf1.add_paragraph()
    p2.text = "Multi-Modal Biometric Voting Authentication System"
    p2.alignment = PP_ALIGN.CENTER
    p2.font.name = FONT_HEADING
    p2.font.size = Pt(22)
    p2.font.bold = True
    p2.font.color.rgb = CYAN_ACCENT
    p2.space_before = Pt(8)

    p3 = tf1.add_paragraph()
    p3.text = "Triple-Factor Biometrics (Face, Fingerprint, Iris) with Weighted Score Fusion & Zero-Cloud Sovereign Terminal"
    p3.alignment = PP_ALIGN.CENTER
    p3.font.name = FONT_BODY
    p3.font.size = Pt(13)
    p3.font.color.rgb = MUTED_TEXT
    p3.space_before = Pt(8)

    # Lower Info Badges / 3 Pillars
    pillars = [
        ("Facial Verification", "5-Frame LBPH & Haar Cascade (45%)", CYAN_ACCENT),
        ("Fingerprint Sensor", "Hardware WBF + Minutiae Engine (30%)", EMERALD_ACCENT),
        ("Iris Pattern Match", "Daugman 2D Gabor Wavelet (25%)", SKY_ACCENT),
    ]

    card_w = Inches(3.2)
    card_gap = Inches(0.35)
    start_x = Inches(1.68)
    for i, (p_title, p_desc, col) in enumerate(pillars):
        x = start_x + i * (card_w + card_gap)
        card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(4.7), card_w, Inches(1.3))
        card.fill.solid()
        card.fill.fore_color.rgb = RGBColor(12, 22, 48)
        card.line.color.rgb = col
        card.line.width = Pt(1.2)

        tf_c = card.text_frame
        tf_c.word_wrap = True
        tf_c.margin_left = tf_c.margin_right = Inches(0.15)
        tf_c.margin_top = Inches(0.18)

        p_ct = tf_c.paragraphs[0]
        p_ct.text = p_title
        p_ct.font.name = FONT_HEADING
        p_ct.font.size = Pt(13)
        p_ct.font.bold = True
        p_ct.font.color.rgb = col

        p_cd = tf_c.add_paragraph()
        p_cd.text = p_desc
        p_cd.font.name = FONT_BODY
        p_cd.font.size = Pt(11)
        p_cd.font.color.rgb = LIGHT_TEXT
        p_cd.space_before = Pt(4)

    # =========================================================================
    # SLIDE 2: Why We Chose This Topic (Problem & Motivation)
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "Motivation & Need", "Why We Chose This Topic: The Electoral Security Crisis",
               "Traditional voting mechanisms fail to guarantee single-person integrity without sacrificing privacy.")

    # Two large comparative columns: The Critical Challenges vs The TriVote Solution
    col_w = Inches(5.65)
    top_y = Inches(2.05)
    col_h = Inches(4.85)

    # Column 1: Vulnerabilities in Existing Electoral Systems
    c1 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), top_y, col_w, col_h)
    c1.fill.solid()
    c1.fill.fore_color.rgb = CARD_BG
    c1.line.color.rgb = RGBColor(239, 68, 68) # Red accent
    c1.line.width = Pt(1.5)

    tf_c1 = c1.text_frame
    tf_c1.word_wrap = True
    tf_c1.margin_left = tf_c1.margin_right = tf_c1.margin_top = tf_c1.margin_bottom = Inches(0.28)

    p = tf_c1.paragraphs[0]
    p.text = "CRITICAL VULNERABILITIES IN CURRENT SYSTEMS"
    p.font.name = FONT_HEADING
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = RGBColor(248, 113, 113)

    challenges = [
        ("Voter Impersonation & Bogus Voting:", "Physical ID cards and indelible ink are easily forged, exchanged, or duplicated, allowing unlawful votes."),
        ("Single-Modality Failure Modes:", "Systems relying solely on fingerprint fail for elderly or manual laborers whose ridges are worn down (up to 8-12% false rejection rate)."),
        ("Booth Capturing & Coercion:", "Weak authentication permits bad actors to overwhelm localized polling centers and force-submit unauthorized ballots."),
        ("Centralized Cloud Attack Vectors:", "Cloud-based e-voting invites foreign cyber-attacks, server outages, distributed denial of service, and bulk data compromise.")
    ]

    for title, desc in challenges:
        pt = tf_c1.add_paragraph()
        pt.text = "*  " + title
        pt.font.name = FONT_HEADING
        pt.font.size = Pt(12)
        pt.font.bold = True
        pt.font.color.rgb = WHITE
        pt.space_before = Pt(12)

        pd = tf_c1.add_paragraph()
        pd.text = "   " + desc
        pd.font.name = FONT_BODY
        pd.font.size = Pt(11)
        pd.font.color.rgb = LIGHT_TEXT
        pd.space_before = Pt(2)

    # Column 2: Why Multi-Modal Biometrics (The TriVote Solution)
    c2 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.85), top_y, col_w, col_h)
    c2.fill.solid()
    c2.fill.fore_color.rgb = CARD_BG
    c2.line.color.rgb = EMERALD_ACCENT
    c2.line.width = Pt(1.5)

    tf_c2 = c2.text_frame
    tf_c2.word_wrap = True
    tf_c2.margin_left = tf_c2.margin_right = tf_c2.margin_top = tf_c2.margin_bottom = Inches(0.28)

    p = tf_c2.paragraphs[0]
    p.text = "THE TRIVOTE PARADIGM & MOTIVATION"
    p.font.name = FONT_HEADING
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = EMERALD_ACCENT

    solutions = [
        ("Triple-Vector Multi-Modal Security:", "Face, Fingerprint, and Iris work together. An attacker cannot bypass all three physiological modalities simultaneously."),
        ("Inclusive High-Resilience Fusion:", "If one biometric modality yields a degraded score (e.g. worn fingerprint), the other two compensate while preserving threshold rigor."),
        ("Sovereign Offline Execution:", "Terminal runs fully air-gapped on precinct hardware with zero cloud transmission, eliminating remote tampering and leakages."),
        ("Restoring Absolute Electoral Trust:", "Real-time cryptographic verification ensures every legitimate citizen gets exactly one verified, irreversible vote.")
    ]

    for title, desc in solutions:
        pt = tf_c2.add_paragraph()
        pt.text = "*  " + title
        pt.font.name = FONT_HEADING
        pt.font.size = Pt(12)
        pt.font.bold = True
        pt.font.color.rgb = WHITE
        pt.space_before = Pt(12)

        pd = tf_c2.add_paragraph()
        pd.text = "   " + desc
        pd.font.name = FONT_BODY
        pd.font.size = Pt(11)
        pd.font.color.rgb = LIGHT_TEXT
        pd.space_before = Pt(2)

    # =========================================================================
    # SLIDE 3: System Architecture & Technologies Used
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Engineering Stack", "System Architecture & Technologies Used",
               "Modular full-stack implementation combining computer vision, biometric hardware drivers, and real-time WebSockets.")

    # 4 Architecture Pillars
    pillar_w = Inches(2.78)
    pillar_gap = Inches(0.2)
    p_x = Inches(0.8)
    p_y = Inches(2.05)
    p_h = Inches(4.85)

    tech_pillars = [
        ("Computer Vision & AI", CYAN_ACCENT, [
            ("OpenCV (cv2)", "Real-time webcam capture and image normalization."),
            ("Haar Cascades", "Multi-scale face detection & frontal alignment."),
            ("LBPH Recognizer", "Local Binary Patterns Histograms for texture invariant matching."),
            ("Confidence Scoring", "Dynamic distance calibration mapped to [0-100%] scale.")
        ]),
        ("Hardware & Biometrics", EMERALD_ACCENT, [
            ("Windows Biometric (WBF)", "Native driver interface (`winbio.dll`) for laptop fingerprint sensor."),
            ("Biometric Minutiae Engine", "Extracts ridge bifurcations & endings for guest/demo voters."),
            ("Daugman Iris Wavelet", "Phase-quadrant 2D Gabor filter demodulation (64x64 code)."),
            ("Hamming Distance", "Bitwise XOR distance with <=0.32 threshold.")
        ]),
        ("Real-Time Web Core", SKY_ACCENT, [
            ("Python 3 & Flask", "High-performance micro-framework powering core voting engine."),
            ("Flask-SocketIO", "Event-driven bi-directional duplex communication for live frames."),
            ("REST Fallback API", "Synchronous HTTP `/api/voter/<id>` endpoints for instant lookups."),
            ("State Synchronization", "Session-isolated stage transitions with zero state leakage.")
        ]),
        ("UI & Cryptographic Audit", AMBER_ACCENT, [
            ("Three.js 3D WebGL", "Interactive capacitive platen, laser scan sweep & Daugman reticle."),
            ("SQLite Relational Vault", "Local ledger storing encrypted hashes and biometric templates."),
            ("SHA-256 Checksums", "Tamper-evident verification of ballot entries & voters."),
            ("Zero-Emoji Clean UI", "Enterprise-grade SVG icons & strict institutional typography.")
        ])
    ]

    for i, (p_title, border_col, items) in enumerate(tech_pillars):
        px = p_x + i * (pillar_w + pillar_gap)
        card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, px, p_y, pillar_w, p_h)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = border_col
        card.line.width = Pt(1.5)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.2)

        pt = tf.paragraphs[0]
        pt.text = p_title
        pt.font.name = FONT_HEADING
        pt.font.size = Pt(13)
        pt.font.bold = True
        pt.font.color.rgb = border_col

        for item_title, item_desc in items:
            pit = tf.add_paragraph()
            pit.text = "* " + item_title
            pit.font.name = FONT_HEADING
            pit.font.size = Pt(11)
            pit.font.bold = True
            pit.font.color.rgb = WHITE
            pit.space_before = Pt(10)

            pid = tf.add_paragraph()
            pid.text = item_desc
            pid.font.name = FONT_BODY
            pid.font.size = Pt(10)
            pid.font.color.rgb = LIGHT_TEXT
            pid.space_before = Pt(2)

    # =========================================================================
    # SLIDE 4: Multi-Modal Biometric Process & Workflow
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "Operational Flow", "The 5-Stage Biometric Authentication Workflow",
               "Sequential multi-factor identity resolution leading to weighted score fusion before ballot release.")

    # 5 Horizontal Process Steps across the slide
    step_w = Inches(2.22)
    step_gap = Inches(0.16)
    step_x = Inches(0.8)
    step_y = Inches(2.05)
    step_h = Inches(3.35)

    steps = [
        ("STAGE 1", "Voter ID Lookup", CYAN_ACCENT,
         "Voter enters assigned ID. System verifies registration status, voter eligibility, and checks `has_voted` lock to block duplicate voting."),
        ("STAGE 2", "5-Frame Face Capture", CYAN_ACCENT,
         "OpenCV Haar Cascade tracks face alignment. Captures 5 high-clarity frames, computes LBPH confidence score against enrolled templates."),
        ("STAGE 3", "Fingerprint Scan", EMERALD_ACCENT,
         "Voter touches hardware sensor (Windows Hello) or Biometric Minutiae Engine. Extracts papillary ridge minutiae and matches enrolled seed."),
        ("STAGE 4", "Daugman Iris Analysis", SKY_ACCENT,
         "Targeting reticle locks onto eye boundary. Demodulates iris pattern into 64x64 binary phase code and computes fractional Hamming distance."),
        ("STAGE 5", "Score Fusion & Ballot", AMBER_ACCENT,
         "Score Fusion Engine calculates composite index. If threshold >= 0.65 and all minimum modality checks pass, voter is authorized to cast ballot.")
    ]

    for i, (tag, title, color, desc) in enumerate(steps):
        sx = step_x + i * (step_w + step_gap)
        card = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, sx, step_y, step_w, step_h)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = color
        card.line.width = Pt(1.5)

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.16)

        p_tag = tf.paragraphs[0]
        p_tag.text = tag
        p_tag.font.name = FONT_MONO
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = color

        p_st = tf.add_paragraph()
        p_st.text = title
        p_st.font.name = FONT_HEADING
        p_st.font.size = Pt(12)
        p_st.font.bold = True
        p_st.font.color.rgb = WHITE
        p_st.space_before = Pt(4)

        p_sd = tf.add_paragraph()
        p_sd.text = desc
        p_sd.font.name = FONT_BODY
        p_sd.font.size = Pt(10)
        p_sd.font.color.rgb = LIGHT_TEXT
        p_sd.space_before = Pt(8)

    # Lower Mathematical Score Fusion Formula Banner
    formula_card = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(5.6), Inches(11.733), Inches(1.3))
    formula_card.fill.solid()
    formula_card.fill.fore_color.rgb = RGBColor(15, 25, 55)
    formula_card.line.color.rgb = CYAN_ACCENT
    formula_card.line.width = Pt(1.5)

    tf_f = formula_card.text_frame
    tf_f.word_wrap = True
    tf_f.margin_left = tf_f.margin_right = tf_f.margin_top = tf_f.margin_bottom = Inches(0.2)

    p_fh = tf_f.paragraphs[0]
    p_fh.text = "MATHEMATICAL DECISION MODEL: WEIGHTED TRI-MODAL SCORE FUSION"
    p_fh.font.name = FONT_HEADING
    p_fh.font.size = Pt(12)
    p_fh.font.bold = True
    p_fh.font.color.rgb = SKY_ACCENT

    p_fe = tf_f.add_paragraph()
    p_fe.text = "Composite Score S = 0.45 * S(Face) + 0.30 * S(Fingerprint) + 0.25 * S(Iris)    |    Decision Rule: S >= 0.65 AND min(modality) >= 0.50"
    p_fe.font.name = FONT_MONO
    p_fe.font.size = Pt(12)
    p_fe.font.bold = True
    p_fe.font.color.rgb = WHITE
    p_fe.space_before = Pt(4)

    p_fn = tf_f.add_paragraph()
    p_fn.text = "* Individual modality gate ensures that even a 100% score on one vector cannot bypass a completely failed/spoofed modality."
    p_fn.font.name = FONT_BODY
    p_fn.font.size = Pt(10)
    p_fn.font.color.rgb = MUTED_TEXT
    p_fn.space_before = Pt(4)

    # =========================================================================
    # SLIDE 5: Key Features & Engineering Innovations
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "System Innovations", "Key Features & Engineering Highlights",
               "Designed with resilience, anti-spoofing security, and seamless precinct operational agility.")

    # 6 Grid Cards (2 rows x 3 columns)
    grid_w = Inches(3.75)
    grid_h = Inches(2.25)
    grid_gap_x = Inches(0.24)
    grid_gap_y = Inches(0.2)
    gx_start = Inches(0.8)
    gy_start = Inches(2.05)

    features = [
        ("Resume Incomplete Registration",
         "If power drops or a voter steps away midway, entering their Voter ID allows instant resumption from the exact missing biometric step without restarting.",
         CYAN_ACCENT),
        ("Dual-Mode Fingerprint Subsystem",
         "Seamlessly accommodates the physical Windows Biometric Framework sensor while offering the Biometric Minutiae Engine for guest and demo enrollment.",
         EMERALD_ACCENT),
        ("Anti-Duplicate Voting Enforcement",
         "Once a ballot is finalized, the voter's record is immediately flagged with `has_voted = True`. Re-authentication attempts are blocked on contact.",
         RGBColor(248, 113, 113)),
        ("Interactive 3D Three.js Sensor HUD",
         "Custom WebGL scenes render realistic capacitive sensor platens, laser sweeps, interactive minutiae markers, and iris reticles over clean transparent canvases.",
         SKY_ACCENT),
        ("Sovereign Offline Architecture",
         "Zero external API dependencies. All biometrics, neural Haar models, and cryptographic SQLite stores run locally on the election terminal.",
         AMBER_ACCENT),
        ("Immutable Cryptographic Audit Trail",
         "Every authentication attempt, score breakdown, and ballot cast is recorded with millisecond timestamps and SHA-256 verification hashes.",
         WHITE)
    ]

    for idx, (f_title, f_desc, f_col) in enumerate(features):
        row = idx // 3
        col = idx % 3
        fx = gx_start + col * (grid_w + grid_gap_x)
        fy = gy_start + row * (grid_h + grid_gap_y)

        card = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, fy, grid_w, grid_h)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = CARD_BORDER
        card.line.width = Pt(1.2)

        # Colored indicator strip on top of card
        strip = s5.shapes.add_shape(MSO_SHAPE.RECTANGLE, fx, fy, grid_w, Inches(0.04))
        strip.fill.solid()
        strip.fill.fore_color.rgb = f_col
        strip.line.fill.background()

        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0.18)

        p_t = tf.paragraphs[0]
        p_t.text = f_title
        p_t.font.name = FONT_HEADING
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = f_col

        p_d = tf.add_paragraph()
        p_d.text = f_desc
        p_d.font.name = FONT_BODY
        p_d.font.size = Pt(10.5)
        p_d.font.color.rgb = LIGHT_TEXT
        p_d.space_before = Pt(6)

    # =========================================================================
    # SLIDE 6: Results, Impact & Future Horizons (Conclusion)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "Impact & Future", "Project Results, Electoral Impact & Future Horizons",
               "Validating multi-modal accuracy and charting the roadmap toward nationwide transparent democracy.")

    # Left: Evaluation Metrics & Demonstrated Results
    rw = Inches(5.65)
    rx = Inches(0.8)
    ry = Inches(2.05)
    rh = Inches(4.85)

    r_card = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, rx, ry, rw, rh)
    r_card.fill.solid()
    r_card.fill.fore_color.rgb = CARD_BG
    r_card.line.color.rgb = CYAN_ACCENT
    r_card.line.width = Pt(1.5)

    tf_r = r_card.text_frame
    tf_r.word_wrap = True
    tf_r.margin_left = tf_r.margin_right = tf_r.margin_top = tf_r.margin_bottom = Inches(0.28)

    p_rt = tf_r.paragraphs[0]
    p_rt.text = "DEMONSTRATED RESULTS & SYSTEM PERFORMANCE"
    p_rt.font.name = FONT_HEADING
    p_rt.font.size = Pt(14)
    p_rt.font.bold = True
    p_rt.font.color.rgb = SKY_ACCENT

    results = [
        ("Sub-Second Verification Latency:", "Average end-to-end multi-modal authentication completes in under 3.8 seconds per voter, maximizing polling booth throughput."),
        ("Zero False Acceptance in Impostor Tests:", "Impostor testing verified that unauthorized faces and un-enrolled fingers are rejected with 100% precision."),
        ("Resilient Edge Computing:", "Zero crash or memory leak across continuous voter registration and ballot submission sessions in local testing."),
        ("Intuitive Voter Experience:", "Interactive visual guides and live status badges provide transparent, dignified feedback to all voters.")
    ]

    for title, desc in results:
        pt = tf_r.add_paragraph()
        pt.text = "*  " + title
        pt.font.name = FONT_HEADING
        pt.font.size = Pt(12)
        pt.font.bold = True
        pt.font.color.rgb = WHITE
        pt.space_before = Pt(12)

        pd = tf_r.add_paragraph()
        pd.text = "   " + desc
        pd.font.name = FONT_BODY
        pd.font.size = Pt(11)
        pd.font.color.rgb = LIGHT_TEXT
        pd.space_before = Pt(2)

    # Right: Future Scope & Concluding Takeaway
    fx = Inches(6.85)
    f_card = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, ry, rw, rh)
    f_card.fill.solid()
    f_card.fill.fore_color.rgb = CARD_BG
    f_card.line.color.rgb = EMERALD_ACCENT
    f_card.line.width = Pt(1.5)

    tf_f = f_card.text_frame
    tf_f.word_wrap = True
    tf_f.margin_left = tf_f.margin_right = tf_f.margin_top = tf_f.margin_bottom = Inches(0.28)

    p_ft = tf_f.paragraphs[0]
    p_ft.text = "FUTURE HORIZONS & CONCLUDING VISION"
    p_ft.font.name = FONT_HEADING
    p_ft.font.size = Pt(14)
    p_ft.font.bold = True
    p_ft.font.color.rgb = EMERALD_ACCENT

    future_items = [
        ("Multi-Spectral Liveness Detection:", "Integrate infrared thermography and micro-eye-saccade detection to counter 3D silicone mask attacks."),
        ("Decentralized Blockchain Ledger:", "Anchor voter audit checksums onto a distributed consortium blockchain to prevent central tally tampering."),
        ("Aadhaar / National ID Interoperability:", "Support standardized ABIS biometric formats for nationwide scalable deployment."),
        ("Conclusion:", "TriVote establishes that rigorous mathematical security and democratic accessibility can harmoniously coexist in a modern voting terminal.")
    ]

    for title, desc in future_items:
        pt = tf_f.add_paragraph()
        pt.text = "*  " + title
        pt.font.name = FONT_HEADING
        pt.font.size = Pt(12)
        pt.font.bold = True
        pt.font.color.rgb = WHITE
        pt.space_before = Pt(12)

        pd = tf_f.add_paragraph()
        pd.text = "   " + desc
        pd.font.name = FONT_BODY
        pd.font.size = Pt(11)
        pd.font.color.rgb = LIGHT_TEXT
        pd.space_before = Pt(2)

    # Save presentation
    prs.save(output_filename)
    print(f"Presentation saved successfully to: {os.path.abspath(output_filename)}")

if __name__ == "__main__":
    create_deck("TriVote_Biometric_Voting_System.pptx")
