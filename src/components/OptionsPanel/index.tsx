import { DropdownControl } from '../DropdownControl';
import type { UpDirection } from '../../types/Representation';

interface OptionsPanelProps {
  upDirection: UpDirection;
  onUpDirectionChange: (dir: UpDirection) => void;
  showWorldAxes: boolean;
  onShowWorldAxesChange: (v: boolean) => void;
  showParentLines: boolean;
  onShowParentLinesChange: (v: boolean) => void;
}

export function OptionsPanel({
  upDirection,
  onUpDirectionChange,
  showWorldAxes,
  onShowWorldAxesChange,
  showParentLines,
  onShowParentLinesChange,
}: OptionsPanelProps) {
  return (
    <div className="p-3 space-y-1">
      <div className="flex items-center gap-2 py-1">
        <span className="text-gray-300 text-xs w-24 shrink-0">Up Direction</span>
        <DropdownControl
          id="up-direction"
          value={upDirection}
          onChange={onUpDirectionChange}
          options={["X", "Y", "Z"].map(v => ({ label: v, value: v as UpDirection }))}
        />
      </div>
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input
          type="checkbox"
          checked={showWorldAxes}
          onChange={e => onShowWorldAxesChange(e.target.checked)}
          className="accent-blue-500"
        />
        <span className="text-gray-300 text-xs">World axes</span>
      </label>
      <label className="flex items-center gap-2 py-1 cursor-pointer">
        <input
          type="checkbox"
          checked={showParentLines}
          onChange={e => onShowParentLinesChange(e.target.checked)}
          className="accent-blue-500"
        />
        <span className="text-gray-300 text-xs">Parent lines</span>
      </label>
    </div>
  );
}
