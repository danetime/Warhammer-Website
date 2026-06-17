#!/usr/bin/env python3
"""Build the Old World League field-manual PDF.

Generates docs/old-world-league-guide.pdf from the content below using reportlab.
Run:  python3 docs/build-guide.py
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, HRFlowable)

CRIMSON = colors.HexColor("#7f1d1d")
BRASS   = colors.HexColor("#b45309")
BRASSD  = colors.HexColor("#92400e")
TEXT    = colors.HexColor("#2b2620")
MUTED   = colors.HexColor("#6b6256")
PARCH   = colors.HexColor("#fbf3df")
PARCHB  = colors.HexColor("#e4d2a6")
ROW     = colors.HexColor("#faf4e6")

OUT = os.path.join(os.path.dirname(__file__), "old-world-league-guide.pdf")

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=1.9*cm, rightMargin=1.9*cm,
                        topMargin=1.8*cm, bottomMargin=1.7*cm,
                        title="The Old World League - Field Manual",
                        author="The Old World League")

S = lambda **k: ParagraphStyle(**k)
title_st   = S(name="title", fontName="Helvetica-Bold", fontSize=30, textColor=CRIMSON, alignment=TA_CENTER, leading=34)
sub_st     = S(name="sub", fontName="Helvetica-Bold", fontSize=12, textColor=BRASSD, alignment=TA_CENTER, leading=18, spaceBefore=6)
decree_st  = S(name="decree", fontName="Times-Italic", fontSize=12, textColor=MUTED, alignment=TA_CENTER, leading=18)
foot_st    = S(name="cfoot", fontName="Times-Italic", fontSize=9.5, textColor=MUTED, alignment=TA_CENTER, leading=14)
h2_st      = S(name="h2", fontName="Helvetica-Bold", fontSize=16, textColor=CRIMSON, leading=20, spaceAfter=2)
h3_st      = S(name="h3", fontName="Helvetica-Bold", fontSize=12, textColor=BRASSD, leading=15, spaceBefore=10, spaceAfter=3)
body_st    = S(name="body", fontName="Times-Roman", fontSize=11.5, textColor=TEXT, leading=16, spaceAfter=6)
lead_st    = S(name="lead", fontName="Times-Roman", fontSize=12.5, textColor=colors.HexColor("#4a4239"), leading=17, spaceAfter=8)
bullet_st  = S(name="bullet", fontName="Times-Roman", fontSize=11.5, textColor=TEXT, leading=15.5,
               leftIndent=16, firstLineIndent=-10, spaceAfter=3)
muted_st   = S(name="muted", fontName="Times-Italic", fontSize=10.5, textColor=MUTED, leading=14, spaceAfter=6)
callout_st = S(name="callout", fontName="Times-Roman", fontSize=10.5, textColor=TEXT, leading=14.5)
cell_st    = S(name="cell", fontName="Times-Roman", fontSize=10, textColor=TEXT, leading=13)
cellh_st   = S(name="cellh", fontName="Helvetica-Bold", fontSize=10, textColor=colors.HexColor("#fdf6e3"), leading=13)

story = []

def h2(t):
    story.append(Paragraph(t, h2_st))
    story.append(HRFlowable(width="100%", thickness=2, color=BRASS, spaceBefore=3, spaceAfter=9))

def h3(t): story.append(Paragraph(t, h3_st))
def p(t):  story.append(Paragraph(t, body_st))
def lead(t): story.append(Paragraph(t, lead_st))
def muted(t): story.append(Paragraph(t, muted_st))
def bullets(items):
    for it in items:
        story.append(Paragraph("&bull;&nbsp;&nbsp;" + it, bullet_st))
    story.append(Spacer(1, 5))

def callout(label, text):
    para = Paragraph('<b><font color="#92400e">%s</font></b> %s' % (label, text), callout_st)
    t = Table([[para]], colWidths=[doc.width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), PARCH),
        ("BOX", (0,0), (-1,-1), 0.5, PARCHB),
        ("LINEBEFORE", (0,0), (0,-1), 3, BRASS),
        ("LEFTPADDING", (0,0), (-1,-1), 11),
        ("RIGHTPADDING", (0,0), (-1,-1), 11),
        ("TOPPADDING", (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    story.append(Spacer(1, 4)); story.append(t); story.append(Spacer(1, 8))

def table(rows, widths):
    data = []
    for ri, row in enumerate(rows):
        st = cellh_st if ri == 0 else cell_st
        data.append([Paragraph(c, st) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0,0), (-1,0), CRIMSON),
        ("GRID", (0,0), (-1,-1), 0.5, PARCHB),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 7),
        ("RIGHTPADDING", (0,0), (-1,-1), 7),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]
    for ri in range(1, len(rows)):
        if ri % 2 == 0:
            style.append(("BACKGROUND", (0,ri), (-1,ri), ROW))
    t.setStyle(TableStyle(style))
    story.append(t); story.append(Spacer(1, 8))

# ----------------------------------------------------------------- COVER
story.append(Spacer(1, 3.2*cm))
story.append(HRFlowable(width="62%", thickness=1, color=BRASS, spaceAfter=18))
story.append(Paragraph("The Old World League", title_st))
story.append(Paragraph("F I E L D &nbsp; M A N U A L", sub_st))
story.append(HRFlowable(width="62%", thickness=1, color=BRASS, spaceBefore=18, spaceAfter=22))
story.append(Paragraph("Warhammer Fantasy &middot; Seventh Edition &middot; Members Only", decree_st))
story.append(Spacer(1, 10))
story.append(Paragraph("A complete guide to the muster, the maps and the muck &mdash; "
                       "by decree of the Grand Marshal.", decree_st))
story.append(Spacer(1, 2.6*cm))
story.append(Paragraph("Keep this scroll close. Lose it, and you shall answer to the Council.", foot_st))
story.append(Paragraph("(Whatever the website happens to be named this week, this is the same league.)", foot_st))
story.append(PageBreak())

# ----------------------------------------------------------------- CONTENTS
h2("What&rsquo;s inside")
lead("New to the muster? Read &ldquo;Enlisting&rdquo; first, then wander. "
     "Everything below is a tab along the top of the site.")
contents = [
 "<b>1. Enlisting &amp; signing in</b> &mdash; getting through the gate",
 "<b>2. Finding your way around</b> &mdash; the tabs, top to bottom",
 "<b>3. The Town Square</b> &mdash; your home page",
 "<b>4. Calls to Arms</b> &mdash; posting availability &amp; answering it",
 "<b>5. The League</b> &mdash; tables, points &amp; fixtures",
 "<b>6. The Grand Tourney</b> &mdash; cup brackets",
 "<b>7. Battles &amp; battle reports</b> &mdash; recording your games",
 "<b>8. Might</b> &mdash; the skill rating, explained",
 "<b>9. Army ranks</b> &mdash; climbing the ladders",
 "<b>10. The Council</b> &mdash; proposals &amp; voting",
 "<b>11. The Gallery</b> &mdash; photos, paintings &amp; comments",
 "<b>12. The Hall of Fame</b> &mdash; past champions &amp; cup winners",
 "<b>13. The Library &amp; the Herald</b> &mdash; documents &amp; FAQs",
 "<b>14. Your profile &amp; settings</b> &mdash; avatar, steed, army, emails",
 "<b>15. Email notifications</b> &mdash; what lands in your inbox",
 "<b>16. For the Grand Marshal</b> &mdash; the Admin chambers",
]
bullets(contents)

# ----------------------------------------------------------------- 1
story.append(PageBreak())
h2("1 &middot; Enlisting &amp; signing in")
p("The League is members only, so first you must enlist.")
h3("Enlist (first time)")
bullets([
 "On the login screen, choose <b>Enlist</b>.",
 "Give your <b>name</b> (how you&rsquo;ll appear on the Muster Roll), your <b>email</b>, "
 "a <b>watchword</b> (password), and pick the <b>army</b> you&rsquo;re currently fielding.",
 "Confirm the watchword and you&rsquo;re in.",
])
callout("Note &mdash;", "The very first soul to enlist becomes the <b>Grand Marshal</b> "
        "(the administrator). Everyone after that is a regular member until promoted.")
h3("Sign in (returning)")
bullets([
 "Choose <b>Sign in</b>, enter your email and watchword.",
 "Your name must be unique on the roll &mdash; if it&rsquo;s taken, pick another.",
])
muted("First load after signing in pulls everything down for you; give it a breath and the realm fills in.")

# ----------------------------------------------------------------- 2
story.append(PageBreak())
h2("2 &middot; Finding your way around")
p("Along the top of the site is a row of tabs. On a phone, tap the menu button to reveal them.")
table([
 ["Tab", "What you&rsquo;ll find"],
 ["Town Square", "Your home page: the reigning champion, the next gathering, your fixtures, calls to arms, the Muster Roll, quotes and recent photos."],
 ["League", "League tables, standings and fixture lists."],
 ["Grand Tourney", "Knock-out cup brackets."],
 ["Hall of Fame", "Past champions and cup winners, by trophy."],
 ["Council", "Proposals and votes on the rules of the realm."],
 ["Battles", "Scheduled games, battle reports and the full standings."],
 ["Gallery", "Photos and painted miniatures, with votes and comments."],
 ["Library", "House rules, documents and links."],
 ["Herald", "Frequently bellowed questions, plus how Might and ranks work."],
 ["Admin", "The Grand Marshal&rsquo;s chambers (admins only)."],
], [3.4*cm, doc.width-3.4*cm])
muted("Your name sits top-right on every page &mdash; click it to jump to your own profile. "
      "Sign out is right beside it.")

# ----------------------------------------------------------------- 3
story.append(PageBreak())
h2("3 &middot; The Town Square (home)")
p("Your landing page and the heartbeat of the club.")
bullets([
 "<b>Next gathering</b> &mdash; a banner showing the upcoming social: who&rsquo;s hosting, where, and when. (The Grand Marshal sets this.)",
 "<b>Champion of the Old World</b> &mdash; the reigning league champion, crowned in gold.",
 "<b>Your fixtures</b> &mdash; games scheduled for you, with dates (or &ldquo;TBC&rdquo;).",
 "<b>Calls to Arms</b> &mdash; who&rsquo;s looking for a game (see next section).",
 "<b>Muster Roll</b> &mdash; every member, their headline rank and army.",
 "<b>Quotes &amp; photos</b> &mdash; the latest sayings and snapshots. Click a photo to enlarge it and leave a comment.",
])

# ----------------------------------------------------------------- 4
story.append(PageBreak())
h2("4 &middot; Calls to Arms (availability)")
p("The simplest way to get a game.")
h3("Post your availability")
bullets([
 "On the Town Square, click <b>I&rsquo;m available</b>.",
 "Pick a <b>date</b>, the <b>type</b> of game (friendly, league or cup), and add a <b>note</b> if you like (points, place, etc.).",
 "Post it &mdash; your call appears for everyone, and an email goes out to members who want them.",
])
h3("Answer a call")
bullets([
 "See a game you fancy? Click <b>I&rsquo;m up for it</b>.",
 "A fixture is created automatically between the two of you, and the person who posted gets an email letting them know.",
])
callout("Tip &mdash;", "You can switch these emails off in your profile settings (the "
        "&ldquo;someone accepted <i>your</i> game&rdquo; note always comes through, since it&rsquo;s aimed only at you).")

# ----------------------------------------------------------------- 5
story.append(PageBreak())
h2("5 &middot; The League")
p("League tables track wins, draws, losses and points across a season.")
bullets([
 "Each league shows a sortable table; <b>Pts</b> is worked out automatically from the league&rsquo;s win/draw values.",
 "A league can carry its own <b>charter</b> &mdash; points rules, house rules and FAQs.",
])
h3("Building the fixtures (Grand Marshal)")
p("Two ways, on each league:")
bullets([
 "<b>Generate fixtures</b> &mdash; auto round-robin: everyone plays everyone once, split into Round 1, 2, 3&hellip; Dates and points left blank to fill in later.",
 "<b>Build by hand</b> &mdash; draw the pairings yourself. Add a row per game (Round number, Combatant A vs B, optional date &mdash; blank for &ldquo;TBC&rdquo;), then create them all at once. Perfect for a hand-made draw.",
])
p("Either way, fixtures appear grouped by round in the <b>Battles</b> tab, where the Grand "
  "Marshal can add a note to each round (e.g. &ldquo;750 pts &middot; special rules&rdquo;).")

# ----------------------------------------------------------------- 6
story.append(PageBreak())
h2("6 &middot; The Grand Tourney")
p("For knock-out competitions. Create a tourney with a blank bracket or a ready-made template "
  "(8 or 16 combatants), then fill in the pairings and results as the rounds are fought to the Final.")

# ----------------------------------------------------------------- 7
story.append(PageBreak())
h2("7 &middot; Battles &amp; battle reports")
p("When the dice stop rolling, record what happened.")
h3("Schedule a battle")
p("The Grand Marshal can schedule a one-off game (combatants, date, points, type, scenario, notes) from the Battles tab.")
h3("File a battle report")
p("Anyone can file a report. Click <b>File battle report</b> and record:")
bullets([
 "The two <b>combatants</b> and the <b>armies</b> they fielded.",
 "The <b>result</b> &mdash; victory to A or B, or a draw &mdash; and the <b>margin</b> (marginal, victory, or defiant). Margin nudges the Might rating.",
 "A <b>result detail</b> (e.g. &ldquo;Massacre, +840 VP&rdquo;) and the <b>Moment of the match</b>.",
 "<b>Hall of Infamy</b> entries &mdash; immortalise heroic dice failures (who rolled how many ones).",
])
callout("Casual games &mdash;", "Tick &ldquo;Casual game&rdquo; and the result is kept out of Might, "
        "league points and records &mdash; but it still counts towards your army rank (dedication, not skill).")
muted("You can delete a report you filed; the Grand Marshal can delete any. Deleting affects the ladder, so there&rsquo;s a confirm step.")

# ----------------------------------------------------------------- 8
story.append(PageBreak())
h2("8 &middot; Might (the skill rating)")
p("<b>Might</b> is the League&rsquo;s skill rating &mdash; an ELO score. Everyone starts level; "
  "beat a stronger opponent and you gain more, lose to a weaker one and you drop more. The victory "
  "<i>margin</i> scales the swing. Casual games don&rsquo;t touch it.")
p("Might is separate from league points (which reward turning up and winning a season) and from your "
  "army rank (which rewards games played).")

# ----------------------------------------------------------------- 9
story.append(PageBreak())
h2("9 &middot; Army ranks")
p("Your <b>rank</b> is a badge of dedication, not skill &mdash; it rewards rolling dice. Win, lose, "
  "draw or casual, every battle you file counts.")
bullets([
 "There are <b>ten ranks</b>, and <b>every army has its own ladder</b>, themed to its lore (an Empire general climbs from Stableboy to Lord-General of the Empire; a Dwarf from Beardling to King under the Mountain).",
 "Ranks build <b>separately per army</b> &mdash; ten games with the Empire and twenty with the Dwarfs earns a different rank in each.",
 "Your <b>headline rank</b> (on the Muster Roll and your profile) is the army you&rsquo;ve set as your own &mdash; or, if you&rsquo;ve never fielded it, your most-played army.",
])
table([
 ["Tier", "Games played"],
 ["1 (start)", "0"], ["2", "1"], ["3", "3"], ["4", "6"], ["5", "10"],
 ["6", "15"], ["7", "22"], ["8", "30"], ["9", "42"], ["10 (top)", "55"],
], [4*cm, doc.width-4*cm])
muted("Your full rank per army is shown on your profile under &ldquo;Battle record by army&rdquo;.")

# ----------------------------------------------------------------- 10
story.append(PageBreak())
h2("10 &middot; The Council")
p("Where the rules of the realm are debated.")
bullets([
 "Anyone can raise a <b>proposal</b> &mdash; a title and the detail of what you&rsquo;re suggesting.",
 "Members <b>vote</b> for or against.",
 "The Grand Marshal can <b>seal</b> a proposal (adopt it) or <b>strike</b> it (reject it). You can withdraw your own open proposal.",
])

# ----------------------------------------------------------------- 11
story.append(PageBreak())
h2("11 &middot; The Gallery")
p("The club&rsquo;s picture-book.")
bullets([
 "<b>Upload</b> a photo with a caption. Choose whether it&rsquo;s a general snapshot or a <b>painted miniature</b>.",
 "Click any picture to open it large. From there you can read and add <b>comments</b> &mdash; the same comments show on the Town Square.",
 "Painted miniatures can be <b>voted</b> for.",
 "You can delete your own uploads; the Grand Marshal can delete any.",
])

# ----------------------------------------------------------------- 12
story.append(PageBreak())
h2("12 &middot; The Hall of Fame")
p("The roll of legends &mdash; past champions and cup winners, grouped by trophy and year. The Grand "
  "Marshal keeps it up to date so the deeds of seasons gone by are never forgotten.")

# ----------------------------------------------------------------- 13
story.append(PageBreak())
h2("13 &middot; The Library &amp; the Herald")
h3("The Library")
p("House rules, army restrictions, scenarios and handy links &mdash; the documents that keep games "
  "fair. The Grand Marshal adds and maintains these.")
h3("The Herald")
p("Frequently bellowed questions, plus plain-English explainers for <b>&ldquo;What is Might?&rdquo;</b> "
  "and <b>&ldquo;Climbing the ranks&rdquo;</b>. Start here if something on the site puzzles you.")

# ----------------------------------------------------------------- 14
story.append(PageBreak())
h2("14 &middot; Your profile &amp; settings")
p("Reach your profile by clicking your name (top-right). It shows your Might, record, rank per army, "
  "head-to-head results and any honours awarded to you.")
h3("Settings (the cog on your own profile)")
bullets([
 "<b>Army you&rsquo;re currently playing</b> &mdash; sets your headline rank&rsquo;s ladder.",
 "<b>Avatar</b> &mdash; a portrait for your profile.",
 "<b>Noble Steed</b> &mdash; an optional second picture (a mascot/mount). It only appears if you add one.",
 "<b>Email notifications</b> &mdash; toggle club alerts and the weekly digest on or off.",
])

# ----------------------------------------------------------------- 15
story.append(PageBreak())
h2("15 &middot; Email notifications")
p("The League can keep you posted by email. You&rsquo;ll get a message when:")
bullets([
 "A member <b>posts availability</b> for a game.",
 "A <b>new gathering</b> is published.",
 "Someone <b>accepts your</b> call to arms (this one always reaches you).",
 "The <b>weekly digest</b> rounds up new photos and battles.",
])
p("Don&rsquo;t want some of these? Turn them off under <b>Profile &rsaquo; Settings &rsaquo; Email notifications</b>.")

# ----------------------------------------------------------------- 16
story.append(PageBreak())
h2("16 &middot; For the Grand Marshal (Admin)")
p("Only administrators see the <b>Admin</b> tab &mdash; the Grand Marshal&rsquo;s chambers. From here you can:")
bullets([
 "<b>Rename the website</b> &mdash; the masthead, browser tab and login screen all follow (yes, the running joke lives here).",
 "<b>Manage members</b> &mdash; set a member&rsquo;s army, promote or demote administrators, or remove a member entirely. (Battle history is kept &mdash; it&rsquo;s tied to the name, not the account.)",
 "<b>Set the next gathering</b> &mdash; host, place, date and a note for the Town Square banner.",
 "<b>Army emblems</b> &mdash; upload a crest for each army.",
 "<b>Crowns &amp; honours</b> &mdash; crown the Champion of the Old World and award side-titles (league, cup, wooden spoon, custom).",
 "<b>Hall of Fame</b> &mdash; record past champions and cup winners.",
 "<b>Back up the data</b> &mdash; export a JSON copy for safe keeping.",
])
callout("Three titles, kept distinct &mdash;", "<b>Grand Marshal</b> (the admin), "
        "<b>Lord-General of the Empire</b> (the top Empire rank), and <b>Champion of the Old World</b> "
        "(the league winner). Don&rsquo;t mix them up at the table.")

# ----------------------------------------------------------------- CLOSE
story.append(PageBreak())
h2("Onward")
lead("That&rsquo;s the lot. Enlist, post a call to arms, fight your games, file your reports, and climb the ranks.")
p("Questions the Herald can&rsquo;t answer? Raise them with the Grand Marshal.")
story.append(Spacer(1, 16))
close = Table([[Paragraph("May your dice run hot and your line hold.<br/><br/>"
                          "<font size=9 color='#6b6256'>&mdash; The Old World League</font>",
                          ParagraphStyle("close", fontName="Times-Italic", fontSize=12,
                                         textColor=MUTED, alignment=TA_CENTER, leading=16))]],
              colWidths=[doc.width])
close.setStyle(TableStyle([
    ("BOX", (0,0), (-1,-1), 1.5, BRASS),
    ("TOPPADDING", (0,0), (-1,-1), 18), ("BOTTOMPADDING", (0,0), (-1,-1), 18),
]))
story.append(close)

# ----------------------------------------------------------------- footer
def footer(canvas, d):
    canvas.saveState()
    canvas.setFont("Times-Italic", 8.5)
    canvas.setFillColor(MUTED)
    if d.page > 1:
        canvas.drawCentredString(A4[0]/2, 1.0*cm, "The Old World League — Field Manual · %d" % d.page)
    canvas.restoreState()

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", OUT)
