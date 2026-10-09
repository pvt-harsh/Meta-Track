import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "../services/supabase";
import { FEATURES } from "../lib/features";

const Ctx = createContext(null);

export function friendlyAuthError(error) {
  const msg = String(error?.message ?? "").toLowerCase();
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("invalid login")) return "That email and password don't match.";
  if (msg.includes("email not confirmed")) return "Confirm your email first — check your inbox for the link.";
  if (msg.includes("already registered") || msg.includes("already been registered")) return "An account with this email already exists. Try signing in.";
  if (msg.includes("rate limit") || msg.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (msg.includes("password") && msg.includes("least")) return "Password is too short. Use at least 8 characters.";
  if (msg.includes("same password") || msg.includes("different from the old")) return "Choose a password different from your current one.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Can't reach the server. Check your connection and retry.";
  if (msg.includes("provider is not enabled") || msg.includes("unsupported provider")) return "This sign-in method isn't enabled yet.";
  return "Couldn't complete that request. Please try again.";
}

function friendlyProfileError(error) {
  const msg = String(error?.message ?? "").toLowerCase();
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("permission denied")) {
    return "The database blocked this change — the profiles table policy is missing. Run supabase/migrations/profiles.sql in your Supabase SQL editor, then try again.";
  }
  if (msg.includes("does not exist") || msg.includes("relation")) {
    return "The profiles table doesn't exist in your database yet. Run supabase/migrations/profiles.sql in your Supabase SQL editor, then try again.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Can't reach the server. Check your connection and retry.";
  return "Couldn't save your profile. Please try again.";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [authRequest, setAuthRequest] = useState(null);

  const loadProfile = useCallback(async (authUser) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();
    if (data) return setProfile(data);
    const seed = {
      id: authUser.id,
      display_name:
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split("@")[0] ||
        "User",
      avatar_url: authUser.user_metadata?.avatar_url ?? null,
    };
    const { data: created } = await supabase.from("profiles").upsert(seed).select("display_name, avatar_url").maybeSingle();
    setProfile(created ?? { display_name: seed.display_name, avatar_url: seed.avatar_url });
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) await loadProfile(u).catch(() => {});
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const u = session?.user ?? null;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "TOKEN_REFRESHED") return;
      setUser(u);
      if (!u) { setProfile(null); return; }
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        setTimeout(() => loadProfile(u).catch(() => {}), 0);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInEmail = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyAuthError(error));
  }, []);

  const signUpEmail = useCallback(async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(friendlyAuthError(error));
    if (data.user && data.user.identities?.length === 0) {
      throw new Error("An account with this email already exists. Try signing in.");
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signInGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(friendlyAuthError(error));
  }, []);

  const sendReset = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw new Error(friendlyAuthError(error));
  }, []);

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(friendlyAuthError(error));
    setRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(friendlyAuthError(error));
  }, []);

  const updateProfile = useCallback(
    async (patch) => {
      if (!user) throw new Error("Not signed in.");
      const { error } = await supabase.from("profiles").upsert({ id: user.id, ...patch });
      if (error) throw new Error(friendlyProfileError(error));
      setProfile((p) => ({ ...(p ?? {}), ...patch }));
    },
    [user]
  );

  const deleteAccount = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Please sign in again first.");
    const res = await fetch("/api/delete-account", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Couldn't delete the account.");
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const requireAuth = useCallback(
    (feature) => {
      if (user) return true;
      setAuthRequest({ feature, ...(FEATURES[feature] ?? { label: "This feature", why: "Create a free account to use this feature." }) });
      return false;
    },
    [user]
  );
  const openAuth = useCallback((reason) => setAuthRequest({ feature: "open", label: "Sign in", why: reason ?? "Sign in to sync your preferences and unlock everything." }), []);
  const closeAuth = useCallback(() => setAuthRequest(null), []);

  useEffect(() => { if (user) setAuthRequest(null); }, [user]);

  const meta = user?.user_metadata ?? {};
  const email = user?.email ?? "";
  const displayName =
    (!user && "Guest") ||
    profile?.display_name?.trim() ||
    meta.full_name?.trim() ||
    meta.name?.trim() ||
    (email ? email.split("@")[0] : "") ||
    "User";
  const avatarUrl = profile?.avatar_url || meta.avatar_url || meta.picture || "";
  const provider = user?.app_metadata?.provider || "email";

  const value = useMemo(
    () => ({
      user, isGuest: !user, authRequest, requireAuth, openAuth, closeAuth, profile, loading, recovery, email, displayName, avatarUrl, provider,
      signInEmail, signUpEmail, signInGoogle, sendReset, updatePassword, signOut, updateProfile, deleteAccount,
      dismissRecovery: () => setRecovery(false),
    }),
    [user, authRequest, requireAuth, openAuth, closeAuth, profile, loading, recovery, email, displayName, avatarUrl, provider, signInEmail, signUpEmail, signInGoogle, sendReset, updatePassword, signOut, updateProfile, deleteAccount]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
