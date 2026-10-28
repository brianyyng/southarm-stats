import { StrictMode, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./index.css";
import DraftPage from "./pages/DraftPage";
import GamePage from "./pages/GamePage";
import HomePage from "./pages/HomePage";
import LineupPage from "./pages/LineupPage";
import ProfilePage from "./pages/ProfilePage";
import SchedulePage from "./pages/SchedulePage";
import SignInPage from "./pages/SignInPage";
import StatsPage from "./pages/StatsPage";

/** New players (e.g. first Google sign-in) finish their profile before anything else. */
function ProfileGate({ children }: { children: ReactNode }) {
  const { needsProfile } = useAuth();
  const { pathname } = useLocation();
  if (needsProfile && pathname !== "/profile") return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <ProfileGate>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/games/:id" element={<GamePage />} />
            <Route path="/games/:id/draft" element={<DraftPage />} />
            <Route path="/games/:id/lineup" element={<LineupPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProfileGate>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
