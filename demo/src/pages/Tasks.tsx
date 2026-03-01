import { useState } from "react";
import type { Task } from "../store";
import { TaskDetail } from "../components/TaskDetail";
import { ErrorBoundary } from "../components/ErrorBoundary";

const PRIORITY_COLORS = {
  low: "bg-zinc-700 text-zinc-300",
  medium: "bg-amber-900/60 text-amber-300",
  high: "bg-red-900/60 text-red-300",
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
    <div className="flex gap-6">
      {/* Main task list */}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold text-white">Tasks</h2>
        <p className="mt-1 text-sm text-zinc-500">Manage your to-do list</p>

        {/* Add form */}
        <form onSubmit={handleAdd} className="mt-5 flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new task..."
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task["priority"])}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Add
          </button>
        </form>

        {/* Filters */}
        <div className="mt-4 flex gap-1">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize cursor-pointer ${
                filter === f
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task list */}
        <ul className="mt-4 space-y-1.5">
          {filtered.map((task) => (
            <li
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className={`group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer ${
                selectedTask?.id === task.id
                  ? "border-indigo-800/60 bg-indigo-950/30"
                  : "border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-900"
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                  task.completed
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-600 hover:border-zinc-400"
                }`}
              >
                {task.completed && (
                  <span className="text-xs leading-none">✓</span>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    task.completed
                      ? "text-zinc-500 line-through"
                      : "text-zinc-200"
                  }`}
                >
                  {task.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                  {task.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {task.assignee?.name && (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-semibold text-zinc-300"
                    title={task.assignee.name}
                  >
                    {task.assignee.name.split(" ").map((w) => w[0]).join("")}
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-8 text-center text-sm text-zinc-600">
              No tasks to show
            </li>
          )}
        </ul>
      </div>

      {/* Task detail panel — each task gets its own ErrorBoundary so the
          boundary resets when you select a different task */}
      {selectedTask && (
        <ErrorBoundary key={selectedTask.id}>
          <TaskDetail
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
