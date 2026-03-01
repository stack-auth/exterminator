import { useState } from "react";
import type { Task } from "../store";

// Throw during the next render so the nearest ErrorBoundary can catch the error.
// This is the standard pattern for surfacing event-handler errors to an ErrorBoundary.
function useThrowOnError() {
  const [, setState] = useState<undefined>();
  return (err: unknown) => setState(() => { throw err; });
}

// BUG: task.tags is typed as string[] | null but this function assumes it is
// always an array. Tasks imported from legacy systems have tags: null, which
// causes a TypeError when .join() is called on null.
function exportToCSV(tasks: Task[]) {
  const header = ["id", "title", "priority", "tags", "status"];
  const rows = tasks.map((task) => [
    task.id,
    `"${task.title}"`,
    task.priority,
    task.tags.join(", "),           // ← crashes when tags is null
    task.completed ? "done" : "pending",
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tasks.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const PRIORITY_COLORS = {
  low: "bg-neutral-200 text-brutal-black border-brutal-black",
  medium: "bg-brutal-yellow text-brutal-black border-brutal-black",
  high: "bg-brutal-red text-white border-brutal-black",
};

export function Tasks({
  tasks,
  onAdd,
  onToggle,
  onDelete,
}: {
  tasks: Task[];
  onAdd: (title: string, priority: Task["priority"]) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const throwError = useThrowOnError();

  const filtered = tasks.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "completed") return t.completed;
    return true;
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), priority);
    setTitle("");
  }

  return (
    <div>
      <h2 className="text-2xl font-black text-brutal-black uppercase">
        Tasks
      </h2>
      <p className="mt-1 text-sm font-medium text-neutral-500">
        Manage your to-do list
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} className="mt-5 flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 border-3 border-brutal-black bg-white px-3 py-2 text-sm text-brutal-black placeholder-neutral-400 outline-none focus:shadow-brutal-sm transition-shadow"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Task["priority"])}
          className="border-3 border-brutal-black bg-white px-3 py-2 text-sm font-bold text-brutal-black outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          type="submit"
          className="border-3 border-brutal-black bg-brutal-blue px-4 py-2 text-sm font-black text-brutal-black shadow-brutal-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
        >
          Add
        </button>
      </form>

      {/* Filters + Export */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`border-2 px-3 py-1 text-xs font-bold transition-all capitalize cursor-pointer ${
                filter === f
                  ? "border-brutal-black bg-brutal-black text-white"
                  : "border-brutal-black text-brutal-black hover:bg-neutral-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => { try { exportToCSV(tasks); } catch (err) { throwError(err); } }}
          className="flex items-center gap-1.5 border-2 border-brutal-black px-3 py-1 text-xs font-bold text-brutal-black hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          <span>↓</span> Export CSV
        </button>
      </div>

      {/* Task list */}
      <ul className="mt-4 space-y-2">
        {filtered.map((task) => (
          <li
            key={task.id}
            className="group flex items-center gap-3 border-3 border-brutal-black bg-white px-4 py-3 shadow-brutal-sm transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            <button
              onClick={() => onToggle(task.id)}
              className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors cursor-pointer ${
                task.completed
                  ? "border-brutal-black bg-brutal-green text-white"
                  : "border-brutal-black hover:bg-neutral-100"
              }`}
            >
              {task.completed && (
                <span className="text-xs font-black leading-none">✓</span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-bold ${
                  task.completed
                    ? "text-neutral-400 line-through"
                    : "text-brutal-black"
                }`}
              >
                {task.title}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`border px-1.5 py-0.5 text-[10px] font-black uppercase ${PRIORITY_COLORS[task.priority]}`}
                >
                  {task.priority}
                </span>
                {task.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="border border-brutal-black bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-brutal-black"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => onDelete(task.id)}
              className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-brutal-red transition-all text-sm font-black cursor-pointer"
            >
              ✕
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-8 text-center text-sm font-medium text-neutral-400">
            No tasks to show
          </li>
        )}
      </ul>
    </div>
  );
}
