import { useState } from "react";
import type { Note } from "../store";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Notes({
  notes,
  onAdd,
  onUpdate,
  onDelete,
  onSave,
}: {
  notes: Note[];
  onAdd: () => string;
  onUpdate: (id: string, updates: Partial<Pick<Note, "title" | "body">>) => void;
  onDelete: (id: string) => void;
  onSave: (note: Note) => Promise<unknown>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    notes[0]?.id ?? null,
  );

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  function handleAdd() {
    const id = onAdd();
    setSelectedId(id);
  }

  function handleDelete(id: string) {
    onDelete(id);
    if (selectedId === id) {
      setSelectedId(notes.find((n) => n.id !== id)?.id ?? null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Notes</h2>
          <p className="mt-1 text-sm text-zinc-500">Quick notes and ideas</p>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          + New Note
        </button>
      </div>

      <div className="mt-5 flex gap-4" style={{ minHeight: 400 }}>
        {/* Note list */}
        <div className="w-56 shrink-0 space-y-1.5">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedId(note.id)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
                selectedId === note.id
                  ? "bg-zinc-800 border border-zinc-700"
                  : "border border-transparent hover:bg-zinc-900"
              }`}
            >
              <p className="text-sm font-medium text-zinc-200 truncate">
                {note.title || "Untitled"}
              </p>
              <p className="text-[11px] text-zinc-500">{timeAgo(note.updatedAt)}</p>
            </button>
          ))}
          {notes.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-zinc-600">
              No notes yet
            </p>
          )}
        </div>

        {/* Editor */}
        {selected ? (
          <div className="flex-1 flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
              <input
                value={selected.title}
                onChange={(e) =>
                  onUpdate(selected.id, { title: e.target.value })
                }
                placeholder="Note title"
                className="flex-1 bg-transparent text-sm font-medium text-zinc-200 placeholder-zinc-600 outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSave(selected)}
                  className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Sync
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
            <textarea
              value={selected.body}
              onChange={(e) =>
                onUpdate(selected.id, { body: e.target.value })
              }
              placeholder="Start writing..."
              className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 outline-none leading-relaxed"
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-600">
            Select a note or create a new one
          </div>
        )}
      </div>
    </div>
  );
}
