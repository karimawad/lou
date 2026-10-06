from frame import lines, lou, warn, table, sources, related, guide_body
from srcs import S
from registry import GUIDES

def src(*keys):
    return sources([S[k] for k in keys])

PAGES = []

# ---------------------------------------------------------------- TFSA
PAGES.append(dict(
    slug="tfsa",
    title="TFSA on a US tax return: what Americans in Canada need to know · Lou",
    h1="Your TFSA on a US tax return",
    description="A TFSA is tax-free in Canada but not in the US. How Americans in Canada report TFSA income, FBAR, Form 8938 and the Form 3520 question.",
    lede="Tax-free in Canada does not mean tax-free in the US. Here is what a TFSA means on your US return, and the reporting question nobody has fully settled.",
    short="""<p>The US does not recognize the TFSA. Interest, dividends and gains earned inside it are taxable on your US return <strong>every year</strong>, whether or not you take money out.</p>
<p>The account also goes on your FBAR (and Form 8938 if you are over the threshold). The IRS has never said whether a TFSA is a foreign trust. If it is, Forms 3520 and 3520-A are due too, and many cross-border professionals file them to be safe.</p>""",
    secs=[
        ("Why the US taxes a TFSA", """
<p>A TFSA is a Canadian tax shelter created by Canadian law. The US taxes its citizens and green card holders on their worldwide income, and nothing in US law or the US-Canada tax treaty exempts TFSA income. The treaty's pension rules cover retirement plans such as RRSPs and RRIFs. A TFSA is a savings account, so those rules don't reach it.</p>
<p>So each year you report the income earned inside your TFSA as if you held the investments directly:</p>
<ul>
<li>Interest on Schedule B and Form 1040.</li>
<li>Dividends from Canadian companies as dividends (they can be qualified dividends if the holding period is met).</li>
<li>Gains and losses on sales on Form 8949 and Schedule D, using the exchange rate on the purchase and sale dates.</li>
<li>Mutual funds and ETFs inside a TFSA are PFICs, with no exemption. See <a href="/guides/mutual-funds-etfs-pfic/">Mutual funds and ETFs</a>.</li>
</ul>
<p>Contributions are not deductible in either country, and taking your own money out is not income. Only the earnings matter.</p>"""),
        ("Why this is where you can actually owe US tax", """
<p>Most Americans in Canada owe little or no US tax because the Canadian tax they pay is credited against their US tax (see <a href="/guides/foreign-tax-credit/">Foreign tax credit</a>). TFSA income is different: Canada doesn't tax it, so there is usually no Canadian tax on that income to credit. Unless you have spare foreign tax credits in the passive category, TFSA income can produce a real US tax bill. For most people with modest balances it is small, but it is not zero.</p>"""),
        ("The Form 3520 question", """
<p>A TFSA held at a bank or brokerage is set up as a trust arrangement under Canadian rules. If the US treats it as a <strong>foreign grantor trust</strong>, you are its owner and must file:</p>
""" + lines([
    ("1", "Form 3520", "Annual return for owners of foreign trusts", "Due with your return", "t"),
    ("2", "Form 3520-A (substitute)", "Attached to your Form 3520 when the trust itself doesn't file one, which a Canadian bank won't", "Attached to 3520", "t"),
    ("3", "Where", "Mailed separately from your Form 1040", "Ogden, UT", "t"),
    ("4", "Penalty for not filing", "Greater of $10,000 or a percentage of the trust", "$10,000+", "n"),
]) + """
<p><strong>Due dates.</strong> Form 3520 is due April 15. If you live outside the US on that date, it moves to June 15, with a statement saying so. If you got an extension for your income tax return, it can go to October 15.</p>
<p><strong>Is it really required?</strong> The IRS has not ruled. Some professionals file Forms 3520 and 3520-A for every TFSA because the penalties are large. Others don't, because the classification is unsettled. What is settled: the TFSA does <em>not</em> qualify for the Rev. Proc. 2020-17 exemption, which only covers retirement plans and accounts for medical, disability or education purposes.</p>"""),
        ("FBAR and Form 8938", """
<p>A TFSA is a foreign financial account. Include its highest balance of the year on your <a href="/guides/fbar/">FBAR</a> when your accounts together pass $10,000. It also counts toward the <a href="/guides/form-8938/">Form 8938</a> threshold. These apply even if you decide Forms 3520 and 3520-A don't.</p>"""),
    ],
    lou_html=lou("TFSA in Lou", """<ul>
<li>You enter the account once: opening date, start and year-end values, contributions, withdrawals and the income earned inside.</li>
<li>Lou reports the income on your Form 1040, sends any funds held inside to the PFIC section, and adds the account to your FBAR worksheet and Form 8938.</li>
<li>By default Lou prepares Form 3520 and a substitute Form 3520-A as a separate package with its own mailing instructions. You can switch this off; Lou tells you what that means before you do.</li>
</ul>"""),
    srcs=("i3520", "i3520a", "rp2017", "fbarinst", "i8938", "i8621"),
    rel=("mutual-funds-etfs-pfic", "fhsa-resp", "fbar", "form-8938", "catch-up-filing"),
))

# ---------------------------------------------------------------- RRSP / RRIF
PAGES.append(dict(
    slug="rrsp-rrif",
    title="RRSP and RRIF on a US tax return for Americans in Canada · Lou",
    h1="RRSP and RRIF on your US return",
    description="How the US taxes RRSPs and RRIFs for Americans in Canada: automatic deferral under Rev. Proc. 2014-55, withdrawals, HBP and LLP, FBAR and Form 8938.",
    lede="The good news first: the treaty lets your RRSP or RRIF keep growing without US tax. The catches are in contributions, withdrawals and reporting.",
    short="""<p>Growth inside an RRSP or RRIF is not taxed by the US until you take money out. This deferral is automatic under Rev. Proc. 2014-55; you no longer file Form 8891.</p>
<p>Your contributions don't reduce your US taxable income. Withdrawals are taxed by the US as pension income, minus your US basis, and the Canadian tax on them counts toward your foreign tax credit. The accounts still go on your FBAR and Form 8938.</p>""",
    secs=[
        ("Growth: deferred automatically", """
<p>Article XVIII(7) of the US-Canada tax treaty lets a US citizen or resident defer US tax on income that builds up inside a Canadian retirement plan until it is paid out. Since Rev. Proc. 2014-55, eligible people are treated as having made that election automatically. Form 8891 is obsolete.</p>
<p>You are an "eligible individual" if you have filed your US returns, never reported the RRSP's inside growth as income, and reported any withdrawals as if the deferral applied. If you once reported the growth each year, you are not eligible and need IRS permission to switch.</p>
<p><strong>Catching up?</strong> If you never filed, the IRS says people who come in through the Streamlined Foreign Offshore Procedures get relief consistent with Rev. Proc. 2014-55 (Streamlined FAQ 3). See <a href="/guides/catch-up-filing/">Catching up on missed years</a>.</p>"""),
        ("Contributions", """
<p>RRSP contributions lower your Canadian tax, not your US tax. Your US return shows your full Canadian wages. The treaty has narrow rules that can allow a US deduction for some employer pension plans, which are claimed with Form 8833; they don't apply to an ordinary personal RRSP.</p>
<p>Because the US never gave you a deduction, those contributions can become <strong>US basis</strong>: money that comes back to you tax-free on the US side when you withdraw. Keep your contribution records.</p>"""),
        ("Withdrawals: T4RSP and T4RIF", """
<p>The IRS treats RRSP and RRIF payments as pensions (Publication 597). They go on Form 1040 lines 5a and 5b: the full payment on 5a, the taxable part (payment minus your US basis) on 5b.</p>
""" + lines([
    ("22", "T4RSP box 22: withdrawals", "Taxable in the US as pension income, minus basis", "1040 line 5a/5b", "t"),
    ("16", "T4RIF box 16: RRIF payments", "Same treatment", "1040 line 5a/5b", "t"),
    ("27", "T4RSP box 27: Home Buyers' Plan", "Tax-free in Canada, but taxable in the US (minus basis)", "Taxable in US", "t"),
    ("25", "T4RSP box 25: Lifelong Learning Plan", "Tax-free in Canada, but taxable in the US (minus basis)", "Taxable in US", "t"),
    ("30", "T4RSP box 30 / T4RIF box 28: tax deducted", "Withholding only; the credit uses your actual Canadian tax for the year", "Form 1116", "t"),
], head=("Slip box", "US treatment")) + """
<p>The Canadian tax you pay on a withdrawal counts toward your <a href="/guides/foreign-tax-credit/">foreign tax credit</a>. Most practitioners put RRSP and RRIF withdrawals in the general category. The IRS has not ruled on this specifically.</p>"""),
        ("Reporting the accounts", """
<p>Rev. Proc. 2014-55 also exempts RRSPs and RRIFs from Forms 3520 and 3520-A. It does not exempt them from the <a href="/guides/fbar/">FBAR</a> or <a href="/guides/form-8938/">Form 8938</a>: include each plan's balances there.</p>
<p>Mutual funds and ETFs held inside an RRSP or RRIF don't need Form 8621. The PFIC rules exempt funds held through a pension arrangement covered by a tax treaty. See <a href="/guides/mutual-funds-etfs-pfic/">Mutual funds and ETFs</a>.</p>"""),
    ],
    lou_html=lou("RRSP and RRIF in Lou", """<ul>
<li>Lou reads T4RSP and T4RIF slips, asks about your US basis, and fills Form 1040 lines 5a and 5b.</li>
<li>Home Buyers' Plan and Lifelong Learning Plan withdrawals are flagged so they aren't left out.</li>
<li>The plans go on your FBAR worksheet and Form 8938. No Form 8891, no Form 3520, no Form 8621 for funds inside.</li>
</ul>"""),
    srcs=("p597", "rp1455", "sfaq", "treaty", "i8621", "i8938"),
    rel=("tfsa", "fhsa-resp", "foreign-tax-credit", "fbar", "catch-up-filing"),
))

# ---------------------------------------------------------------- FHSA / RESP / RDSP
PAGES.append(dict(
    slug="fhsa-resp",
    title="FHSA, RESP and RDSP on a US tax return for Americans in Canada · Lou",
    h1="FHSA, RESP and RDSP on your US return",
    description="How the US treats the FHSA, RESP and RDSP for Americans living in Canada: yearly income, Forms 3520 and 3520-A, Rev. Proc. 2020-17, FBAR and Form 8938.",
    lede="Three Canadian registered accounts, three different US answers. None of them is tax-sheltered on the US side.",
    short="""<p>The US does not recognize the tax shelter on any of these accounts. Income earned inside is generally taxable on your US return each year.</p>
<p>The difference is paperwork. RESPs and RDSPs are exempt from Forms 3520 and 3520-A under Rev. Proc. 2020-17. The FHSA is not, so it raises the same Form 3520 question as a <a href="/guides/tfsa/">TFSA</a>. All three go on your FBAR and Form 8938.</p>""",
    secs=[
        ("FHSA (First Home Savings Account)", """
<p>The FHSA started in 2023. In Canada, contributions are deductible and a qualifying withdrawal for a first home is tax-free. Neither benefit carries over to your US return:</p>
<ul>
<li>Contributions don't reduce your US income.</li>
<li>Interest, dividends and gains inside the account are reported on your US return each year, the same way as for a TFSA.</li>
<li>Because the income was already taxed on your US return as it was earned, taking your money out for the home does not create new US income under this approach.</li>
</ul>
<p>The FHSA doesn't fit the Rev. Proc. 2020-17 exemption (it is not a retirement, medical, disability or education account), and the IRS hasn't said whether it is a foreign trust. That leaves the same choice as a TFSA: many professionals file Form 3520 and a substitute Form 3520-A to be safe.</p>"""),
        ("RESP (Registered Education Savings Plan)", """
<p>For US purposes the subscriber, usually the parent who contributes, is treated as the owner. Income earned inside the RESP is reported on the subscriber's US return each year.</p>
<p><strong>No Forms 3520 or 3520-A.</strong> Rev. Proc. 2020-17 exempts education savings trusts whose contributions are limited to $10,000 a year or $200,000 lifetime. The RESP's $50,000 lifetime contribution limit fits, so the foreign trust forms are not required.</p>
<p>Government grants such as the Canada Education Savings Grant have no clear US answer. If the grant amounts are large, a cross-border professional can help you choose a position.</p>"""),
        ("RDSP (Registered Disability Savings Plan)", """
<p>The RDSP also fits Rev. Proc. 2020-17, as a trust for disability benefits, so it is exempt from Forms 3520 and 3520-A. It still goes on your FBAR and Form 8938 if you have to file them.</p>"""),
        ("At a glance", table(
            ["Account", "Income inside taxed by US yearly?", "Forms 3520 / 3520-A", "FBAR and Form 8938"],
            [["TFSA", "Yes", "Unsettled; often filed", "Yes"],
             ["FHSA", "Yes", "Unsettled; often filed", "Yes"],
             ["RESP", "Yes, to the subscriber", "Exempt (Rev. Proc. 2020-17)", "Yes"],
             ["RDSP", "See a professional", "Exempt (Rev. Proc. 2020-17)", "Yes"],
             ["RRSP / RRIF", "No, deferred until withdrawn", "Exempt (Rev. Proc. 2014-55)", "Yes"]])),
    ],
    lou_html=lou("These accounts in Lou", """<ul>
<li>Add the account in the accounts step and enter the income earned inside it. Lou reports it on your Form 1040.</li>
<li>FHSA: Lou prepares Form 3520 and a substitute Form 3520-A by default, like a TFSA. You can switch this off.</li>
<li>RESP: no foreign trust forms, as Rev. Proc. 2020-17 allows.</li>
<li>Every account goes on your FBAR worksheet and, when you are over the threshold, Form 8938.</li>
</ul>"""),
    srcs=("rp2017", "i3520", "i3520a", "fbarinst", "i8938"),
    rel=("tfsa", "rrsp-rrif", "fbar", "form-8938", "mutual-funds-etfs-pfic"),
))

# ---------------------------------------------------------------- FBAR
PAGES.append(dict(
    slug="fbar",
    title="FBAR for Americans in Canada: who files, what counts, how to file · Lou",
    h1="The FBAR for Americans in Canada",
    description="FinCEN Form 114 (FBAR) for US citizens in Canada: the $10,000 test, which Canadian accounts count, Treasury exchange rates, deadlines, penalties and late filing.",
    lede="If your Canadian accounts together topped $10,000 US at any point in the year, you file an FBAR. It is separate from your tax return and filed only online.",
    short="""<p>File FinCEN Form 114 (the FBAR) if the combined highest balances of all your foreign accounts were more than <strong>$10,000 US</strong> at any time during the year. For most Americans in Canada, that's every year.</p>
<p>It reports accounts, not income, and there is no tax on it. It is filed online through FinCEN's BSA E-Filing System, not with your Form 1040. Due April 15, with an automatic extension to October 15.</p>""",
    secs=[
        ("Do you need to file?", """
<p>You file if you are a US person (citizen or green card holder) with a financial interest in, or signing authority over, foreign financial accounts whose <strong>maximum values added together</strong> were more than $10,000 at any time in the calendar year. A $6,000 chequing account and a $5,000 TFSA means you file, even though neither account passed $10,000 alone.</p>
<p>Count all of these:</p>
<ul>
<li>Chequing and savings accounts, GICs</li>
<li>Investment and brokerage accounts</li>
<li>RRSP, RRIF, TFSA, FHSA and RESP accounts</li>
<li>Accounts you can sign on but don't own, such as a parent's account or your employer's</li>
</ul>
<p>CPP and OAS are government benefits, not accounts, so they don't go on the FBAR.</p>"""),
        ("Joint accounts and spouses", """
<p>Each US person who owns a joint account reports the <strong>full value</strong> of the account, not half. A spouse who is not a US person doesn't file an FBAR at all. Spouses who are both US persons can file one joint FBAR in some cases, using Form 114a.</p>"""),
        ("Values and exchange rates", """
<p>For each account you report its highest balance during the year, converted to US dollars with the US Treasury's reporting rate for <strong>December 31</strong> of that year, then rounded up to the next whole dollar. This is a different rate from the IRS yearly average used on your tax return.</p>
""" + lines([
    ("25", "December 31, 2025", "", "1.369", "n"),
    ("24", "December 31, 2024", "", "1.438", "n"),
    ("23", "December 31, 2023", "", "1.326", "n"),
    ("22", "December 31, 2022", "", "1.354", "n"),
    ("21", "December 31, 2021", "", "1.277", "n"),
    ("20", "December 31, 2020", "", "1.275", "n"),
], head=("Treasury rate", "CAD per 1 USD")) + """
<p class="note">Divide the Canadian dollar balance by the rate. Example: a highest balance of CA$20,000 in 2025 is $20,000 &divide; 1.369 = $14,609.20, reported as $14,610.</p>"""),
        ("Deadline and how to file", """
<p>The FBAR is due April 15 for the previous calendar year, with an automatic extension to October 15. You don't need to ask for it. It is filed only through FinCEN's BSA E-Filing System; there is no paper version and no fee. Keep your account records for five years.</p>"""),
        ("If you missed years", """
<p>For non-willful violations, the maximum civil penalty is $16,536 per late report (the 2025 inflation adjustment). In <em>Bittner v. United States</em> (2023) the Supreme Court held that this penalty applies per report, not per account. Willful violations carry much larger penalties.</p>
<p>If you didn't know you had to file, the Streamlined Foreign Offshore Procedures let you file the last six years of FBARs with no penalty, as part of catching up your returns. See <a href="/guides/catch-up-filing/">Catching up on missed years</a>.</p>"""),
    ],
    lou_html=lou("The FBAR in Lou", """<ul>
<li>Lou keeps a list of your accounts and asks for each one's highest and year-end balance.</li>
<li>It converts with the correct Treasury rate, rounds up as the instructions require, and tells you whether you are over $10,000.</li>
<li>You get an FBAR worksheet for each year that applies (the six most recent late years, plus the newest if it is not late yet), laid out in the order of the online form, so you can copy each field into BSA E-Filing. Lou can't file the FBAR for you; only you can.</li>
</ul>"""),
    srcs=("fbarinst", "bsa", "fbarpen", "bittner", "treasfx", "sfop"),
    rel=("form-8938", "tfsa", "rrsp-rrif", "exchange-rates", "catch-up-filing"),
))

# ---------------------------------------------------------------- Form 8938
PAGES.append(dict(
    slug="form-8938",
    title="Form 8938 (FATCA) for Americans in Canada: thresholds and what counts · Lou",
    h1="Form 8938 for Americans in Canada",
    description="Form 8938 for US citizens living in Canada: the higher thresholds for people abroad, which Canadian assets count, values, penalties, and how it differs from the FBAR.",
    lede="A second account report, filed with your tax return. Living in Canada raises the threshold a lot, so many people don't need it.",
    short="""<p>Form 8938 (Statement of Specified Foreign Financial Assets, part of FATCA) is attached to your Form 1040. If you live abroad, you only file it when your foreign financial assets are worth more than <strong>$200,000 on December 31 or $300,000 at any time</strong> ($400,000 / $600,000 if married filing jointly).</p>
<p>It overlaps with the FBAR but doesn't replace it. Many people file both.</p>""",
    secs=[
        ("Thresholds for people living abroad", """
<p>These higher thresholds apply if you pass the IRS's presence-abroad test: you are a US citizen who was a bona fide resident of another country for an uninterrupted period that includes the whole tax year, or you were in another country for at least 330 full days in a 12-month period ending in the tax year. Most Americans who live in Canada year-round qualify.</p>
""" + lines([
    ("S", "Single, or married filing separately", "", "$200,000 / $300,000", "n"),
    ("J", "Married filing jointly", "", "$400,000 / $600,000", "n"),
], head=("Filing status", "Year end / any time")) + """
<p class="note">You file if either test is met: the year-end value or the highest value during the year. If you don't have to file a US tax return at all, you don't file Form 8938.</p>"""),
        ("What counts", """
<p>"Specified foreign financial assets" include Canadian bank and investment accounts, registered accounts (RRSP, RRIF, TFSA, FHSA, RESP), and your interest in a foreign pension plan, such as an employer pension. Canadian government benefits like CPP, QPP and OAS are excluded: the instructions treat foreign social security as not reportable.</p>
<p>Values are converted at the Treasury rate for the last day of the year, the same rates used for the <a href="/guides/fbar/">FBAR</a>. Assets you already report on time on certain other forms aren't repeated: a TFSA or FHSA covered by Forms 3520 and 3520-A, or a fund covered by Form 8621. Instead, Part IV of Form 8938 lists how many of those forms you file. They still count toward the threshold.</p>"""),
        ("FBAR or Form 8938?", table(
            ["", "FBAR (FinCEN 114)", "Form 8938"],
            [["Filed with", "FinCEN, online only", "Your Form 1040"],
             ["Threshold (living abroad)", "Over $10,000 combined, any time", "Over $200,000 year end or $300,000 any time (single)"],
             ["Spouse who isn't a US person", "Doesn't file", "Doesn't file"],
             ["CPP / OAS", "Not reported", "Not reported"],
             ["Pension plan interests", "Accounts are reported", "Reported in Part VI"]])),
        ("Penalties", """
<p>The penalty for not filing a required Form 8938 is $10,000, with up to $50,000 more if you still don't file after the IRS notifies you. Catch-up filers include any missing Forms 8938 with their Streamlined returns.</p>"""),
    ],
    lou_html=lou("Form 8938 in Lou", """<ul>
<li>Lou uses the same account list as your FBAR worksheet, so you enter each account once.</li>
<li>It applies the living-abroad thresholds for your filing status and tells you whether you need the form.</li>
<li>When you do, Lou fills Form 8938 Parts I to VI and adds extra pages for more accounts.</li>
</ul>"""),
    srcs=("i8938", "fbarinst", "treasfx"),
    rel=("fbar", "tfsa", "rrsp-rrif", "exchange-rates", "catch-up-filing"),
))
