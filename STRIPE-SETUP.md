# Setting up payments (Stripe) for Lou

Lou sells one product: a **key** for $49 CAD that unlocks the filled forms and guides for tax years 2023, 2024 and 2025.
Everything up to the results screen is free. A key is a signed piece of text that Lou checks on the user's device, so it
works offline. The only server is a small key server on your Hostinger VPS (see `DEPLOY.md`, "Key server").

Stripe now calls test mode a **sandbox**. Ideally set everything up in a sandbox first, then repeat in live mode. (A live Payment Link was created first for Lou; to test it
without a sandbox, make a Stripe coupon that is 100% off and use it at checkout, or pay with a real card and refund it.)
Test cards: `4242 4242 4242 4242`, any future expiry, any CVC, any postal code.

## 1. Account (once)

1. Create an account at dashboard.stripe.com. Business: Big Time Design and Communication Inc., Canada.
2. Add the bank account (CAD) payouts go to. Complete the identity checks Stripe asks for. Live payments stay off until this is done.

## 2. Tax: charging HST (decided)

Lou charges **$49 CAD plus tax**, so the buyer sees the tax added at checkout. To charge GST/HST you must be registered with the CRA (you can register
voluntarily). HST is 13% in Ontario and differs by province (GST 5% plus provincial tax elsewhere); Stripe works out the rate from the buyer's address.

1. Dashboard, **Settings**, **Tax** (or "Stripe Tax"), turn on **Stripe Tax**. Set your business address as the origin (Toronto, Ontario).
2. **Registrations**, add **Canada, GST/HST** with your GST/HST number. Add other provincial registrations (for example Quebec QST, BC/Saskatchewan/Manitoba PST)
   only if you are registered for them. Stripe collects only in places you add. Your accountant can say which apply to you.
3. On the product (step 3 below), set the **Tax category** to the closest software category. Lou is web software delivered in the browser, so Stripe's
   "software as a service" category is the usual choice. Confirm with your accountant.
4. On the **price**, set **Tax behavior** to **Exclusive** (tax is added on top of $49.00). Stripe locks this once the price is used. If Lou's existing price was made
   with another setting, make a new $49.00 CAD price with Exclusive tax and a new Payment Link, then update `LICENSE_PRICES` on the server and `PAYMENT_LINK` in the app (tell me the new ids and I will).
5. On the **Payment Link**, turn on **Collect tax automatically** (Stripe then also asks for the buyer's billing address).

Refunds from the Stripe dashboard return the tax proportionally. The key server does not care about tax: it only checks that the payment is paid and which price it was for.

## 3. The product (Test mode, then Live mode)

1. Product catalog, **Add product**. Name: `Lou key: tax years 2023 to 2025`. Description: `One payment unlocks the filled IRS forms and guides for your 2023, 2024 and 2025 US returns.`
2. Pricing: **One-off**, **$49.00 CAD**.
3. Save, then copy the **Price ID** (starts with `price_`). It goes into `LICENSE_PRICES` on the server.
   *(Lou's live price: `price_1UNOXYLotME1ZCVsfaF3bO8f`, already in `server/.env.example`.)*

When you add tax year 2026 later: make a second product and price, and add it to `LICENSE_PRICES`, for example
`{"price_AAA":[2023,2024,2025],"price_BBB":[2026]}`. Old keys keep working.

## 4. The Payment Link

1. Payment links, **Create payment link**. Choose the product above, quantity fixed at 1.
2. Under **After payment**, choose **Don't show confirmation page** and set the redirect to exactly:
   `https://lou.bigtimedesign.ca/thanks/?session_id={CHECKOUT_SESSION_ID}`
   (Stripe replaces `{CHECKOUT_SESSION_ID}` with the real id. Keep the braces.)
3. Create the link and copy it (it looks like `https://buy.stripe.com/...`).
4. Paste it into `app/src/license/config.ts` as `PAYMENT_LINK`, then release. Until it is set, the app shows "Buying opens soon".
   *(Already done for the live link `https://buy.stripe.com/3cIdRadnc9hg2HS8bi2Nq00`.)*
5. Settings, Customer emails: turn on **Successful payments** so buyers also get Stripe's receipt.

## 5. An API key for the key server

The key server only needs to look up a Checkout Session ("was this paid, and for which price?"), so give it as little power as Stripe allows.

1. Dashboard, **Developers**, **API keys** (dashboard.stripe.com/apikeys). Make sure you are in the mode you are setting up (sandbox or live).
2. Click **Create restricted key**. (Stripe now also shows **Create secret key** on this page; see the note below.)
3. Name it `lou-key-server`. Start from zero permissions and set **Checkout Sessions** to **Read**. Leave everything else on **None**.
4. Click **Create key**, complete the two-step verification Stripe sends you, then **click the key value to copy it**. In live mode Stripe
   shows it once and you cannot reveal it again, so paste it straight into `/etc/lou-license.env` as `STRIPE_SECRET_KEY` (it starts with `rk_live_` or `rk_test_`). Add a note saying where you saved it, then **Done**.

If Stripe will only give you a **secret key** (`sk_live_...`, from **Create secret key**), Lou's server works with that too, but it can do anything in your account. In that case
also lock it to your VPS: **Developers**, **Access policies**, **Create policy**, choose **IP addresses**, enter the VPS's public IP, then on the API keys page open the key's menu (the three dots),
**Manage access policy**, pick that policy, **Save**. Never put either key in git or in the app.

## 6. The webhook (Stripe calls this an "event destination")

1. Open the **Webhooks** tab in Workbench (dashboard.stripe.com/webhooks) and click **Create an event destination**.
2. Events from: **Your account**.
3. API version: the default is fine. Payload style: **Snapshot** (the normal kind, not "thin").
4. Select events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Choose nothing else.
5. **Continue**, then pick **Webhook endpoint** as the destination type, **Continue**.
6. Endpoint URL: `https://lou.bigtimedesign.ca/api/webhook`. Add a description such as "Lou key emails". Create it.
7. On the destination's page, under the signing secret, click **Reveal secret** and copy it (starts with `whsec_`). It goes into `/etc/lou-license.env` as `STRIPE_WEBHOOK_SECRET`.
   Each mode (sandbox and live) has its own destination and its own secret.

The destination's **Event deliveries** tab shows every attempt (Delivered, Pending, Failed) and has a **Resend** button. If the VPS is down when someone pays, Stripe keeps retrying for up to three days in live mode, and the buyer's key is emailed when the server answers.

## 7. Email (Hostinger mailbox)

The server sends keys from `karim@bigtimedesign.ca` using that mailbox's password (`SMTP_PASS`); replies go to `info@bigtimedesign.ca`. Settings are in `server/.env.example`
(`smtp.hostinger.com`, port 465). In hPanel, Emails, check that SPF, DKIM and DMARC for bigtimedesign.ca show as set up (Hostinger
adds them automatically when your DNS is at Hostinger). Send a test to a Gmail address and to mail-tester.com to see that it lands in the inbox.

## 8. Test the whole flow

1. Put the test values (`price_`, `rk_test_`, `whsec_` for the test webhook) into `/etc/lou-license.env`, restart the service, release the app with the **test** Payment Link.
2. In Lou, get to the results screen, click **Buy a key**, pay with the test card.
3. You should land on a Lou page that says "Opening Lou with your key", then on the results screen with everything unlocked, and an email with the key should arrive.
4. Open a private window, use **Find my key** with the email you paid with: you should get the same key by email.

## 9. Going live

Repeat steps 3 to 6 in **Live mode** (new price, link, restricted key and webhook). Put the live values in `/etc/lou-license.env`,
restart `lou-license`, put the live Payment Link in `config.ts`, release. Make one real purchase yourself and refund it from the dashboard to check.

## Day to day

- **Refund:** Stripe dashboard, Payments, the payment, **Refund**. The buyer keeps a working key (it cannot be switched off), as the Terms say.
- **Gift or reviewer key:** `node server/mint-cli.mjs <private-key-file> --years 2023,2024,2025`.
- **Lost signing key:** keys already sold keep working. Make a new pair with `node server/keygen.mjs`, add its public key to `PUBLIC_KEYS` in
  `app/src/license/key.ts` as `k2`, set `LICENSE_KID=k2` and release. Keep the private key backed up (a password manager is fine).
