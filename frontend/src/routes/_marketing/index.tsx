import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/_marketing/")({
  component: Home,
})

function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-24">
      <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        Evaluating politics, business, and nations.
      </h1>
      <p className="text-muted-foreground text-lg text-pretty">
        Triglobe turns primary sources into comparable indicators, so you can
        see how a country, a market, or a policy is actually moving.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" render={<Link to="/dashboard" />}>
          Explore the index
        </Button>
        <Button size="lg" variant="outline" render={<Link to="/" />}>
          Read the methodology
        </Button>
      </div>
    </main>
  )
}
