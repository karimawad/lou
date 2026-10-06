// "Report a problem": sends the message to Lou's key server, which emails it to the support inbox. Nothing is stored.
// Kept on its own page (not inside the app) so the app itself never makes a network call and nobody pastes tax details into it by accident.
import '../fonts/fonts.css';
import './pages.css';

const form = document.getElementById('form') as HTMLFormElement;
const go = document.getElementById('go') as HTMLButtonElement;
const result = document.getElementById('result')!;
const count = document.getElementById('count')!;
const loadedAt = Date.now();

const fields = ['email', 'subject', 'message'] as const;
type Field = (typeof fields)[number];
const input = (f: Field) => document.getElementById(f) as HTMLInputElement | HTMLTextAreaElement;
const errorEl = (f: Field) => document.getElementById(`${f}-err`)!;

const MESSAGE_MAX = 4000;
const params = new URLSearchParams(location.search);
if (params.get('subject')) input('subject').value = params.get('subject')!.slice(0, 120);

function setError(f: Field, text: string | null) {
  const el = errorEl(f);
  el.textContent = text ?? '';
  el.hidden = !text;
  input(f).setAttribute('aria-invalid', text ? 'true' : 'false');
}

function validate(): Partial<Record<Field, string>> {
  const errs: Partial<Record<Field, string>> = {};
  if (!/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(input('email').value.trim())) errs.email = 'Enter a full email address, like name@example.com.';
  const s = input('subject').value.trim();
  if (s.length < 3) errs.subject = 'Give it a short subject (at least 3 characters).';
  const m = input('message').value.trim();
  if (m.length < 10) errs.message = 'Tell us a little more (at least 10 characters).';
  return errs;
}

// Clear an error as soon as the person fixes the field; check a field when they leave it.
for (const f of fields) {
  input(f).addEventListener('input', () => { if (!errorEl(f).hidden) setError(f, validate()[f] ?? null); });
  input(f).addEventListener('blur', () => { if (input(f).value) setError(f, validate()[f] ?? null); });
}
input('message').addEventListener('input', () => {
  const left = MESSAGE_MAX - input('message').value.length;
  count.textContent = left < 400 ? `${left} characters left.` : '';
});

const say = (tone: 'ok' | 'bad', text: string) => { result.innerHTML = `<p class="note ${tone}"></p>`; result.firstElementChild!.textContent = text; };

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  result.innerHTML = '';
  const errs = validate();
  for (const f of fields) setError(f, errs[f] ?? null);
  const first = fields.find((f) => errs[f]);
  if (first) { input(first).focus(); return; }

  go.disabled = true;
  go.textContent = 'Sending…';
  try {
    const res = await fetch('/api/support', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input('email').value.trim(), subject: input('subject').value.trim(), message: input('message').value.trim(),
        website: (document.getElementById('website') as HTMLInputElement).value, ms: Date.now() - loadedAt,
      }),
    });
    if (res.ok) {
      const sentTo = input('email').value.trim();
      form.hidden = true;
      say('ok', `Thank you. Your message is on its way. We will reply to ${sentTo}. If you do not hear back, check your spam folder.`);
      result.focus?.();
      return;
    }
    if (res.status === 400) {
      const { errors } = (await res.json()) as { errors?: Partial<Record<Field, string>> };
      for (const f of fields) setError(f, errors?.[f] ?? null);
      const bad = fields.find((f) => errors?.[f]);
      if (bad) input(bad).focus();
      return;
    }
    if (res.status === 429) say('bad', 'You have sent a few messages already. Please wait a while and try again, or email info@bigtimedesign.ca.');
    else say('bad', 'We could not send your message. Please try again in a few minutes, or email info@bigtimedesign.ca.');
  } catch {
    say('bad', 'We could not reach the server. Check your connection and try again, or email info@bigtimedesign.ca.');
  } finally {
    go.disabled = false;
    go.textContent = 'Send';
  }
});
