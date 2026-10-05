# Security policy

Lou handles sensitive tax information, so its main promise is structural: everything runs in the user's browser, and
the production build refuses connections to any other origin (see the Content-Security-Policy in `app/vite.config.ts`).

## Report a problem

Email **info@bigtimedesign.ca** with "Lou security" in the subject. Please include steps to reproduce and the browser.
Do not post details publicly until we have had a chance to fix it. We aim to reply within 5 business days.

Things we especially want to hear about:

- Any way tax data could leave the device (a network request, a log, a third-party script).
- A way to read another person's saved data from the same browser, or to break the password on a `.lou` backup.
- Cross-site scripting or anything that weakens the Content-Security-Policy.

A wrong tax number is not a security issue. Please open a regular issue with the tax year and the official source.

## Supported versions

Only the latest deployed version at https://lou.bigtimedesign.ca.
