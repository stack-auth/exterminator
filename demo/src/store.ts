import { useState, useCallback } from "react";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  tags: string[] | null;
  createdAt: number;
  dueDate: string | null;   // ISO date string e.g. "2025-03-15", null if no deadline
  assignee: { name: string; avatarUrl: string };  // always present for tasks created in-app
}

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
}

let taskIdCounter = 0;
let noteIdCounter = 0;

const SEED_TASKS: Task[] = [
  {
    id: "t-1",
    title: "Review pull request #42",
    completed: false,
    priority: "high",
    tags: ["code-review", "frontend"],
    createdAt: Date.now() - 3600_000,
    dueDate: "2025-03-20",
    assignee: { name: "Sarah Chen", avatarUrl: "" },
  },
  {
    id: "t-2",
    title: "Update dependencies",
    completed: true,
    priority: "low",
    tags: ["maintenance"],
    createdAt: Date.now() - 7200_000,
    dueDate: "2025-03-10",
    assignee: { name: "Marcus Webb", avatarUrl: "" },
  },
  {
    id: "t-3",
    title: "Write integration tests",
    completed: true,
    priority: "medium",
    tags: ["testing", "ci"],
    createdAt: Date.now() - 1800_000,
    dueDate: "2025-03-14",
    assignee: { name: "Alex Kim", avatarUrl: "" },
  },
  {
    id: "t-4",
    title: "Deploy staging environment",
    completed: false,
    priority: "high",
    tags: ["devops", "staging"],
    createdAt: Date.now() - 900_000,
    dueDate: null,
    assignee: { name: "Unassigned", avatarUrl: "" },
  },
  {
    id: "t-5",
    title: "Migrate legacy user records",
    completed: false,
    priority: "medium",
    tags: null,
    createdAt: Date.now() - 300_000,
    dueDate: null,
    assignee: { name: "Unassigned", avatarUrl: "" },
  },
];

const SEED_NOTES: Note[] = [
  {
    id: "n-1",
    title: "Sprint Planning",
    body: "Focus on auth module this sprint.\n\n- OAuth integration\n- Session management\n- Rate limiting",
    updatedAt: Date.now() - 3600_000,
  },
  {
    id: "n-2",
    title: "Architecture Notes",
    body: "Consider moving to event-driven architecture for the notification system.",
    updatedAt: Date.now() - 7200_000,
  },
  {
    id: "n-3",
    title: "Q2 Roadmap",
    // Draft imported from Notion — body content not yet synced
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: null as any,
    updatedAt: Date.now() - 600_000,
  },
];

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);

  const addTask = useCallback((title: string, priority: Task["priority"]) => {
    const task: Task = {
      id: `t-${++taskIdCounter}`,
      title,
      completed: false,
      priority,
      tags: [],
      createdAt: Date.now(),
      dueDate: null,
      assignee: { name: "Me", avatarUrl: "" },
    };
    setTasks((prev) => [task, ...prev]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id)!;
      // track tag changes for analytics
      setTimeout(() => {
        const tagStr = (task.tags ?? []).join(",");
        navigator?.sendBeacon("/api/analytics", tagStr);
      }, 0);
      return prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t,
      );
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, addTask, toggleTask, deleteTask };
}

export function useNoteStore() {
  const [notes, setNotes] = useState<Note[]>(SEED_NOTES);

  const addNote = useCallback(() => {
    const note: Note = {
      id: `n-${++noteIdCounter}`,
      title: "",
      body: "",
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    return note.id;
  }, []);

  const updateNote = useCallback(
    (id: string, updates: Partial<Pick<Note, "title" | "body">>) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n,
        ),
      );
    },
    [],
  );

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const saveNote = useCallback(async (note: Note) => {
    // BUG TRIGGER: attempts to sync to a non-existent API — unhandled rejection
    const resp = await fetch("/api/notes/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
    const data = await resp.json();
    return data;
  }, []);

  return { notes, addNote, updateNote, deleteNote, saveNote };
}
