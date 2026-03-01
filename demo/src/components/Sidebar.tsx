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
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r-3 border-brutal-black bg-white">
      <div className="px-5 py-5">
        <h1 className="text-base font-black tracking-tight text-brutal-black uppercase">
          Planr
        </h1>
        <p className="text-[11px] font-medium text-neutral-500">
          Productivity app
        </p>
      </div>
      <nav className="flex-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`mb-1 flex w-full items-center gap-2.5 border-2 px-3 py-2 text-left text-sm font-bold transition-all cursor-pointer ${
                active
                  ? "border-brutal-black bg-brutal-yellow shadow-brutal-sm text-brutal-black"
                  : "border-transparent text-neutral-600 hover:border-brutal-black hover:bg-neutral-50"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t-3 border-brutal-black px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 border-2 border-brutal-black bg-brutal-pink shadow-brutal-sm" />
          <div>
            <p className="text-xs font-bold text-brutal-black">Demo User</p>
            <p className="text-[11px] text-neutral-500">demo@planr.app</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
