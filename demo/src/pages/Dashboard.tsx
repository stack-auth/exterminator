import { useMemo } from "react";
import type { Task, Note } from "../store";

// --- deeply nested report pipeline ---

interface ReportNode {
  label: string;
  value: number;
  children?: ReportNode[];
  metadata?: { format: string };
}

function collectMetrics(tasks: Task[]): ReportNode[] {
  return tasks.map((t) => ({
    label: t.title,
    value: t.completed ? 1 : 0,
    children: t.tags?.map((tag) => ({
      label: tag,
      value: tag.length,
    })),
    metadata: t.completed ? { format: "done" } : undefined,
  }));
}

function aggregateNodes(nodes: ReportNode[]): ReportNode {
  return {
    label: "root",
    value: nodes.reduce((s, n) => s + n.value, 0),
    children: nodes,
  };
}

function normalizeTree(node: ReportNode): ReportNode {
  const children = (node.children ?? []).map(normalizeTree);
  return { ...node, children, value: node.value / (children.length || 1) };
}

function formatNode(node: ReportNode, depth: number): string {
  const header = `${"  ".repeat(depth)}${node.label}: ${node.value.toFixed(2)} [${node.metadata?.format ?? "pending"}]`;
  const childLines = (node.children ?? []).map((c) => formatNode(c, depth + 1));
  return [header, ...childLines].join("\n");
}

function renderReport(node: ReportNode): string {
  return formatNode(node, 0);
}

function buildReport(tasks: Task[]): string {
  const metrics = collectMetrics(tasks);
  const tree = aggregateNodes(metrics);
  const normalized = normalizeTree(tree);
  return renderReport(normalized);
}

const CARD_COLORS = [
  "bg-brutal-blue",
  "bg-brutal-green",
  "bg-brutal-yellow",
  "bg-brutal-pink",
];

function StatCard({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
}) {
  return (
    <div
      className={`border-3 border-brutal-black ${colorClass} p-5 shadow-brutal`}
    >
      <p className="text-xs font-black text-brutal-black uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black text-brutal-black">{value}</p>
      {sub && (
        <p className="mt-0.5 text-xs font-semibold text-brutal-black/70">
          {sub}
        </p>
      )}
    </div>
  );
}

export function Dashboard({
  tasks,
  notes,
}: {
  tasks: Task[];
  notes: Note[];
}) {
  // BUG: formatNode uses node.metadata!.format — crashes for nodes where metadata is
  // undefined (pending tasks and the synthetic root node have no metadata).
  const report = useMemo(() => buildReport(tasks), [tasks]);

  const completed = tasks.filter((t) => t.completed).length;
  const pending = tasks.filter((t) => !t.completed).length;
  const highPriority = tasks.filter(
    (t) => t.priority === "high" && !t.completed,
  ).length;

  const pendingTasks = tasks.filter((t) => !t.completed);
  const totalTags = pendingTasks.reduce(
    (sum, t) => sum + (t.tags?.length ?? 0),
    0,
  );
  const avgTags =
    pendingTasks.length > 0
      ? (totalTags / pendingTasks.length).toFixed(1)
      : "0";

  return (
    <div>
      <h2 className="text-2xl font-black text-brutal-black uppercase">
        Dashboard
      </h2>
      <p className="mt-1 text-sm font-medium text-neutral-500">
        Overview of your workspace
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Tasks"
          value={tasks.length}
          colorClass={CARD_COLORS[0]}
        />
        <StatCard
          label="Completed"
          value={completed}
          sub={`${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}% done`}
          colorClass={CARD_COLORS[1]}
        />
        <StatCard
          label="Pending"
          value={pending}
          sub={`${avgTags} avg tags`}
          colorClass={CARD_COLORS[2]}
        />
        <StatCard
          label="High Priority"
          value={highPriority}
          colorClass={CARD_COLORS[3]}
        />
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-black text-brutal-black uppercase tracking-wider mb-3">
          Reports
        </h3>
        {report && (
          <pre className="border-3 border-brutal-black bg-white p-4 text-xs font-mono text-brutal-black overflow-x-auto whitespace-pre-wrap shadow-brutal-sm">
            {report}
          </pre>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-black text-brutal-black uppercase tracking-wider mb-3">
          Recent Notes
        </h3>
        {notes.length === 0 ? (
          <p className="text-sm font-medium text-neutral-400">No notes yet</p>
        ) : (
          <div className="space-y-2">
            {notes.slice(0, 3).map((note) => (
              <div
                key={note.id}
                className="border-3 border-brutal-black bg-white px-4 py-3 shadow-brutal-sm"
              >
                <p className="text-sm font-bold text-brutal-black">
                  {note.title || "Untitled"}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 truncate">
                  {note.body || "Empty note"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
