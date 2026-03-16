import { DropdownControl } from '../DropdownControl';
import type { UpDirection } from '../../types/Representation';

interface OptionsPanelProps {
  upDirection: UpDirection;
  onUpDirectionChange: (dir: UpDirection) => void;
  showWorldAxes: boolean;
  onShowWorldAxesChange: (v: boolean) => void;
  showParentLines: boolean;
  onShowParentLinesChange: (v: boolean) => void;
  frameScale: number;
  onFrameScaleChange: (v: number) => void;
}

export function OptionsPanel({
  upDirection,
  onUpDirectionChange,
  showWorldAxes,
  onShowWorldAxesChange,
  showParentLines,
  onShowParentLinesChange,
  frameScale,
  onFrameScaleChange,
}: OptionsPanelProps) {
  return (
    <div className="p-3 space-y-2">
      {/* Up Direction */}
      <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
        <span className="text-gray-400 text-xs">Up direction</span>
        <DropdownControl
          id="up-direction"
          value={upDirection}
          onChange={onUpDirectionChange}
          options={["X", "Y", "Z"].map(v => ({ label: v, value: v as UpDirection }))}
        />
      </div>

      {/* Frame size */}
      <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
        <span className="text-gray-400 text-xs">Frame size</span>
        <div className="flex items-center gap-1 min-w-0">
          <input
            type="range"
            min="0.3"
            max="2.5"
            step="0.1"
            value={frameScale}
            onChange={e => onFrameScaleChange(parseFloat(e.target.value))}
            className="flex-1 min-w-0 accent-blue-500"
          />
          <span className="text-gray-400 text-xs w-6 shrink-0 text-right">{frameScale.toFixed(1)}</span>
        </div>
      </div>

      {/* Checkboxes */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showWorldAxes}
          onChange={e => onShowWorldAxesChange(e.target.checked)}
          className="accent-blue-500"
        />
        <span className="text-gray-400 text-xs">Tree root axes</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showParentLines}
          onChange={e => onShowParentLinesChange(e.target.checked)}
          className="accent-blue-500"
        />
        <span className="text-gray-400 text-xs">Parent lines</span>
      </label>
    </div>
  );
}
