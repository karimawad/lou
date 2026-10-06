// "Find my key": sends the buyer's email to Lou's key server, which emails the key if a payment exists under it.
// The reply is always the same, so nobody can use this page to find out who has paid.
import '../fonts/fonts.css';
import './pages.css';

const form = document.getElementById('form') as HTMLFormElement;
const email = document.getElementById('email') as HTMLInputElement;
const go = document.getElementById('go') as HTMLButtonElement;
const result = document.getElementById('result')!;

const say = (tone: 'ok' | 'bad', text: string) => { result.innerHTML = `<p class="note ${tone}"></p>`; result.firstElementChild!.textContent = text; };

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { say('bad', 'Enter a full email address, like name@example.com.'); email.focus(); return; }
  go.disabled = true;
  try {
    const res = await fetch('/api/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: value }) });
    if (res.status === 429) say('bad', 'That was a lot of tries. Please wait an hour and try again.');
    else if (res.ok) say('ok', 'Done. If there is a payment under that email, your key is on its way. It can take a minute, and it may land in your spam folder.');
    else say('bad', 'Something went wrong on our side. Please try again in a few minutes, or email info@bigtimedesign.ca.');
  } catch {
    say('bad', 'We could not reach the server. Check your connection and try again.');
  } finally { go.disabled = false; }
});
