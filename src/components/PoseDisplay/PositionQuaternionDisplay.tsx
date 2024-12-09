import { Pose } from "../../types/Pose";

interface PositionQuaternionDisplayProps {
    label?: string;
    pose: Pose;
}

export function PositionQuaternionDisplay({ pose, label }: PositionQuaternionDisplayProps) {
    const { position, quaternion } = pose;

    return (
      <div className="bg-white p-2 rounded-lg shadow-md">
        {label && <h3 className="text-lg font-semibold mb-2">{label}</h3>}
        <div className="flex space-x-8">
          {/* Quaternion Column */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1 text-center">Quaternion</h4>
            <table className="min-w-full border-collapse">
              <tbody>
                <tr>
                  <td className="px-2 py-0 text-right font-mono">x:</td>
                  <td className="px-2 py-0 text-right font-mono">{quaternion.x.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0 text-right font-mono">y:</td>
                  <td className="px-2 py-0 text-right font-mono">{quaternion.y.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0 text-right font-mono">z:</td>
                  <td className="px-2 py-0 text-right font-mono">{quaternion.z.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0 text-right font-mono">w:</td>
                  <td className="px-2 py-0 text-right font-mono">{quaternion.w.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Position Vector Column */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">Position</h4>
            <table className="min-w-full border-collapse">
              <tbody>
                <tr>
                  <td className="px-2 py-0 text-right font-mono">x:</td>
                  <td className="px-2 py-0 text-right font-mono">{position.x.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0 text-right font-mono">y:</td>
                  <td className="px-2 py-0 text-right font-mono">{position.y.toFixed(4)}</td>
                </tr>
                <tr>
                  <td className="px-2 py-0 text-right font-mono">z:</td>
                  <td className="px-2 py-0 text-right font-mono">{position.z.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  