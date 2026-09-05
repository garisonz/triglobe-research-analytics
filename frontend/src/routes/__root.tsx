import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { QueryClient } from "@tanstack/react-query"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <nav className="flex gap-4 border-b p-4">
        <Link to="/" className="[&.active]:font-bold">Home</Link>
      </nav>
      <Outlet />
      <TanStackRouterDevtools />
      <ReactQueryDevtools />
    </>
  ),
})