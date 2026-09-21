import { Link, Route, Routes, useParams } from "react-router";

function HomePage() {
  return <h1 className="text-2xl font-semibold">Home</h1>;
}

function StockPage() {
  const { symbol } = useParams();

  return (
    <h1 className="text-2xl font-semibold">
      Stock: {symbol}
    </h1>
  );
}

function SettingsPage() {
  return <h1 className="text-2xl font-semibold">Settings</h1>;
}

export default function App() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <nav
        aria-label="Main navigation"
        className="mb-8 flex gap-6 border-b pb-4"
      >
        <Link to="/">Home</Link>
        <Link to="/stocks/AAPL">Apple</Link>
        <Link to="/settings">Settings</Link>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stocks/:symbol" element={<StockPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<h1>Page not found</h1>} />
        </Routes>
      </main>
    </div>
  );
}
