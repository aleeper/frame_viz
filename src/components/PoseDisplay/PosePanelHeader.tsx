import { useEffect, useState } from 'react';

interface PosePanelHeaderProps {
  poseName: string | undefined;
  fallbackLabel: string;          // e.g. "Pose 1"
  onRename?: (name: string | undefined) => void;
  onRemove?: () => void;
}

export function PosePanelHeader({
  poseName,
  fallbackLabel,
  onRename,
  onRemove,
}: PosePanelHeaderProps) {
  const [editValue, setEditValue] = useState(poseName ?? '');

  // Keep input in sync when poseName changes externally (JSON editor edits).
  useEffect(() => {
    setEditValue(poseName ?? '');
  }, [poseName]);

  const commit = () => {
    const trimmed = editValue.trim();
    onRename?.(trimmed !== '' ? trimmed : undefined);
  };

  return (
    <div className="flex items-center justify-between px-2 pt-1 pb-1 bg-white border-b border-gray-200">
      <input
        className="bg-transparent text-gray-800 text-sm font-semibold flex-1 min-w-0 outline-none border-b border-transparent focus:border-gray-400 transition-colors placeholder:text-gray-400"
        value={editValue}
        placeholder={fallbackLabel}
        onChange={e => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      />
      {onRemove && (
        <button
          className="ml-2 text-gray-400 hover:text-red-500 transition-colors text-xs leading-none"
          onClick={onRemove}
          aria-label="Remove pose"
        >
          ✕
        </button>
      )}
    </div>
  );
}
