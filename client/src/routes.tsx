import { Link, Route, Routes, useParams } from "react-router"
import RequireAuth from "./auth/RequireAuth"
import { useAuth } from "./auth/auth-context"
import { lenses } from "./content/lenses"
import PublicLayout from "./layouts/PublicLayout"
import WorkspaceLayout from "./layouts/WorkspaceLayout"
import AuthPage from "./pages/AuthPage"
import HomePage from "./pages/HomePage"
import LandingPage from "./pages/LandingPage"
import LensPage from "./pages/LensPage"
import {
  eyebrow,
  pageIntro,
  pageIntroCopy,
  pageTitle,
  primaryButton,
  textLink,
} from "./lib/styles"

function StockPage() {
  const { symbol } = useParams()
  return (
    <section className={pageIntro}>
      <p className={eyebrow}>Company research</p>
      <h1 className={pageTitle}>{symbol?.toUpperCase()}</h1>
      <p className={pageIntroCopy}>
        This company workspace is ready for future research and market data.
        Live data is not connected yet.
      </p>
      <Link className={textLink} to="/home">
        Back to home &rarr;
      </Link>
    </section>
  )
}

function SettingsPage() {
  const { user } = useAuth()
  return (
    <section className={pageIntro}>
      <p className={eyebrow}>Your workspace</p>
      <h1 className={pageTitle}>Settings</h1>
      <p className={pageIntroCopy}>
        Signed in as <strong>{user?.email}</strong>.
      </p>
      <Link className={textLink} to="/home">
        Back to home &rarr;
      </Link>
    </section>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        {lenses.map((lens) => (
          <Route
            key={lens.id}
            path={`/${lens.id}`}
            element={<LensPage lens={lens} />}
          />
        ))}
        <Route
          path="/sign-in"
          element={<AuthPage key="sign-in" mode="sign-in" />}
        />
        <Route
          path="/sign-up"
          element={<AuthPage key="sign-up" mode="sign-up" />}
        />
        <Route
          path="*"
          element={
            <section className={pageIntro}>
              <p className={eyebrow}>404</p>
              <h1 className={pageTitle}>Page not found.</h1>
              <p className={pageIntroCopy}>
                Let’s get you back to your research.
              </p>
              <Link className={primaryButton} to="/home">
                Go to home &rarr;
              </Link>
            </section>
          }
        />
      </Route>
      <Route element={<WorkspaceLayout />}>
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/stocks/:symbol" element={<StockPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
