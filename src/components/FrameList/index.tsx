import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pose, Poses } from '../../types/Pose';
import { Representation } from '../../types/Representation';
import { MatrixDisplay } from '../PoseDisplay/MatrixDisplay';
import { PositionQuaternionDisplay } from '../PoseDisplay/PositionQuaternionDisplay';
import { EulerAngleDisplay } from '../PoseDisplay/EulerAngleDisplay';
import { poseToTransformationMatrix } from '../../utils/matrixUtils';
import { buildDisplayList, getValidParents, PANEL_MAX_INDENT_DEPTH } from './frameTreeUtils';

export type ReparentMode = 'preserve world' | 'preserve numbers';

interface FrameListProps {
  poses: Poses;
  representation: Representation;
  reparentMode: ReparentMode;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, name: string | undefined) => void;
  onSetParent?: (id: string, parentId: string | undefined) => void;
}

export function FrameList({
  poses,
  representation,
  reparentMode,
  onAdd,
  onRemove,
  onRename,
  onSetParent,
}: FrameListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const displayList = buildDisplayList(poses);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="text-sm text-gray-100 space-y-0.5">
      {displayList.map(({ pose, depth }) => {
        const isExpanded = expandedIds.has(pose.id);
        const displayName = pose.name ?? pose.id;
        const visualDepth = Math.min(depth, PANEL_MAX_INDENT_DEPTH);
        const showBadge = depth > PANEL_MAX_INDENT_DEPTH;
        const parentPose = poses.find(p => p.id === pose.parent_id);
        const parentName = parentPose?.name ?? parentPose?.id;

        return (
          <div
            key={pose.id}
            style={{ marginLeft: `${visualDepth * 14}px` }}
          >
            {/* Row header */}
            <div
              className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 border border-gray-700"
              onClick={() => toggleExpand(pose.id)}
            >
              <span className="text-gray-400 text-xs w-3">{isExpanded ? '▼' : '▶'}</span>
              <span className="flex-1 font-medium text-gray-100 truncate">{displayName}</span>
              {showBadge && parentName && (
                <span className="text-xs bg-gray-600 text-blue-300 px-1.5 py-0.5 rounded shrink-0">
                  ↳ {parentName}
                </span>
              )}
              {onRemove && (
                <button
                  className="text-gray-400 hover:text-red-500 text-xs px-1 shrink-0"
                  onClick={e => { e.stopPropagation(); onRemove(pose.id); }}
                  aria-label={`Remove ${displayName}`}
                >
                  ×
                </button>
              )}
            </div>

            {/* Expanded panel */}
            {isExpanded && (
              <div className="mt-0.5 ml-3 bg-gray-700 border border-gray-600 rounded p-2 space-y-2">
                {/* Name editor */}
                {onRename && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 w-10 shrink-0">Name</span>
                    <input
                      className="flex-1 text-xs border border-gray-600 rounded px-1 py-0.5 bg-gray-800 text-white"
                      value={pose.name ?? ''}
                      placeholder={pose.id}
                      onChange={e => onRename(pose.id, e.target.value || undefined)}
                    />
                  </div>
                )}

                {/* Parent picker */}
                {onSetParent && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 w-10 shrink-0">Parent</span>
                    <select
                      className="flex-1 text-xs border border-gray-600 rounded px-1 py-0.5 bg-gray-700 text-white"
                      value={pose.parent_id ?? ''}
                      onChange={e => onSetParent(pose.id, e.target.value || undefined)}
                    >
                      <option value="">none (global)</option>
                      {getValidParents(pose.id, poses).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name ?? p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Re-parent mode info */}
                {onSetParent && (
                  <div className="text-xs text-gray-400">
                    Re-parent mode: <span className="text-blue-500">{reparentMode}</span>
                  </div>
                )}

                {/* Pose label */}
                <div className="text-xs text-gray-300 mb-1">
                  {pose.parent_id ? (
                    <span className="font-mono">
                      {(poses.find(p => p.id === pose.parent_id)?.name ?? pose.parent_id)}_T_{pose.name ?? pose.id}
                    </span>
                  ) : (
                    <span className="font-mono">global_T_{pose.name ?? pose.id}</span>
                  )}
                </div>
                {renderPoseData(pose, representation, pose.name ?? pose.id, parentName ?? 'global')}
              </div>
            )}
          </div>
        );
      })}

      {onAdd && (
        <button
          className="w-full border border-dashed border-gray-500 rounded px-2 py-1.5 text-gray-400 hover:text-white hover:border-gray-300 transition-colors text-xs"
          onClick={onAdd}
        >
          + Add Frame
        </button>
      )}
    </div>
  );
}

function renderPoseData(pose: Pose, representation: Representation, childName?: string, parentName?: string): ReactNode {
  if (representation === 'Matrix') {
    return <MatrixDisplay matrix={poseToTransformationMatrix(pose)} childName={childName} parentName={parentName} />;
  } else if (representation === 'Quaternion') {
    return <PositionQuaternionDisplay pose={pose} />;
  } else if (representation.startsWith('Euler')) {
    return <EulerAngleDisplay pose={pose} representation={representation} />;
  }
  return null;
}
