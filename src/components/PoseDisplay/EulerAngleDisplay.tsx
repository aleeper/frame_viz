import * as THREE from 'three';
import React from 'react';
import { Pose } from '../types/Pose';
import { Representation } from '../../types/Representation';

interface EulerAngleDisplayProps {
    pose: Pose;
    representation: Representation;
    label?: string;
}

function quaternionToEuler(
    quaternion: { x: number; y: number; z: number; w: number },
    representation: Representation
) {
    const { x, y, z, w } = quaternion;
    const threeQuaternion = new THREE.Quaternion(x, y, z, w);
    const order = "ZYX";
    const euler = new THREE.Euler();
    euler.setFromQuaternion(threeQuaternion, order);

    // Note that body ZYX is the same as space-fixed XYZ.
    // Could do more robust logic here if we expand to other allowed rotation orders.
    return representation === "Euler (Body ZYX)" ?
        { roll: euler.x, pitch: euler.y, yaw: euler.z } :
        { roll: euler.z, pitch: euler.y, yaw: euler.x };
}


export function EulerAngleDisplay({ pose, representation, label }: EulerAngleDisplayProps) {
    const { quaternion } = pose;

    // Convert quaternion to Euler angles based on representation
    const euler = quaternionToEuler(quaternion, representation);
    let contents = [];
    switch (representation) {
        case "Euler (Body ZYX)":
            contents = [
                {name: "Yaw (Body Z)", value: euler.yaw.toFixed(4)},
                {name: "Pitch (Body Y)", value: euler.pitch.toFixed(4)},
                {name: "Roll (Body X)", value: euler.roll.toFixed(4)},
            ]
            break;
        case "Euler (World XYZ)":
            // This is not backwards, it's correct -- three.js uses local rotations,
            // so to get world rotations we just reverse the order of the angles.
            contents = [
                {name: "Roll (World X)", value: euler.yaw.toFixed(4)},
                {name: "Pitch (World Y)", value: euler.pitch.toFixed(4)},
                {name: "Yaw (World Z)", value: euler.roll.toFixed(4)},
            ]
            break;
        default:
            return (null);
    }

    return (
        <div className="bg-white p-2 rounded-lg shadow-md">
            {label && <h3 className="text-sm font-semibold text-gray-700 mb-2">{label}</h3>}
            <table className="min-w-full border-collapse">
                <tbody>
                    <tr>
                        <td className="px-2 py-1 text-right font-mono">{contents[0].name}:</td>
                        <td className="px-2 py-1 text-right font-mono">{contents[0].value}</td>
                    </tr>
                    <tr>
                        <td className="px-2 py-1 text-right font-mono">{contents[1].name}:</td>
                        <td className="px-2 py-1 text-right font-mono">{contents[1].value}</td>
                    </tr>
                    <tr>
                        <td className="px-2 py-1 text-right font-mono">{contents[2].name}:</td>
                        <td className="px-2 py-1 text-right font-mono">{contents[2].value}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
