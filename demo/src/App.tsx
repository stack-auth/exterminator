import { useState } from "react";
import { Sidebar, type Page } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Tasks } from "./pages/Tasks";
import { Notes } from "./pages/Notes";
import { Settings } from "./pages/Settings";
import { useTaskStore, useNoteStore } from "./store";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const { tasks, addTask, toggleTask, deleteTask } = useTaskStore();
  const { notes, addNote, updateNote, deleteNote, saveNote } = useNoteStore();

  return (
    <div className="flex h-screen bg-cream text-brutal-black">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <ErrorBoundary key={page}>
          {page === "dashboard" && <Dashboard tasks={tasks} notes={notes} />}
          {page === "tasks" && (
            <Tasks
              tasks={tasks}
              onAdd={addTask}
              onToggle={toggleTask}
              onDelete={deleteTask}
            />
          )}
          {page === "notes" && (
            <Notes
              notes={notes}
              onAdd={addNote}
              onUpdate={updateNote}
              onDelete={deleteNote}
              onSave={saveNote}
            />
          )}
          {page === "settings" && <Settings />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
