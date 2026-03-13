import { useState } from 'react';
import { nanoid } from 'nanoid';
import { PinnedExpression } from '../types/PinnedExpression';
import { Poses } from '../types/Pose';
import { Representation } from '../types/Representation';
import { composePath, posesToMap, multiply, invert } from '../utils/transforms';
import { poseToTransformationMatrix } from '../utils/matrixUtils';
import { MatrixDisplay } from './PoseDisplay/MatrixDisplay';
import { PositionQuaternionDisplay } from './PoseDisplay/PositionQuaternionDisplay';
import { EulerAngleDisplay } from './PoseDisplay/EulerAngleDisplay';
import type { Pose } from '../types/Pose';
import type { ReactNode } from 'react';

interface PinnedPanelProps {
  poses: Poses;
  pinnedExpressions: PinnedExpression[];
  representation: Representation;
  onAdd: (expr: PinnedExpression) => void;
  onRemove: (id: string) => void;
}

export function PinnedPanel({
  poses,
  pinnedExpressions,
  representation,
  onAdd,
  onRemove,
}: PinnedPanelProps) {
  const [addMode, setAddMode] = useState(false);
  const [baseId, setBaseId] = useState('');
  const [targetId, setTargetId] = useState('');

  const frameMap = posesToMap(poses);

  const handleAdd = () => {
    if (!baseId || !targetId) return;
    onAdd({ id: nanoid(8), base_frame_id: baseId, target_frame_id: targetId, kind: 'transform' });
    setAddMode(false);
    setBaseId('');
    setTargetId('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Pinned entries list */}
      <div className="flex-1 overflow-y-auto space-y-2 p-2">
        {pinnedExpressions.length === 0 && (
          <p className="text-xs text-gray-500 italic">No pinned expressions yet.</p>
        )}
        {pinnedExpressions.map(expr => (
          <PinnedEntry
            key={expr.id}
            expr={expr}
            poses={poses}
            frameMap={frameMap}
            representation={representation}
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* Add form */}
      <div className="border-t border-gray-700 p-2 shrink-0">
        {addMode ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 w-8 shrink-0">Base</span>
              <select
                className="flex-1 text-xs bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white"
                value={baseId}
                onChange={e => setBaseId(e.target.value)}
              >
                <option value="">— pick —</option>
                {poses.map(p => (
                  <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 w-8 shrink-0">Target</span>
              <select
                className="flex-1 text-xs bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-white"
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
              >
                <option value="">— pick —</option>
                {poses.map(p => (
                  <option key={p.id} value={p.id}>{p.name ?? p.id}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1 justify-end">
              <button
                className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                onClick={() => setAddMode(false)}
              >
                Cancel
              </button>
              <button
                className="text-xs px-2 py-0.5 rounded bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-40"
                onClick={handleAdd}
                disabled={!baseId || !targetId}
              >
                Pin
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full text-xs text-green-400 hover:text-green-300 py-0.5"
            onClick={() => setAddMode(true)}
          >
            + Pin expression
          </button>
        )}
      </div>
    </div>
  );
}

interface PinnedEntryProps {
  expr: PinnedExpression;
  poses: Poses;
  frameMap: Map<string, Pose>;
  representation: Representation;
  onRemove: (id: string) => void;
}

function toFrameLabel(name: string): string {
  if (name.includes(' ')) return name.toLowerCase().replace(/\s+/g, '_');
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function PinnedEntry({ expr, poses, frameMap, representation, onRemove }: PinnedEntryProps) {
  const baseFrame = poses.find(p => p.id === expr.base_frame_id);
  const targetFrame = poses.find(p => p.id === expr.target_frame_id);

  const missingBase = !baseFrame;
  const missingTarget = !targetFrame;
  const hasError = missingBase || missingTarget;

  const [collapsed, setCollapsed] = useState(false);

  const baseName = toFrameLabel(baseFrame?.name ?? expr.base_frame_id);
  const targetName = toFrameLabel(targetFrame?.name ?? expr.target_frame_id);
  const label = `${baseName}_T_${targetName}`;

  // Compute: base_T_target = invert(global_T_base) × global_T_target
  let computedPose: Pose | null = null;
  if (!hasError) {
    try {
      const global_T_base = composePath(expr.base_frame_id, frameMap);
      const global_T_target = composePath(expr.target_frame_id, frameMap);
      computedPose = multiply(invert(global_T_base), global_T_target);
    } catch {
      // dangling refs — treated as error state
    }
  }

  return (
    <div className={`rounded border p-2 space-y-1 ${hasError ? 'border-yellow-800 bg-yellow-950' : 'border-gray-700 bg-gray-900'}`}>
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1 flex-1 min-w-0 text-left"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        >
          <span className="text-gray-500 text-xs w-3 shrink-0">{collapsed ? '▶' : '▼'}</span>
          <span className={`font-mono text-xs font-bold truncate ${hasError ? 'text-yellow-500' : 'text-blue-400'}`}>
            {label}
          </span>
        </button>
        <button
          className="text-gray-500 hover:text-red-400 text-xs shrink-0 ml-1"
          onClick={() => onRemove(expr.id)}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      </div>

      {!collapsed && (
        <>
          {hasError ? (
            <p className="text-xs text-yellow-600">
              ⚠ frame not found
              {missingBase ? ` (base: ${expr.base_frame_id})` : ''}
              {missingTarget ? ` (target: ${expr.target_frame_id})` : ''}
            </p>
          ) : computedPose ? (
            <div className="text-xs">
              {renderPinnedValue(computedPose, representation)}
            </div>
          ) : (
            <p className="text-xs text-red-500">⚠ computation error</p>
          )}
        </>
      )}
    </div>
  );
}

function renderPinnedValue(pose: Pose, representation: Representation): ReactNode {
  if (representation === 'Matrix') {
    return <MatrixDisplay matrix={poseToTransformationMatrix(pose)} />;
  } else if (representation === 'Quaternion') {
    return <PositionQuaternionDisplay pose={pose} />;
  } else if (representation.startsWith('Euler')) {
    return <EulerAngleDisplay pose={pose} representation={representation} />;
  }
  return null;
}
