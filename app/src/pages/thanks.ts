// The page Stripe sends buyers to: /thanks/?session_id=cs_... It asks Lou's key server for the key and opens the app with it.
// The key goes in the address after "#", which browsers never send to any server. If the server is down, the key
// is also emailed (Stripe tells the server about every payment), so the buyer is never left without it.
import '../fonts/fonts.css';
import './pages.css';

const title = document.getElementById('title')!;
const msg = document.getElementById('msg')!;
const extra = document.getElementById('extra')!;

function show(heading: string, text: string, tone: 'ok' | 'bad', links: string) {
  title.textContent = heading;
  msg.innerHTML = `<span class="note ${tone}" style="display:block"></span>`;
  (msg.firstElementChild as HTMLElement).textContent = text;
  extra.innerHTML = links;
}

async function run() {
  const id = new URLSearchParams(location.search).get('session_id');
  if (!id) return show('Nothing to claim here', 'This page needs the link Stripe sends after a payment.', 'bad', '<p><a href="/recover/">Find my key by email</a> &middot; <a href="/app/">Open Lou</a></p>');
  try {
    const res = await fetch('/api/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: id }) });
    if (res.ok) {
      const { key } = (await res.json()) as { key: string };
      msg.innerHTML = '<span class="spin" aria-hidden="true"></span>Opening Lou with your key.';
      extra.innerHTML = '<p class="muted">Not opening? <a id="open" href="#">Open Lou</a></p>';
      const target = `/app/#key=${key}`;
      (document.getElementById('open') as HTMLAnchorElement).href = target;
      location.replace(target);
      return;
    }
    if (res.status === 402 || res.status === 404 || res.status === 400) {
      return show('We could not find that payment', 'This link does not match a completed payment. If you were charged, email info@bigtimedesign.ca and we will sort it out.', 'bad', '<p><a href="/recover/">Find my key by email</a></p>');
    }
    throw new Error(String(res.status));
  } catch {
    show('Payment received', 'We could not fetch your key just now. It is being emailed to the address you paid with (check your spam folder). You can also ask for it again in a few minutes.', 'ok', '<p><a href="/recover/">Find my key by email</a></p>');
  }
}

void run();
