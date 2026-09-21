import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { HomeIcon, SettingsIcon } from "lucide-react"

export const Route = createFileRoute("/_app")({
  component: AppLayout,
})

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: HomeIcon },
  { label: "Settings", to: "/dashboard", icon: SettingsIcon },
] as const

function AppLayout() {
  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-56 shrink-0 flex-col border-r md:flex">
        <Link to="/" className="px-5 py-4 font-semibold">
          Triglobe
        </Link>
        <nav className="flex flex-col gap-0.5 p-2">
          {navItems.map(({ label, to, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-w-0 flex-1 p-2">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
