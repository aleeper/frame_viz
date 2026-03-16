import { useRef } from 'react';
import type { AppSnapshot } from '../../types/AppSnapshot';
import doublePendulumJson from '../../../examples/double_pendulum.json';
import robotArmJson from '../../../examples/robot_arm.json';
import gimbalJson from '../../../examples/gimbal.json';

const EXAMPLES: { label: string; data: AppSnapshot }[] = [
  { label: 'Double Pendulum', data: doublePendulumJson as unknown as AppSnapshot },
  { label: 'Robot Arm',       data: robotArmJson as unknown as AppSnapshot },
  { label: 'Gimbal',          data: gimbalJson as unknown as AppSnapshot },
];

interface ScenePanelProps {
  snapshot: AppSnapshot;
  onLoad: (snapshot: AppSnapshot) => void;
}

export function ScenePanel({ snapshot, onLoad }: ScenePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadExample = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const example = EXAMPLES.find(ex => ex.label === e.target.value);
    if (example) onLoad(example.data);
    e.target.value = '';
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as AppSnapshot;
        if (parsed.poses) onLoad(parsed);
      } catch {
        // invalid JSON — silently ignore
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-3 space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Examples</p>
        <select
          className="w-full text-xs border border-gray-600 rounded bg-gray-700 text-white px-2 py-1.5"
          defaultValue=""
          onChange={handleLoadExample}
        >
          <option value="" disabled>Load example…</option>
          {EXAMPLES.map(ex => (
            <option key={ex.label} value={ex.label}>{ex.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">File</p>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-xs border border-gray-600 rounded px-2 py-1.5 text-gray-300 hover:text-white hover:border-gray-400 transition-colors text-left"
          >
            Import JSON…
          </button>
          <button
            onClick={handleExport}
            className="w-full text-xs border border-gray-600 rounded px-2 py-1.5 text-gray-300 hover:text-white hover:border-gray-400 transition-colors text-left"
          >
            Export JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>
    </div>
  );
}
