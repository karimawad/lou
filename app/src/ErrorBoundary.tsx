import { Component, type ReactNode } from 'react';
import { KEY, clearAllData } from './state/store';

/**
 * The last safety net: if any screen throws while drawing, show a calm explanation and a way forward instead of a blank page.
 * Nothing about the error is sent anywhere (Lou makes no network calls).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; confirming: boolean }> {
  state = { failed: false, confirming: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: unknown) { console.error('Lou hit a problem:', error); }

  private clearAndRestart = async () => {
    // A paid key is not tax data: keep it, as "Clear my data" does.
    let licenses: string[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { licenses?: unknown } | null;
      if (Array.isArray(saved?.licenses)) licenses = saved.licenses.filter((k): k is string => typeof k === 'string');
    } catch { /* damaged: nothing to keep */ }
    try { await clearAllData(); } catch { /* storage unavailable: reloading is still the best we can do */ }
    try { if (licenses.length) localStorage.setItem(KEY, JSON.stringify({ version: 1, licenses })); } catch { /* ignore */ }
    location.replace('/app/');
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="main" role="alert" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="page">
          <div className="head">
            <p className="eyebrow">Something went wrong</p>
            <h1>Lou hit a problem</h1>
            <p className="lede">Nothing you entered was sent anywhere, and it is still saved on this device. Reloading fixes it most of the time.</p>
          </div>
          <div className="actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload Lou</button>
            <a className="btn btn-secondary" href="/support/" target="_blank" rel="noopener">Report a problem</a>
          </div>
          <section className="section">
            <div className="section-head">
              <h2>Still stuck?</h2>
              <p>If it keeps happening, the saved data on this device may be damaged. You can clear it and start over. This removes what Lou saved in this browser (your key stays), so only do this if reloading did not help.</p>
            </div>
            {this.state.confirming ? (
              <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'center' }}>
                <button type="button" className="linkish danger" onClick={() => void this.clearAndRestart()}>Yes, clear it and start over</button>
                <button type="button" className="linkish" onClick={() => this.setState({ confirming: false })}>Keep it</button>
              </div>
            ) : (
              <button type="button" className="linkish danger" onClick={() => this.setState({ confirming: true })}>Clear saved data and start over</button>
            )}
          </section>
        </div>
      </main>
    );
  }
}
