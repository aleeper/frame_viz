import React, { useCallback, useEffect, useState } from 'react';
import { JsonEditor } from './components/JsonEditor';
import { DropdownControl } from './components/DropdownControl';
import { PoseDisplay } from './components/PoseDisplay';
import { PoseVisualizer } from './components/PoseVisualizer';
import { Pose, Poses } from './types/Pose';
import { LayoutGrid } from 'lucide-react';
import { Representation, UpDirection } from './types/Representation';

const defaultPoses: Poses = [
  {
    name: "Pose1",
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  },
  {
    name: "Pose 2",
    position: { x: 2, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: -0.383, w: 0.924 }
  },
];

function App() {
  const [poses, setPoses] = useState<Poses>(defaultPoses);
  const [representation, setRepresentation] = useState<Representation>("Quaternion");
  const [upDirection, setUpDirection] = useState<UpDirection>("Z");

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        setPoses(defaultPoses); // Reset poses to ensure reinitialization.
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto flex items-center">
          <LayoutGrid className="w-6 h-6 mr-2" />
          <h1 className="text-xl font-bold">3D Pose Visualizer</h1>
          <div className="flex-grow"></div>
          <div className="w-64">
            <div className="flex items-center space-x-2">
              <p className="w-32 text-right">Representation: </p>
              <DropdownControl
                id="ADAM"
                value={representation}
                onChange={setRepresentation}
                options={
                  ["Quaternion", "Matrix"].map((item) => ({ label: item, value: item }))
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <p className="w-32 text-right">Up Direction: </p>
              <DropdownControl
                id="ADAM"
                value={upDirection}
                onChange={setUpDirection}
                options={
                  ["X", "Y", "Z"].map((item) => ({ label: item, value: item }))
                }
              />
            </div>
          </div>
        </div>

      </header>

      <main className="container mx-auto p-4 flex gap-4 h-[calc(100vh-5rem)]">
        {/* Column with JsonEditor and PoseDisplay */}
        <div className="flex flex-col w-1/4 bg-gray-800 rounded-lg shadow-lg overflow-hidden space-y-2">
          <div className="flex-1 bg-gray-800 rounded-lg shadow-lg">
            <JsonEditor value={poses} onChange={setPoses} />
          </div>
          <div className="flex-1 bg-gray-800 rounded-lg shadow-lg overflow-y-auto space-y-2">
            <PoseDisplay poses={poses} representation={representation} />
          </div>
        </div>

        {/* Middle Column */}
        <div className="w-3/4 bg-gray-800 rounded-lg shadow-lg space-y-2">
          <PoseVisualizer poses={poses} onChange={setPoses} upDirection={upDirection} />
        </div>
      </main>
    </div>
  );
}

export default App;