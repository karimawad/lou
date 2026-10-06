from frame import lines, lou, warn, table, sources, related
from srcs import S

def src(*keys):
    return sources([S[k] for k in keys])

PAGES = []

# ---------------------------------------------------------------- PFIC
PAGES.append(dict(
    slug="mutual-funds-etfs-pfic",
    title="Canadian mutual funds and ETFs (PFIC) for Americans in Canada · Lou",
    h1="Canadian mutual funds and ETFs: the PFIC rules",
    description="Why Canadian mutual funds and ETFs are PFICs for US taxpayers, how they are taxed, when Form 8621 is required, and the RRSP and $25,000 exceptions.",
    lede="The most expensive surprise for Americans in Canada usually isn't a tax rate. It is a Canadian index fund held in the wrong account.",
    short="""<p>The US generally treats Canadian mutual funds and ETFs as <strong>passive foreign investment companies (PFICs)</strong>. Unless you make an election, gains and large distributions are taxed at the highest US rate with an interest charge, and each fund can need its own Form 8621 every year.</p>
<p>Two exceptions help: funds held inside an RRSP or RRIF are exempt from Form 8621, and you skip the form when all your PFICs total $25,000 or less ($50,000 joint) at year end and you didn't sell or get an excess distribution.</p>""",
    secs=[
        ("What makes a fund a PFIC", """
<p>A foreign corporation is a PFIC if at least 75% of its income is passive (interest, dividends, gains) or at least 50% of its assets produce passive income. A pooled investment fund meets that test almost by design. Most Canadian mutual funds and ETFs, whether set up as a corporation or a trust, are treated as foreign corporations for US tax purposes, so they are generally PFICs.</p>
<p>Not PFICs: shares of ordinary operating companies (a Canadian bank, railway or grocer), GICs and bank deposits, and funds organized in the US, such as US-listed ETFs.</p>
<p class="note">Holding US-listed funds instead has its own Canadian tax and estate consequences. That is a decision for you and an advisor, not a tax-form question.</p>"""),
        ("How a PFIC is taxed", """
<h3>Default: the excess distribution rules (section 1291)</h3>
<p>If you make no election, nothing happens while you simply hold the fund and receive normal distributions. But when you sell, or receive a distribution larger than 125% of the average of the previous three years, the gain or the excess is spread over the years you held the fund. Each earlier year's share is taxed at that year's highest US rate (37% for recent years) plus interest, as if you had paid late. Gains under these rules are ordinary income, not capital gains.</p>
<h3>Mark-to-market election</h3>
<p>For funds that trade on a qualifying exchange, you can elect to report each year's rise in value as ordinary income. Declines are deductible only up to the gains you reported before. It costs tax every year but avoids the interest charge.</p>
<h3>Qualified electing fund (QEF) election</h3>
<p>If the fund publishes a PFIC Annual Information Statement, you can elect to report your share of its ordinary earnings and capital gains each year, keeping capital gain treatment. Some Canadian fund companies publish these statements; check your fund's website.</p>"""),
        ("When you file Form 8621", """
<p>Generally one Form 8621 per fund, per year. You can skip it for a fund taxed under the default rules when all of these are true:</p>
<ul>
<li>The value of all your PFIC holdings together is $25,000 or less on December 31 ($50,000 or less on a joint return).</li>
<li>You didn't sell any of that fund during the year.</li>
<li>You didn't receive an excess distribution from it.</li>
</ul>
<p>Funds held in an RRSP or RRIF don't need Form 8621 at all: the PFIC rules except funds held through an arrangement treated as a foreign pension fund under a tax treaty. Funds inside a TFSA, FHSA or RESP get no such exception.</p>"""),
        ("Where PFICs show up on your slips", lines([
    ("T3", "Distributions from a mutual fund trust or ETF", "Box 49, 23, 21 and others", "PFIC review", "t"),
    ("T5", "Box 18: capital gains dividends", "Usually from a mutual fund corporation", "PFIC review", "t"),
    ("T5008", "Sales of fund units", "Sale proceeds and cost", "1291 gain or MTM", "t"),
], head=("Slip", "What it means"))),
    ],
    lou_html=lou("Funds in Lou", """<ul>
<li>Lou flags T3 slips and fund distributions instead of treating them as ordinary dividends.</li>
<li>In the funds section you choose how each fund is treated: the default rules, mark-to-market, or QEF. Lou computes the tax and interest and fills Form 8621.</li>
<li>Lou applies the $25,000 and RRSP/RRIF exceptions when they fit.</li>
<li>A few cases are flagged for a professional instead of guessed: holdings from before 1987, green card holders who bought before becoming US persons, and QEF purging elections.</li>
</ul>"""),
    srcs=("i8621",),
    rel=("tfsa", "rrsp-rrif", "fhsa-resp", "form-8938", "catch-up-filing"),
))

# ---------------------------------------------------------------- CPP / OAS
PAGES.append(dict(
    slug="cpp-oas",
    title="CPP, QPP and OAS on a US tax return for Americans in Canada · Lou",
    h1="CPP, QPP and OAS on your US return",
    description="How CPP and QPP contributions and CPP, QPP and OAS benefits are treated on a US tax return for US citizens living in Canada, plus US Social Security in Canada.",
    lede="Contributions are settled law. Benefits involve a treaty position most professionals take, with one honest caveat.",
    short="""<p><strong>Contributions</strong> (T4 boxes 16 and 17) are not deductible on your US return and don't count toward the foreign tax credit. If you are self-employed, you pay into CPP or QPP instead of US self-employment tax.</p>
<p><strong>Benefits</strong> (T4A(P), T4A(OAS)): most cross-border professionals treat them as taxable only in Canada under Article XVIII(5) of the tax treaty. The treaty wording doesn't spell this out for US citizens who live in Canada, so the position isn't airtight. <strong>US Social Security</strong> paid to a US citizen who lives in Canada is exempt from US tax.</p>""",
    secs=[
        ("Contributions: CPP, QPP and EI", """
<p>CPP and QPP contributions (T4 boxes 16, 16A, 17 and 17A) are social security taxes. The US has a social security agreement with Canada, and the IRS allows no credit or deduction for social security taxes paid to a country with such an agreement (Publication 514). EI premiums aren't income tax either. None of these reduce your US tax.</p>
<p>Your US return uses the T4's box 14 employment income; the contribution boxes are informational.</p>"""),
        ("Self-employed: no US self-employment tax", """
<p>Under the US-Canada social security agreement, a self-employed person living in Canada is covered only by the Canadian system. You pay CPP or QPP on your business income in Canada and don't pay US self-employment tax. Attach a certificate of coverage, which you request from the CRA (Quebec residents: Retraite Qu&eacute;bec), and write "Exempt, see attached statement" on Schedule 2.</p>
<p>One side effect: income exempt from US self-employment tax this way doesn't count as earned income for the refundable part of the US child tax credit.</p>"""),
        ("Benefits: the treaty position", """
<p>Article XVIII(5) of the treaty gives the country where a person lives the right to tax social security benefits paid by the other country. It is also one of the provisions the US agreed to honour even for its own citizens (an exception to the treaty's "saving clause").</p>
<p>Most cross-border professionals read this to mean that CPP, QPP and OAS paid to a US citizen living in Canada are taxable only in Canada, and they leave the benefits off US income. An earlier version of the treaty said so expressly for US citizens; the wording was changed in 1997, and the current text speaks of benefits paid to a resident of the other country. The IRS has not issued guidance on this exact case. That is why the position is common but not airtight.</p>
<p>If you include the benefits instead, the Canadian tax on them counts toward your <a href="/guides/foreign-tax-credit/">foreign tax credit</a>, and many people end up owing little or no US tax on them either way.</p>
<p><strong>Form 8833.</strong> Treaty positions on social security and pensions are exempt from the Form 8833 disclosure requirement (Treasury regulation 301.6114-1(c)(1)(iv)). Some filers attach it anyway, to show the position openly.</p>"""),
        ("US Social Security while living in Canada", """
<p>If you are a US citizen living in Canada and receive US Social Security, IRS Publication 915 says the benefits are exempt from US tax. Canada taxes them instead, with 15% of the benefit exempt from Canadian tax.</p>"""),
        ("FBAR and Form 8938", """
<p>CPP, QPP and OAS are government benefits, not accounts. They don't go on the <a href="/guides/fbar/">FBAR</a>, and the Form 8938 instructions exclude foreign social security from reporting.</p>"""),
    ],
    lou_html=lou("CPP and OAS in Lou", """<ul>
<li>Lou reads T4A(P) and T4A(OAS) slips. By default it treats the benefits as taxable only in Canada and includes Form 8833 to disclose the position.</li>
<li>One switch includes them in US income instead, with the Canadian tax on them counted for the foreign tax credit.</li>
<li>T4 contribution boxes are shown but never deducted or credited. Self-employed filers get the "Exempt, see attached statement" entry and a reminder to attach the certificate of coverage.</li>
</ul>"""),
    srcs=("treaty", "p514", "p915", "reg6114", "i8938"),
    rel=("foreign-tax-credit", "rrsp-rrif", "fbar", "catch-up-filing"),
))

# ---------------------------------------------------------------- FTC
PAGES.append(dict(
    slug="foreign-tax-credit",
    title="Foreign tax credit (Form 1116) for Americans in Canada · Lou",
    h1="The foreign tax credit, for Americans in Canada",
    description="How Form 1116 lets Canadian tax offset US tax for Americans in Canada: which tax counts, categories, carryovers, and how it compares with the foreign earned income exclusion.",
    lede="Why most Americans in Canada owe nothing to the IRS, and the few places where they do.",
    short="""<p>Form 1116 lets you subtract the Canadian income tax you owe on Canadian income from the US tax on that same income. Because Canadian tax is usually higher, it often brings US tax to zero, and unused credit carries forward for up to 10 years.</p>
<p>Use your <strong>actual Canadian tax for the year</strong> from your T1 or Notice of Assessment, not the amount withheld on your slips. CPP, QPP and EI don't count.</p>""",
    secs=[
        ("How the credit works", """
<p>You report your worldwide income on Form 1040, then claim a credit for foreign income tax on Form 1116. The credit is limited to the US tax on your foreign income, figured separately for each category of income:</p>
""" + lines([
    ("G", "General category", "Wages, self-employment, pensions, RRSP and RRIF withdrawals", "Form 1116 #1", "t"),
    ("P", "Passive category", "Interest, dividends, most investment gains", "Form 1116 #2", "t"),
], head=("Category", "Typical Canadian income")) + """
<p>Unused Canadian tax in a category carries back one year, then forward up to 10 years, for use against future US tax in the same category.</p>"""),
        ("Which Canadian tax counts", """
<ul>
<li><strong>Your actual liability for the year.</strong> Federal and provincial income tax from your T1 (or Notice of Assessment if CRA changed it). Withholding on slips (T4 box 22 and similar) is just a prepayment; a refund means you owed less.</li>
<li><strong>Not CPP, QPP or EI.</strong> These are social security levies, not income tax. See <a href="/guides/cpp-oas/">CPP, QPP and OAS</a>.</li>
<li><strong>Not tax on income the US doesn't tax.</strong> If you exclude wages with Form 2555 or leave treaty-exempt benefits off your return, the Canadian tax on that income can't be credited.</li>
</ul>
<p>Canadian tax is split between categories in proportion to the income Canada taxed. Lou does this with Canada's own taxable amounts, including the dividend gross-up.</p>"""),
        ("Where you can still owe US tax", """
<ul>
<li>Income Canada doesn't tax but the US does: TFSA and FHSA earnings, Home Buyers' Plan and Lifelong Learning Plan withdrawals, sometimes the gain on selling a home.</li>
<li>Passive income with little Canadian tax on it, such as Canadian dividends taxed lightly thanks to the dividend tax credit.</li>
<li>PFIC tax and interest on Canadian funds, which the credit can't reduce in the usual way.</li>
</ul>"""),
        ("Foreign tax credit or foreign earned income exclusion?", """
<p>Form 2555 lets you exclude foreign wages up to a yearly limit ($130,000 for 2025, $126,500 for 2024, $120,000 for 2023) instead of crediting the tax on them. In Canada, the credit is often the better choice:</p>
<ul>
<li>Canadian tax on wages is usually high enough to wipe out the US tax anyway, and the leftover credit carries forward.</li>
<li>If you file Form 2555, you can't claim the refundable part of the child tax credit. With the credit, families can sometimes receive it.</li>
<li>The exclusion only covers earned income, and if you claim it and later revoke it, you generally can't claim it again for five years without IRS approval.</li>
</ul>
<p>It depends on your numbers, which is why Lou runs both.</p>"""),
    ],
    lou_html=lou("The credit in Lou", """<ul>
<li>Lou takes your Canadian tax from your T1 or Notice of Assessment, splits it by category, and fills one Form 1116 per category (plus Schedule B for carryovers and the AMT versions when needed).</li>
<li>It compares the foreign tax credit with the foreign earned income exclusion and shows you the difference.</li>
<li>Carryovers from one year flow into the next when you prepare several years in Lou.</li>
</ul>"""),
    srcs=("i1116", "p514", "p54"),
    rel=("cpp-oas", "exchange-rates", "tfsa", "rrsp-rrif", "catch-up-filing"),
))

# ---------------------------------------------------------------- FX
PAGES.append(dict(
    slug="exchange-rates",
    title="CAD to USD exchange rates for a US tax return: which rate goes where · Lou",
    h1="Which CAD to USD rate goes where",
    description="The IRS yearly average CAD rate for 2023 to 2025, daily rates for sales, and Treasury December 31 rates for the FBAR and Form 8938, with how to convert.",
    lede="Your US return needs three different exchange rates. Using the wrong one is one of the most common mistakes.",
    short="""<p><strong>Income</strong> (wages, interest, dividends, pensions): the IRS yearly average. <strong>Sales</strong> of investments: the rate on the day you bought and the day you sold. <strong>Account values</strong> on the FBAR and Form 8938: the US Treasury rate for December 31.</p>
<p>The rates are Canadian dollars per US dollar, so you <strong>divide</strong> the Canadian amount by the rate.</p>""",
    secs=[
        ("IRS yearly average rates", """
<p>The IRS says it has no official exchange rate and generally accepts any posted rate you use consistently. Its published yearly averages are the usual choice for income received through the year:</p>
""" + lines([
    ("25", "2025", "", "1.398", "n"),
    ("24", "2024", "", "1.370", "n"),
    ("23", "2023", "", "1.350", "n"),
    ("22", "2022", "", "1.301", "n"),
    ("21", "2021", "", "1.254", "n"),
], head=("Tax year", "CAD per 1 USD")) + """
<p class="note">Example: T4 box 14 of CA$84,500 in 2025 is $84,500 &divide; 1.398 = $60,443.49 on your US return.</p>
<p>Canadian income tax claimed for the foreign tax credit on the accrual basis also uses the yearly average for the year it relates to, as long as it is paid within two years.</p>"""),
        ("Daily rates for sales", """
<p>When you sell shares or fund units, your US gain is the US dollar value of what you received minus the US dollar value of what you paid. Convert the cost at the rate on the purchase date and the proceeds at the rate on the sale date. A sale that lost money in Canadian dollars can be a gain in US dollars, and the other way around.</p>"""),
        ("Treasury December 31 rates for account reports", """
<p>The FBAR instructions require the Treasury's Reporting Rate of Exchange for the last day of the calendar year, and Form 8938 uses the same rate for year-end values.</p>
""" + lines([
    ("25", "December 31, 2025", "", "1.369", "n"),
    ("24", "December 31, 2024", "", "1.438", "n"),
    ("23", "December 31, 2023", "", "1.326", "n"),
    ("22", "December 31, 2022", "", "1.354", "n"),
    ("21", "December 31, 2021", "", "1.277", "n"),
    ("20", "December 31, 2020", "", "1.275", "n"),
], head=("Date", "CAD per 1 USD"))),
    ],
    lou_html=lou("Exchange rates in Lou", """<ul>
<li>Lou applies the right rate for each line automatically and shows the rate next to every converted number.</li>
<li>Sales use daily Bank of Canada rates for the purchase and sale dates, bundled with Lou so nothing is looked up online.</li>
<li>FBAR and Form 8938 values use the Treasury December 31 rate, rounded the way the FBAR instructions require.</li>
</ul>"""),
    srcs=("irsfx", "treasfx", "fbarinst", "i8938", "i1116"),
    rel=("fbar", "form-8938", "foreign-tax-credit", "tfsa"),
))
