import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Cards" },
  { to: "/flashcard", label: "Flash" },
  { to: "/lexicon", label: "Vocab" },
];

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="brutal-border border-t-0 border-x-0 bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-[family-name:var(--font-display)]">
          <span className="bg-coral text-white px-2 py-0.5 mr-1 brutal-border brutal-shadow-sm inline-block -rotate-1">
            语言
          </span>
          Coach
        </h1>
        <nav className="flex gap-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `brutal-btn text-sm ${
                  isActive
                    ? "bg-ink text-cream"
                    : "bg-cream text-ink hover:bg-yellow"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
