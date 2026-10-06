// The email that carries a key. Sent through the Hostinger mailbox (SMTP); replies go to REPLY_TO (info@bigtimedesign.ca).
import nodemailer from 'nodemailer';

export function mailer(env) {
  const port = Number(env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  const address = env.MAIL_FROM ?? env.SMTP_USER;
  return {
    async sendKey(to, key, years, siteUrl) {
      const range = years.length > 1 ? `${years[0]} to ${years.at(-1)}` : String(years[0]);
      const link = `${siteUrl}/app/#key=${key}`;
      await transport.sendMail({
        from: `Lou <${address}>`, to, replyTo: env.REPLY_TO ?? address,
        subject: 'Your Lou key',
        text: [
          `Thanks for using Lou. Your key unlocks your ${range} US returns.`,
          '', 'Open Lou with your key already added:', link,
          '', 'Or paste this key into Lou (on the Your US return step, "I already have a key"):', key,
          '', 'Keep this email. The key also travels inside any backup file you save from Lou.',
          '', 'Lou is software, not a tax preparer. Review your return before you file it.',
          `Lost this email later? Use "Find my key" at ${siteUrl}/recover/`,
        ].join('\n'),
        html: `<p>Thanks for using Lou. Your key unlocks your <strong>${range}</strong> US returns.</p>
<p><a href="${link}" style="background:#14161a;color:#fff;padding:12px 18px;text-decoration:none;font-weight:700">Open Lou with your key</a></p>
<p>Or paste this key into Lou (on the Your US return step, &ldquo;I already have a key&rdquo;):</p>
<p style="font-family:monospace;word-break:break-all;background:#f3f1ea;padding:10px">${key}</p>
<p>Keep this email. The key also travels inside any backup file you save from Lou.</p>
<p style="color:#555;font-size:13px">Lou is software, not a tax preparer. Review your return before you file it.<br>Lost this email later? Use &ldquo;Find my key&rdquo; at <a href="${siteUrl}/recover/">${siteUrl}/recover/</a></p>`,
      });
    },
  };
}
