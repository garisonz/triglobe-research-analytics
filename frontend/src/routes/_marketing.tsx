import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_marketing")({
  component: MarketingLayout,
})

function MarketingLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold">
            Triglobe
          </Link>
          <Button variant="ghost" size="sm" render={<Link to="/dashboard" />}>
            Log in
          </Button>
        </nav>
      </header>
      <Outlet />
      <footer className="mt-auto border-t">
        <div className="text-muted-foreground mx-auto max-w-3xl px-6 py-6 text-sm">
          © {new Date().getFullYear()} Triglobe Research Analytics
        </div>
      </footer>
    </div>
  )
}
