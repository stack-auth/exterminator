const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "◫" },
  { id: "tasks", label: "Tasks", icon: "☑" },
  { id: "notes", label: "Notes", icon: "✎" },
  { id: "settings", label: "Settings", icon: "⚙" },
] as const;

export type Page = (typeof NAV_ITEMS)[number]["id"];

export function Sidebar({
  current,
  onNavigate,
}: {
  current: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="px-5 py-5">
        <h1 className="text-base font-bold tracking-tight text-white">Planr</h1>
        <p className="text-[11px] text-zinc-500">Productivity app</p>
      </div>
      <nav className="flex-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
          <div>
            <p className="text-xs font-medium text-zinc-200">Demo User</p>
            <p className="text-[11px] text-zinc-500">demo@planr.app</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
