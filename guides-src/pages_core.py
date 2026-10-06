from frame import lines, lou, warn, table, sources, related, final
from srcs import S

def src(*keys):
    return sources([S[k] for k in keys])

# ---------------------------------------------------------------- Catch-up (Streamlined)
CATCHUP = dict(
    slug="catch-up-filing",
    title="Never filed US taxes from Canada? How to catch up with no penalties · Lou",
    h1="Never filed US taxes from Canada? You can catch up.",
    description="How Americans in Canada catch up on missed US tax returns and FBARs with the IRS Streamlined Foreign Offshore Procedures: who qualifies, what to file, and which years.",
    lede="Many Americans in Canada find out late that they were supposed to file every year. The IRS has a procedure built for exactly this, and it carries no penalties.",
    short="""<p>If you didn't know you had to file, the IRS <strong>Streamlined Foreign Offshore Procedures</strong> let you catch up by filing your last <strong>3 years of tax returns</strong> and <strong>6 years of FBARs</strong>, with a signed statement (Form 14653) that the failure was not willful. You pay any tax and interest due. There are <strong>no penalties</strong>.</p>
<p>Because Canadian tax usually offsets US tax, many people catching up owe nothing at all.</p>""",
    secs=[
        ("Why so many Americans in Canada are behind", """
<p>The US taxes its citizens and green card holders wherever they live. Canada doesn't work that way, so people who moved north years ago, or who were born in Canada to an American parent, often never hear about it. They find out from a bank asking about US citizenship, a news story, or a parent.</p>
<p>The IRS knows this. Its Streamlined Filing Compliance Procedures are for taxpayers whose failure to file was non-willful. The version for people living outside the US, the Streamlined Foreign Offshore Procedures, is the one that applies to most Americans living in Canada.</p>"""),
        ("Do you qualify?", """
<p>You can generally use the Streamlined Foreign Offshore Procedures if all of these are true:</p>
""" + lines([
    ("1", "You live outside the US", "As a US citizen or green card holder: no US home (abode), and at least 330 full days outside the US in at least one of the last 3 years whose return due date has passed", "Required", "t"),
    ("2", "Your failure was non-willful", "Negligence, inadvertence, mistake, or a good-faith misunderstanding of the rules", "Required", "t"),
    ("3", "You have a taxpayer number", "A US Social Security number. The IRS says that if you are eligible for one and don't have it, you can't use the procedure (Streamlined FAQ 10)", "Required", "t"),
    ("4", "The IRS isn't already examining you", "You can't be under an IRS civil examination or criminal investigation", "Required", "t"),
]) + """
<p class="note">Many Americans born or raised in Canada never got a Social Security number. You'll need one before you file; you apply through the US Social Security Administration.</p>"""),
        ("What you file", """
""" + lines([
    ("A", "Tax returns", "The 3 most recent years whose due date (or properly extended due date) has passed, with every required form and schedule", "3 years", "t"),
    ("B", "Information returns", "Any that apply for those years: Form 8938, Forms 3520 and 3520-A, Form 8621, and others", "With the returns", "t"),
    ("C", "Form 14653", "Your signed certification, including your own description of why you didn't file", "Signed", "t"),
    ("D", "Payment", "Any tax shown on the returns, plus interest", "Often $0", "t"),
    ("E", "FBARs", "The 6 most recent years whose FBAR due date has passed, filed online through BSA E-Filing", "6 years", "t"),
]) + """
<h3>How the package is sent</h3>
<ul>
<li>Write <strong>"Streamlined Foreign Offshore"</strong> in red at the top of each return and information return.</li>
<li>Mail the returns and Form 14653 on paper, and pay the tax and interest due. Electronic submissions of the returns are not accepted. The IRS address is: Internal Revenue Service, 3651 South I-H 35, Stop 6063 AUSC, Attn: Streamlined Foreign Offshore, Austin, TX 78741.</li>
<li>File the FBARs online yourself. On each one, choose "Other" as the reason for filing late and enter "Streamlined Filing Compliance Procedures".</li>
</ul>"""),
        ("Which years apply right now", """
<p>The window moves with the date you submit. A return counts once its due date has passed: June 15 for someone living abroad (the automatic extension), or October 15 if you filed Form 4868. An FBAR counts once it is late, after October 15 of the following year. For a package submitted <strong>between October 16, 2026 and June 15, 2027</strong>, it is:</p>
""" + lines([
    ("R", "Tax returns", "", "2023, 2024, 2025", "t"),
    ("F", "FBARs", "", "2020 to 2025", "t"),
], head=("Filing", "Years")) + """
<p>After June 15, 2027, the 2026 return can enter the window and 2023 can drop out (the 2026 FBAR joins after October 15, 2027). Lou works out the exact years from today's date and asks about an extension when it matters. If you submit close to one of these dates and are unsure, ask a professional which years apply.</p>"""),
        ("What it costs you", """
<p>Under the foreign procedures there are <strong>no failure-to-file or failure-to-pay penalties, no accuracy penalties, no information return penalties and no FBAR penalties</strong>. You pay only the tax due on the three returns, plus interest.</p>
<p>For most Americans in Canada the tax is small or zero. Canadian income tax is usually higher than US tax on the same income, and the <a href="/guides/foreign-tax-credit/">foreign tax credit</a> applies to catch-up years like any other year. Where tax does come up, it is usually from income Canada doesn't tax: <a href="/guides/tfsa/">TFSA</a> earnings, <a href="/guides/mutual-funds-etfs-pfic/">Canadian funds</a>, or Home Buyers' Plan withdrawals.</p>
<h3>Your RRSP is protected</h3>
<p>People who never filed can't technically make the RRSP and RRIF deferral election on time. The IRS says Streamlined filers get relief consistent with Rev. Proc. 2014-55 (Streamlined FAQ 3), so the growth inside your RRSP stays tax-deferred. See <a href="/guides/rrsp-rrif/">RRSP and RRIF</a>.</p>"""),
        ("Writing your Form 14653 statement", """
<p>Form 14653 is signed under penalties of perjury. Its key part is your own explanation of why you didn't file. The IRS wants specific facts, not a formula: when you moved or were born abroad, what you knew about US filing, how you found out, and what you did next.</p>
<p>Write it in your own words and keep it true. A professional is worth it here if your facts are mixed, for example if you once received an IRS letter or an advisor told you about filing years ago.</p>"""),
        ("When to talk to a professional first", """
""" + warn("""<p>The Streamlined procedures rely on your certification that you were non-willful, and the IRS can audit any Streamlined submission. Get advice before filing if any of these apply:</p>
<ul>
<li>You knew about the US filing or FBAR rules and didn't follow them.</li>
<li>You have had letters or contact from the IRS about these years.</li>
<li>Large balances, foreign corporations, partnerships or trusts beyond registered accounts.</li>
<li>A business with employees, rental properties, or an estate.</li>
<li>You are considering giving up US citizenship. That has its own rules.</li>
</ul>""") + """
<p>Penalties the IRS already assessed before you file are not removed by the procedure.</p>"""),
    ],
    lou_html=lou("Catching up with Lou", """<ul>
<li>One $49 CAD key (plus tax) covers the three returns, 2023 to 2025, and FBAR worksheets for the six years that apply.</li>
<li>Lou prepares each return with its information returns, carries your foreign tax credits from year to year, and prompts you for the RRSP and RRIF relief statement.</li>
<li>It guides you through Form 14653, asking the questions the IRS wants answered so you can write the statement in your own words.</li>
<li>You get a mailing checklist: the red "Streamlined Foreign Offshore" notation, signatures, the Austin address, and the FBAR late-filing reason to enter online.</li>
<li>Everything is prepared on your own device. Nothing is sent to us or to the IRS.</li>
</ul>"""),
    srcs=("sfop", "sfcp", "sfaq", "f14653", "fbarinst", "bsa", "rp1455"),
    rel=("fbar", "rrsp-rrif", "tfsa", "foreign-tax-credit", "form-8938", "mutual-funds-etfs-pfic"),
    final_html=final("Behind on US taxes?", "Catch up for $49.", "Three returns and six years of FBAR worksheets on one key. Free to try; you pay only when you're ready to download. Your documents stay on your device."),
)

# ---------------------------------------------------------------- FAQ (groups of (question, answer html))
FAQ = [
    ("About Lou", [
        ("What does Lou do?",
         "<p>You upload the Canadian tax return you already filed (or your slips). Lou reads it on your own device, converts everything to US dollars, works out your US return, and fills the official IRS forms. Every number shows which Canadian box it came from and which rule moved it.</p>"),
        ("Who is Lou for?",
         "<p>US citizens, dual citizens and green card holders who lived in Canada for the whole tax year. Lou isn't built for people who moved between the countries during the year (a dual-status return), Canadians with no US status who need a nonresident return, or snowbirds filing Form 8840. Lou also doesn't do Quebec returns yet (see below).</p>"),
        ("Does Lou work if I live in Quebec?",
         "<p>Not yet. Quebec has its own return, its own slips (such as the Relevé 1) and its own rules that affect the foreign tax credit, and Lou hasn't been checked against them, so it stops instead of guessing. If you lived in Quebec on December 31 of the tax year, ask a cross-border tax professional. Lou works for every other province and territory.</p>"),
        ("Which tax years does Lou cover?",
         "<p>2023, 2024 and 2025, plus FBAR worksheets for the six years that apply (2020 to 2025 after October 15, 2026). Tax year 2026 will be added before the 2027 filing season.</p>"),
        ("What do I need to get started?",
         "<p>Your Canadian T1 return as a PDF from your tax software or CRA My Account, and Social Security numbers for you, your spouse and any children you claim. If you don't have the T1 PDF, your slips plus your Notice of Assessment work too. Lou asks for anything the T1 doesn't show, such as account balances or investment sales.</p>"),
        ("Which Canadian documents can Lou read?",
         "<p>The T1 General and Notice of Assessment, and these slips: T4, T4A, T4A(P), T4A(OAS), T4E, T4RSP, T4RIF, T5, T3, T5008 and T5007. PDFs, CSV exports and phone photos all work. Anything read from a photo that Lou isn't sure of is marked \"Please check\".</p>"),
        ("Which US forms does Lou prepare?",
         "<p>Form 1040 and Schedules 1, 1-A, 2, 3, B, C, D and 8812; Form 1116 (including the AMT version), 2555, 6251, 8833, 8938, 8949, 8621, Forms 3520 and 3520-A, and an FBAR worksheet. You also get a line-by-line guide from each Canadian box to each US line, and a review package you can hand to a professional.</p>"),
        ("Does Lou file my return?",
         "<p>No. Lou prepares the forms; you review, sign and file them. You can mail the return or enter the figures into e-file software. The FBAR can only be filed by you online through FinCEN's BSA E-Filing System, and Lou gives you a worksheet to copy from.</p>"),
        ("Is Lou tax advice?",
         "<p>No. Lou is software, not a tax preparer. It follows official IRS and CRA sources and flags situations that need judgment instead of guessing, but you are responsible for your return. See the <a href=\"/legal/notices.html\">notices</a>.</p>"),
    ]),
    ("Privacy", [
        ("Where do my tax documents go?",
         "<p>Nowhere. Lou reads PDFs and photos, does the math and fills the forms inside your browser. There is no account, no server that receives your documents, no cloud text recognition, no AI service and no analytics. The only things that ever reach our server are the payment for a key (handled by Stripe), a request to email you a lost key, and messages you send through Report a problem. None of them includes your tax information. See the <a href=\"/legal/privacy.html\">privacy policy</a>.</p>"),
        ("How can I check that?",
         "<p>The app blocks connections to other websites, and you can watch its network activity in your browser's developer tools while you work. Lou's source code is <a href=\"https://github.com/karimawad/lou\">public on GitHub</a>.</p>"),
        ("What if I switch computers or clear my browser?",
         "<p>Your work is saved in your browser on that device. Save a backup file from Lou (you can protect it with a password) and open it on the other computer. On Chrome and Edge, Lou can also save automatically to a folder you choose.</p>"),
    ]),
    ("Price", [
        ("How much does Lou cost?",
         "<p>$49 CAD plus applicable tax, once. That covers your 2023, 2024 and 2025 returns. Each new tax year after that is $49. There's no subscription and no account.</p>"),
        ("Can I try it before paying?",
         "<p>Yes. Upload your documents, check the numbers and see your results for free. You pay only when you are ready to download the filled forms, the review package, the mapping guide and the FBAR worksheet.</p>"),
        ("Can I get a refund?",
         "<p>If Lou doesn't work for your situation, write to <a href=\"mailto:info@bigtimedesign.ca\">info@bigtimedesign.ca</a> within 15 days of buying and you'll get a full refund, including the tax.</p>"),
        ("Can I use one key for my family?",
         "<p>Yes, for your own returns and the returns of family members you help. A professional preparing returns for clients needs their own key.</p>"),
    ]),
    ("Filing", [
        ("Will I owe US tax?",
         "<p>Often not. Canadian income tax is usually higher than US tax on the same income, and the <a href=\"/guides/foreign-tax-credit/\">foreign tax credit</a> subtracts it from your US tax. US tax most often shows up on income Canada doesn't tax, such as <a href=\"/guides/tfsa/\">TFSA</a> earnings or <a href=\"/guides/mutual-funds-etfs-pfic/\">Canadian funds</a>. Some families receive a refund through the child tax credit.</p>"),
        ("Do I need to file if I won't owe anything?",
         "<p>Yes, if your income is over the filing threshold, which is based on your worldwide income, not on what you owe. For 2025 the threshold for a single filer under 65 is $15,750, and for married filing separately it is $5. Owing nothing doesn't remove the requirement.</p>"),
        ("When is my US return due?",
         "<p>April 15. If you live outside the US on that date, you automatically get until June 15 to file and pay (attach a statement saying you qualify), though interest on any tax owed runs from April 15. Form 4868, filed by June 15, extends filing to October 15. The FBAR is due April 15 with an automatic extension to October 15.</p>"),
        ("Where do I mail my return from Canada?",
         "<p>If you're not enclosing a payment: Department of the Treasury, Internal Revenue Service, Austin, TX 73301-0215, USA. If you are enclosing a check or money order: Internal Revenue Service, P.O. Box 1303, Charlotte, NC 28201-1303, USA. Catch-up (Streamlined) returns go to a different address; see <a href=\"/guides/catch-up-filing/\">Catching up</a>.</p>"),
        ("My spouse is Canadian, not American. How do we file?",
         "<p>Usually married filing separately, with \"NRA\" (nonresident alien) for your spouse's number. You can instead choose to file jointly, which brings your spouse's worldwide income onto the US return and means getting them an ITIN with Form W-7. Lou supports both and tells you what each one means.</p>"),
        ("Do I need a state return?",
         "<p>Lou prepares the federal return only. Most Americans who have lived in Canada for years have no state filing, but some states keep treating former residents as residents while they still have ties there, such as a home, a driver's licence or voter registration. If that might be you, check with that state.</p>"),
    ]),
    ("Catching up", [
        ("I've never filed a US return. What now?",
         "<p>You're far from alone. The IRS Streamlined Foreign Offshore Procedures let you file the last three years of returns and six years of FBARs with no penalties if your failure wasn't willful. Read <a href=\"/guides/catch-up-filing/\">Catching up on missed years</a>.</p>"),
        ("I don't have a Social Security number.",
         "<p>US citizens need one to file. Apply through the US Social Security Administration before you send your returns. A spouse who isn't a US person and isn't eligible for a Social Security number can use an ITIN or \"NRA\", depending on how you file.</p>"),
        ("Does catching up cost more?",
         "<p>No. The same $49 CAD key covers all three returns, 2023 to 2025, and the FBAR worksheets for the six years that apply.</p>"),
    ]),
    ("Your situation", [
        ("I have a TFSA, RRSP, FHSA or RESP.",
         "<p>Lou handles them, and each is treated differently by the US. See <a href=\"/guides/tfsa/\">TFSA</a>, <a href=\"/guides/rrsp-rrif/\">RRSP and RRIF</a> and <a href=\"/guides/fhsa-resp/\">FHSA, RESP and RDSP</a>.</p>"),
        ("I own Canadian mutual funds or ETFs.",
         "<p>They are generally PFICs under US rules. Lou handles the default rules, mark-to-market and QEF elections and fills Form 8621. Read <a href=\"/guides/mutual-funds-etfs-pfic/\">Mutual funds and ETFs</a> first.</p>"),
        ("I'm self-employed.",
         "<p>Lou builds Schedule C from your T2125 figures. Under the US-Canada social security agreement you pay CPP or QPP in Canada and no US self-employment tax. See <a href=\"/guides/cpp-oas/\">CPP, QPP and OAS</a>.</p>"),
        ("I receive CPP or OAS.",
         "<p>By default Lou treats them as taxable only in Canada, the position most cross-border professionals take, and you can switch that. Read why in <a href=\"/guides/cpp-oas/\">CPP, QPP and OAS</a>.</p>"),
        ("I have rental property or a more complex situation.",
         "<p>Lou flags income it doesn't convert, such as rental income, instead of leaving it out. Consider a qualified cross-border tax professional for rental or complex business income, foreign corporations or trusts, an estate, or a move between countries. Lou's review package is designed to hand to one.</p>"),
    ]),
    ("Help", [
        ("I think Lou got something wrong.",
         "<p>Please tell us through <a href=\"/support/\">Report a problem</a> or at <a href=\"mailto:info@bigtimedesign.ca\">info@bigtimedesign.ca</a>, with the tax year and what you expected. Don't send your tax documents or identification numbers; we never need them.</p>"),
    ]),
]
