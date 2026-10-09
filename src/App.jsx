import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { SettingsProvider } from "./context/SettingsContext";
import { StoreProvider } from "./context/StoreContext";
import { ToastProvider } from "./context/ToastContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import { lazyRetry } from "./lib/lazyRetry";

const Landing = lazyRetry(() => import("./pages/Landing"));
const Home = lazyRetry(() => import("./pages/Home"));
const Markets = lazyRetry(() => import("./pages/Markets"));
const Heatmap = lazyRetry(() => import("./pages/Heatmap"));
const Tools = lazyRetry(() => import("./pages/Tools"));
const Watchlist = lazyRetry(() => import("./pages/Watchlist"));
const Compare = lazyRetry(() => import("./pages/Compare"));
const Portfolio = lazyRetry(() => import("./pages/Portfolio"));
const Alerts = lazyRetry(() => import("./pages/Alerts"));
const Notifications = lazyRetry(() => import("./pages/Notifications"));
const Settings = lazyRetry(() => import("./pages/Settings"));
const Account = lazyRetry(() => import("./pages/Account"));
const CoinDetail = lazyRetry(() => import("./pages/CoinDetail"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

function AppShell() {
  return (
    <DataProvider>
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    </DataProvider>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

function AuthModalHost() {
  const { authRequest, closeAuth, recovery } = useAuth();
  if (!authRequest || recovery) return null;
  return <Login embedded reason={authRequest.why} onClose={closeAuth} />;
}

function Routing() {
  const { recovery } = useAuth();
  if (recovery) return <Login />;
  return (
    <>
      <Suspense fallback={<div className="route-fallback" role="status" aria-label="Loading" />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<Home />} />
            <Route path="home" element={<Navigate to="/dashboard" replace />} />
            <Route path="markets" element={<Markets />} />
            <Route path="heatmap" element={<Heatmap />} />
            <Route path="tools" element={<Tools />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="compare" element={<Compare />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="account" element={<Account />} />
            <Route path="profile" element={<Navigate to="/account#profile" replace />} />
            <Route path="coin/:id" element={<CoinDetail />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <AuthModalHost />
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Routing />
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
