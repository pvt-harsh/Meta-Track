import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { Field, Modal } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { supabaseConfigured } from "../services/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function PasswordInput({ id, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-input">
      <input id={id} type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}><Icon name={show ? "eyeOff" : "eye"} size={16} /></button>
    </div>
  );
}

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" /><path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
);

export default function Login({ embedded = false, reason, onClose } = {}) {
  const { signInEmail, signUpEmail, signInGoogle, sendReset, recovery, updatePassword, dismissRecovery } = useAuth();
  const [mode, setMode] = useState("signin"); 
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null); 
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  function switchMode(m) { setMode(m); setErrors({}); setBanner(null); }

  async function submit(e) {
    e.preventDefault();
    const er = {};
    const email = f.email.trim();
    if (recovery) {
      if (f.password.length < 8) er.password = "Use at least 8 characters.";
      if (f.password !== f.confirm) er.confirm = "The two passwords don't match.";
    } else {
      if (!EMAIL_RE.test(email)) er.email = "Enter a valid email address.";
      if (mode !== "forgot" && f.password.length < (mode === "signup" ? 8 : 1)) er.password = mode === "signup" ? "Use at least 8 characters." : "Enter your password.";
      if (mode === "signup" && !f.name.trim()) er.name = "Tell us what to call you.";
    }
    setErrors(er); setBanner(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      if (recovery) { await updatePassword(f.password); dismissRecovery(); }
      else if (mode === "signin") await signInEmail(email, f.password);
      else if (mode === "signup") {
        const { needsConfirmation } = await signUpEmail(email, f.password, f.name.trim());
        if (needsConfirmation) { setBanner({ tone: "success", text: `We sent a confirmation link to ${email}. Open it to finish creating your account.` }); setMode("signin"); }
      } else { await sendReset(email); setBanner({ tone: "success", text: `If an account exists for ${email}, a reset link is on its way.` }); }
    } catch (err) { setBanner({ tone: "error", text: err.message }); }
    setBusy(false);
  }

  async function google() {
    setBusy(true); setBanner(null);
    try { await signInGoogle(); } catch (err) { setBanner({ tone: "error", text: err.message }); setBusy(false); }
  }

  const title = recovery ? "Set a new password" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back";
  const sub = recovery ? "Choose a password you haven't used before." : mode === "signup" ? "Save your watchlist, portfolio and alerts." : mode === "forgot" ? "We'll email you a link to set a new one." : "Sign in to continue to MetaTrack.";

  const card = (
      <div className={`auth-card ${embedded ? "auth-card-embedded" : ""}`}>
        {!embedded && <Logo size="lg" stacked tagline />}
        {!embedded && <h1>{title}</h1>}
        <p className="auth-sub">{sub}</p>

        {!supabaseConfigured && <div className="banner banner-warn" role="alert">Sign-in isn't configured for this deployment. Add the Supabase environment variables and redeploy.</div>}
        {banner && <div className={`banner banner-${banner.tone}`} role={banner.tone === "error" ? "alert" : "status"}>{banner.text}</div>}

        {!recovery && mode !== "forgot" && (
          <>
            <button type="button" className="btn btn-google" onClick={google} disabled={busy || !supabaseConfigured}><GoogleG />Continue with Google</button>
            <div className="auth-divider"><span>or</span></div>
          </>
        )}

        <form onSubmit={submit} noValidate>
          {mode === "signup" && !recovery && <Field label="Name" htmlFor="au-name" error={errors.name}><input id="au-name" value={f.name} onChange={set("name")} autoComplete="name" /></Field>}
          {!recovery && <Field label="Email" htmlFor="au-email" error={errors.email}><input id="au-email" type="email" inputMode="email" value={f.email} onChange={set("email")} autoComplete="email" /></Field>}
          {(recovery || mode !== "forgot") && (
            <Field label={recovery ? "New password" : "Password"} htmlFor="au-pw" error={errors.password} hint={mode === "signup" || recovery ? "At least 8 characters." : undefined}>
              <PasswordInput id="au-pw" value={f.password} onChange={set("password")} autoComplete={mode === "signin" && !recovery ? "current-password" : "new-password"} />
            </Field>
          )}
          {recovery && <Field label="Confirm password" htmlFor="au-confirm" error={errors.confirm}><PasswordInput id="au-confirm" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" /></Field>}
          {mode === "signin" && !recovery && <button type="button" className="link-btn auth-forgot" onClick={() => switchMode("forgot")}>Forgot password?</button>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !supabaseConfigured}>
            {busy ? "Please wait…" : recovery ? "Update password" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </button>
        </form>

        {!recovery && (
          <p className="auth-switch">
            {mode === "signin" ? <>New to MetaTrack? <button type="button" className="link-btn" onClick={() => switchMode("signup")}>Create an account</button></> :
              <>Already have an account? <button type="button" className="link-btn" onClick={() => switchMode("signin")}>Sign in</button></>}
          </p>
        )}
        {embedded ? (
          <>
            <button type="button" className="btn btn-ghost btn-block auth-guest" onClick={onClose}>Continue as guest</button>
          </>
        ) : !recovery && (
          <Link to="/dashboard" className="btn btn-ghost btn-block auth-guest">Continue as guest</Link>
        )}
        <small className="auth-privacy">We never see your Google password. Your portfolio data stays in your browser.</small>
      </div>
  );
  if (embedded) return <Modal title={title} eyebrow={reason ? "Account needed" : "Sign in"} onClose={onClose} width={440}>{reason && <p className="auth-reason">{reason}</p>}{card}</Modal>;
  return <div className="auth-page">{card}</div>;
}
