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
          <h2 className="text-2xl font-black text-brutal-black uppercase">
            Notes
          </h2>
          <p className="mt-1 text-sm font-medium text-neutral-500">
            Quick notes and ideas
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="border-3 border-brutal-black bg-brutal-purple px-3 py-1.5 text-sm font-black text-white shadow-brutal-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all cursor-pointer"
        >
          + New Note
        </button>
      </div>

      <div className="mt-5 flex gap-4" style={{ minHeight: 400 }}>
        {/* Note list */}
        <div className="w-56 shrink-0 space-y-2">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => setSelectedId(note.id)}
              className={`w-full text-left border-2 px-3 py-2.5 transition-all cursor-pointer ${
                selectedId === note.id
                  ? "border-brutal-black bg-brutal-yellow shadow-brutal-sm font-bold"
                  : "border-brutal-black bg-white hover:bg-neutral-50"
              }`}
            >
              <p className="text-sm font-bold text-brutal-black truncate">
                {note.title || "Untitled"}
              </p>
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                {(note.body ?? "").trim().slice(0, 60) || "No content"}
              </p>
              <p className="text-[11px] text-neutral-500 font-medium">
                {timeAgo(note.updatedAt)}
              </p>
            </button>
          ))}
          {notes.length === 0 && (
            <p className="px-3 py-6 text-center text-xs font-medium text-neutral-400">
              No notes yet
            </p>
          )}
        </div>

        {/* Editor */}
        {selected ? (
          <div className="flex-1 flex flex-col border-3 border-brutal-black bg-white shadow-brutal overflow-hidden">
            <div className="flex items-center justify-between border-b-3 border-brutal-black px-4 py-2.5">
              <input
                value={selected.title}
                onChange={(e) =>
                  onUpdate(selected.id, { title: e.target.value })
                }
                placeholder="Note title"
                className="flex-1 bg-transparent text-sm font-bold text-brutal-black placeholder-neutral-400 outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSave(selected)}
                  className="border-2 border-brutal-black bg-brutal-blue px-2.5 py-1 text-xs font-bold text-brutal-black hover:bg-brutal-blue/80 transition-colors cursor-pointer"
                >
                  Sync
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="border-2 border-brutal-black px-2 py-1 text-xs font-bold text-brutal-black hover:bg-brutal-red hover:text-white transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
            <textarea
              value={selected.body ?? ""}
              onChange={(e) =>
                onUpdate(selected.id, { body: e.target.value })
              }
              placeholder="Start writing..."
              className="flex-1 resize-none bg-transparent px-4 py-3 text-sm text-brutal-black placeholder-neutral-400 outline-none leading-relaxed"
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center border-3 border-dashed border-neutral-300 text-sm font-bold text-neutral-400">
            Select a note or create a new one
          </div>
        )}
      </div>
    </div>
  );
}
