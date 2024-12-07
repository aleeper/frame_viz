import { Pose } from "../types/Pose";

interface PositionQuaternionDisplayProps {
    label: string;
    pose: Pose;
}

export function PositionQuaternionDisplay({ pose, label }: PositionQuaternionDisplayProps) {
    return (
        <div className="text-sm text-gray-500 text-center space-y-1">
            <p>{label}</p>
            <p>{JSON.stringify(pose)}</p>
        </div>
    );
}
