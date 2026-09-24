export type Lens = {
  id: string
  number: string
  title: string
  image: string
  alt: string
  copy: string
  description: string
  focus: { title: string; copy: string }[]
}

// Shared by the landing page, the masthead, and each lens page.
export const lenses: Lens[] = [
  {
    id: "politics",
    number: "01",
    title: "Politics",
    image: "/images/building-columns-fill-svgrepo-com.svg",
    alt: "Classical government building with columns",
    copy: "Power leaves a paper trail. We follow the policies, institutions, and decisions that shape what comes next.",
    description:
      "Elections, legislation, regulation, and diplomacy rarely stay in the capital. The Politics lens follows public decisions outward — into markets, industries, and the lives of people far from where those decisions were made.",
    focus: [
      {
        title: "Policy & regulation",
        copy: "The rules being written now, and who they will touch once they take effect.",
      },
      {
        title: "Institutions",
        copy: "Legislatures, courts, central banks, and agencies: how they work and where their power ends.",
      },
      {
        title: "Elections & opinion",
        copy: "Who is gaining ground, who is losing it, and what a result would change.",
      },
      {
        title: "Geopolitics",
        copy: "Alliances, sanctions, and disputes that reach well beyond any one border.",
      },
    ],
  },
  {
    id: "business",
    number: "02",
    title: "Business",
    image: "/images/scale-unbalanced-svgrepo-com.svg",
    alt: "Balance scales representing business and trade",
    copy: "No company exists in isolation. We place markets and enterprise within the wider currents of the world.",
    description:
      "Earnings and share prices are only the surface. The Business lens reads companies alongside the policies, supply chains, and competitors that shape their results, so a single ticker opens onto the wider picture.",
    focus: [
      {
        title: "Companies",
        copy: "Business models, leadership, and the numbers behind the headlines.",
      },
      {
        title: "Markets & sectors",
        copy: "How industries move together, and where they start to pull apart.",
      },
      {
        title: "Trade & supply chains",
        copy: "Where goods come from, where they go, and what can interrupt them.",
      },
      {
        title: "Regulation & risk",
        copy: "The political and legal pressures that eventually land on a balance sheet.",
      },
    ],
  },
  {
    id: "nations",
    number: "03",
    title: "Nations",
    image: "/images/compass-svgrepo-com.svg",
    alt: "Compass representing nations and global connections",
    copy: "Borders tell only part of the story. We explore the economies, histories, and relationships that connect us.",
    description:
      "Every country carries its own economy, history, and web of relationships. The Nations lens connects those threads, so you can see how a decision made in one place is felt in another.",
    focus: [
      {
        title: "Economies",
        copy: "Growth, inflation, employment, and the policies behind them.",
      },
      {
        title: "History & context",
        copy: "The events that explain why a country acts the way it does today.",
      },
      {
        title: "Relationships",
        copy: "Trade partners, alliances, rivalries, and the ties that bind regions together.",
      },
      {
        title: "People & society",
        copy: "Population, migration, and the social shifts that shape the long term.",
      },
    ],
  },
]
