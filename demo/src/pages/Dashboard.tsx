import { useState } from "react";
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
  const header = `${"  ".repeat(depth)}${node.label}: ${node.value.toFixed(2)} [${node.metadata!.format}]`;
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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
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
  const [report, setReport] = useState<string | null>(null);
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
      <h2 className="text-lg font-semibold text-white">Dashboard</h2>
      <p className="mt-1 text-sm text-zinc-500">Overview of your workspace</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Tasks" value={tasks.length} />
        <StatCard
          label="Completed"
          value={completed}
          sub={`${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}% done`}
        />
        <StatCard label="Pending" value={pending} sub={`${avgTags} avg tags`} />
        <StatCard label="High Priority" value={highPriority} />
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Reports
        </h3>
        <button
          onClick={() => {
            const output = buildReport(tasks);
            setReport(output);
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Generate Report
        </button>
        {report && (
          <pre className="mt-3 rounded-lg bg-zinc-950 border border-zinc-800 p-4 text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap">
            {report}
          </pre>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Recent Notes
        </h3>
        {notes.length === 0 ? (
          <p className="text-sm text-zinc-600">No notes yet</p>
        ) : (
          <div className="space-y-2">
            {notes.slice(0, 3).map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3"
              >
                <p className="text-sm font-medium text-zinc-200">
                  {note.title || "Untitled"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 truncate">
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
