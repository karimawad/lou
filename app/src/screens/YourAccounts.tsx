// Step 6: the Canadian accounts and funds. These drive the FBAR, Form 8938 and (for funds) Form 8621, so they get their own step.
import { useApp } from '../state/context';
import { Arrow, Back } from '../ui/icons';
import { AccountsSection } from './AccountsSection';
import { FundsSection } from './FundsSection';

export function YourAccounts() {
  const { state, go } = useApp();
  const carried = [...state.accounts.filter((a) => a.carried).map((a) => a.institution || 'an account'),
    ...(state.pficFunds ?? []).filter((f) => f.carried).map((f) => f.name || 'a fund')];
  const ready = carried.length === 0 && (state.accounts.length > 0 || state.noAccounts);

  return (
    <div className="page">
      <div className="head">
        <p className="eyebrow">Step 6</p>
        <h1 id="main-heading" tabIndex={-1}>Your Canadian accounts</h1>
        <p className="lede">The US wants to know about Canadian bank and investment accounts, even when they earn nothing. Lou uses what you enter here to tell you
          whether you must file an FBAR (a separate online report to FinCEN) and Form 8938, and to fill Form 8621 for any mutual funds or ETFs. List every account in your name: bank, investment, RRSP, RRIF, TFSA, RESP and FHSA. Your monthly statements show the highest balance.</p>
      </div>

      <AccountsSection />

      <FundsSection />

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={() => go('questions')}><Back size={18} /> Back</button>
        <span className="spacer" />
        {!ready && <span className="small muted">{carried.length ? `Add this year's figures for ${carried.join(', ')}` : 'Add your accounts, or say you have none, to continue'}</span>}
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => go('results')}>
          See my US return <Arrow size={18} />
        </button>
      </div>
    </div>
  );
}
