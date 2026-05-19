import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Cards" },
  { to: "/flashcard", label: "Flash" },
  { to: "/lexicon", label: "Vocab" },
];

export default function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="bg-coral text-white px-2 py-0.5 mr-1 brutal-border brutal-shadow-sm inline-block -rotate-1">
            语言
          </span>
          Coach
        </h1>
        <nav className="flex gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center justify-center h-8 px-3 text-sm font-bold transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
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
