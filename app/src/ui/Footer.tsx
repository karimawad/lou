import { Heart } from './icons';

const MAKER = 'https://bigtimedesign.ca';
const SOURCE = 'https://github.com/karimawad/lou';
declare const __APP_VERSION__: string;

/** Site footer: who made Lou, the legal pages, the source and a way to reach us. Links open in a new tab so a return in progress stays put. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer no-print">
      <p className="site-footer-made">
        Made in Toronto with <Heart size={14} className="site-footer-heart" aria-label="love" /> by{' '}
        <a href={MAKER} target="_blank" rel="noopener">Big Time</a>
      </p>
      <nav aria-label="About Lou" className="site-footer-links">
        <a href="/legal/terms.html" target="_blank" rel="noopener">Terms</a>
        <a href="/legal/privacy.html" target="_blank" rel="noopener">Privacy</a>
        <a href="/legal/notices.html" target="_blank" rel="noopener">Notices</a>
        <a href={SOURCE} target="_blank" rel="noopener">Source code</a>
        <a href={`${SOURCE}/issues`} target="_blank" rel="noopener">Report a problem</a>
        <a href={`${SOURCE}/releases`} target="_blank" rel="noopener">Version {__APP_VERSION__}</a>
        <a href="mailto:info@bigtimedesign.ca">Contact</a>
      </nav>
      <p className="site-footer-fine">
        Lou is software, not a tax preparer. You check and sign your own return. Not affiliated with the IRS or the CRA.
        {' '}&copy; {year} Big Time Design and Communication Inc.
      </p>
    </footer>
  );
}
