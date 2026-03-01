import type { Task } from "../store";

const PRIORITY_STYLES = {
  low:    "bg-zinc-700 text-zinc-300",
  medium: "bg-amber-900/60 text-amber-300",
  high:   "bg-red-900/60 text-red-900",
};

export function TaskDetail({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const formattedDue = task.dueDate
    ? (() => {
        const [year, month, day] = task.dueDate.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      })()
    : "No due date";

  const initials = task.assignee.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-start justify-between border-b border-zinc-800 p-5">
        <div className="flex-1 pr-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Task detail
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white leading-snug">
            {task.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Priority
          </p>
          <span
            className={`mt-1.5 inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_STYLES[task.priority]}`}
          >
            {task.priority}
          </span>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Due date
          </p>
          <p className="mt-1.5 text-sm text-zinc-300">{formattedDue}</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Assignee
          </p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
              {initials}
            </div>
            <p className="text-sm text-zinc-300">{task.assignee.name}</p>
          </div>
        </div>

        {task.tags && task.tags.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Tags
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Status
          </p>
          <p className="mt-1.5 text-sm text-zinc-300">
            {task.completed ? "Completed" : "In progress"}
          </p>
        </div>
      </div>
    </div>
  );
}
