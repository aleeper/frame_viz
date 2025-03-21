import React, { useEffect, useState } from 'react';
import { Representation } from '../../types/Representation';
import { Pose, Poses } from '../../types/Pose';
import { MatrixDisplay } from './MatrixDisplay';
import { poseToTransformationMatrix } from '../../utils/matrixUtils';
import { PositionQuaternionDisplay } from './PositionQuaternionDisplay';
import { EulerAngleDisplay } from './EulerAngleDisplay';

interface PoseDisplayProps {
    poses: Poses;
    representation: Representation;
}

export function PoseDisplay({ poses, representation }: PoseDisplayProps) {
    return (
        <div className="text-sm text-gray-900 text-center space-y-1">
            {
                poses.map((pose, index) => {
                    if (representation == "Matrix") {
                        return (
                            <MatrixDisplay
                                matrix={poseToTransformationMatrix(pose)}
                                label={pose.name} />
                        );
                    } else if (representation == "Quaternion") {
                        return (
                            <PositionQuaternionDisplay
                                pose={pose}
                                label={pose.name}
                            />
                        );
                    } else if (representation.startsWith("Euler")) {
                        return (
                            <EulerAngleDisplay
                                pose={pose}
                                representation={representation}
                                label={pose.name}
                            />
                        );
                    } else {
                        return null;
                    }
                })
            }
        </div>
    );
}