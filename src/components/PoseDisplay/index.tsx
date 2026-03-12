import type { ReactNode } from 'react';
import { Representation } from '../../types/Representation';
import { Poses } from '../../types/Pose';
import { MatrixDisplay } from './MatrixDisplay';
import { poseToTransformationMatrix } from '../../utils/matrixUtils';
import { PositionQuaternionDisplay } from './PositionQuaternionDisplay';
import { EulerAngleDisplay } from './EulerAngleDisplay';
import { PosePanelHeader } from './PosePanelHeader';

interface PoseDisplayProps {
  poses: Poses;
  representation: Representation;
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onRename?: (index: number, name: string | undefined) => void;
}

export function PoseDisplay({ poses, representation, onAdd, onRemove, onRename }: PoseDisplayProps) {
  return (
    <div className="text-sm text-gray-900 text-center space-y-1">
      {poses.map((pose, index) => {
        const fallbackLabel = `Pose ${index + 1}`;

        let display: ReactNode = null;
        if (representation === 'Matrix') {
          display = <MatrixDisplay matrix={poseToTransformationMatrix(pose)} />;
        } else if (representation === 'Quaternion') {
          display = <PositionQuaternionDisplay pose={pose} />;
        } else if (representation.startsWith('Euler')) {
          display = <EulerAngleDisplay pose={pose} representation={representation} />;
        }

        return (
          <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
            <PosePanelHeader
              poseName={pose.name}
              fallbackLabel={fallbackLabel}
              onRename={onRename ? (name) => onRename(index, name) : undefined}
              onRemove={onRemove ? () => onRemove(index) : undefined}
            />
            {display}
          </div>
        );
      })}

      {onAdd && (
        <button
          className="w-full border border-dashed border-gray-600 rounded-lg p-2 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          onClick={onAdd}
        >
          + Add Pose
        </button>
      )}
    </div>
  );
}
