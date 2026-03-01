import { useState } from "react";

interface SettingToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
          checked ? "bg-indigo-600" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

export function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  function handleExport() {
    // BUG TRIGGER: builds an object with a circular reference then tries to serialize it
    const data: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      settings: { notifications, analytics, autoSave, darkMode },
    };
    data.self = data; // circular reference
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planr-export.json";
    a.click();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white">Settings</h2>
      <p className="mt-1 text-sm text-zinc-500">Manage your preferences</p>

      <div className="mt-6 space-y-3 max-w-xl">
        <SettingToggle
          label="Notifications"
          description="Get notified about task deadlines"
          checked={notifications}
          onChange={setNotifications}
        />
        <SettingToggle
          label="Analytics"
          description="Share anonymous usage data"
          checked={analytics}
          onChange={setAnalytics}
        />
        <SettingToggle
          label="Auto-save"
          description="Automatically save notes as you type"
          checked={autoSave}
          onChange={setAutoSave}
        />
        <SettingToggle
          label="Dark Mode"
          description="Use dark color scheme"
          checked={darkMode}
          onChange={setDarkMode}
        />
      </div>

      <div className="mt-8 max-w-xl">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Data
        </h3>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
}
