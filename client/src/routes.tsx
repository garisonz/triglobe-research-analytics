import { Link, Route, Routes, useParams } from "react-router"
import RequireAuth from "./auth/RequireAuth"
import { useAuth } from "./auth/auth-context"
import AuthPage from "./pages/AuthPage"
import HomePage from "./pages/HomePage"
import LandingPage from "./pages/LandingPage"

function StockPage() {
  const { symbol } = useParams()
  return (
    <section className="page-intro">
      <p className="eyebrow">Company research</p>
      <h1>{symbol?.toUpperCase()}</h1>
      <p className="intro-copy">
        This company workspace is ready for future research and market data.
        Live data is not connected yet.
      </p>
      <Link className="text-link" to="/home">
        Back to home &rarr;
      </Link>
    </section>
  )
}

function SettingsPage() {
  const { user } = useAuth()
  return (
    <section className="page-intro">
      <p className="eyebrow">Your workspace</p>
      <h1>Settings</h1>
      <p className="intro-copy">
        Signed in as <strong>{user?.email}</strong>.
      </p>
      <Link className="text-link" to="/home">
        Back to home &rarr;
      </Link>
    </section>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/sign-in"
        element={<AuthPage key="sign-in" mode="sign-in" />}
      />
      <Route
        path="/sign-up"
        element={<AuthPage key="sign-up" mode="sign-up" />}
      />
      <Route element={<RequireAuth />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/stocks/:symbol" element={<StockPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="*"
        element={
          <section className="page-intro">
            <p className="eyebrow">404</p>
            <h1>Page not found.</h1>
            <p className="intro-copy">Let’s get you back to your research.</p>
            <Link className="button button-primary" to="/home">
              Go to home &rarr;
            </Link>
          </section>
        }
      />
    </Routes>
  )
}
