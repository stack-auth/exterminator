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
    <div className="flex items-center justify-between border-3 border-brutal-black bg-white px-4 py-3 shadow-brutal-sm">
      <div>
        <p className="text-sm font-bold text-brutal-black">{label}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 border-2 border-brutal-black transition-colors cursor-pointer ${
          checked ? "bg-brutal-green" : "bg-neutral-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 border border-brutal-black bg-white transition-transform ${
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
      <h2 className="text-2xl font-black text-brutal-black uppercase">
        Settings
      </h2>
      <p className="mt-1 text-sm font-medium text-neutral-500">
        Manage your preferences
      </p>

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
        <h3 className="text-sm font-black text-brutal-black uppercase tracking-wider mb-3">
          Data
        </h3>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="border-3 border-brutal-black bg-brutal-orange px-4 py-2 text-sm font-black text-brutal-black shadow-brutal-sm hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all cursor-pointer"
          >
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
}
