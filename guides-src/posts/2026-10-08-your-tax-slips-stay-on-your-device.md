---
title: Your tax slips never leave your device
slug: your-tax-slips-stay-on-your-device
date: 2026-10-08
description: Lou reads your T4s and T5s, works out your US return and fills the IRS forms, all inside your browser. Here is what that means and how to check it.
summary: Lou does the reading, the math and the form filling on your own computer. Your slips, your Social Security number and your return are never sent to us, to a cloud service or to an AI.
tags: Privacy, How Lou works
---

A tax return is one of the most personal documents you own. It holds your income, your address, your account numbers and your Social Security number. So the first question we asked when we built Lou was where that information should live. Our answer: only on your device.

## What stays on your device

When you drop a slip into Lou, everything that happens next happens in your browser tab:

- **Reading.** PDFs are read with pdf.js. Photos and scans are read with Tesseract, an OCR engine that ships with Lou, including its language data.
- **The math.** The currency conversion, the foreign tax credit, the child credit and the rest of your US return are worked out on your computer.
- **The forms.** The official IRS PDFs are filled in with pdf-lib, also in your browser.

There is no Lou account, no upload step, no cloud text recognition and no AI service reading your documents. Lou is a set of static files. Once it has loaded, it can run without a network connection, and you can install it like an app.

## How you can check

You do not have to take our word for it. Two checks anyone can do:

1. Open your browser's developer tools, switch to the Network tab, and use Lou with a sample slip. You will see the page load, then nothing else.
2. Read the page's Content Security Policy. Lou tells your browser to refuse any connection to another site, so even a bug could not send your data out.

:::lou The one thing that does use a server
Payment. Lou is free to try, and a key for the final PDFs costs $49 CAD. A small server handles that payment and emails your key. It sees your email address and the payment, and never sees anything from your return. The tool itself does not talk to it.
:::

## Why this matters for Americans in Canada

If you live in Canada and file a US return, you hand over details of Canadian accounts as well as American ones: bank balances for the FBAR, RRSP and TFSA details for Form 8938. Many people in this position are also catching up on years they missed. That is exactly the kind of information you want to keep close.

Keeping it on your device also means you control the copies. You can save your work as a backup file, protect it with a password if you like, and delete it from your browser whenever you choose.

## What it costs us

Working this way is harder. It means shipping the text recognition engine and every IRS form with the app, and checking every number against official IRS tables ourselves. We think that is the right trade. If you want to see how Lou treats a particular slip or account, the [guides](/guides/) explain each one and link to the IRS and CRA sources.

Lou is software, not a tax preparer. You review the return and sign it yourself, and Lou includes a plain-language reminder to do so with every result.
