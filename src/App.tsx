import React, { useCallback, useEffect, useState } from 'react';
import { JsonEditor } from './components/JsonEditor';
import { PoseVisualizer } from './components/PoseVisualizer';
import { RepresentationControl } from './components/RepresentationControl';
import { Pose, Poses } from './types/Pose';
import { LayoutGrid } from 'lucide-react';
import { Representation } from './types/Representation';
import { PoseDisplay } from './components/PoseDisplay';

const defaultPoses: Poses = [
  {
    name: "Origin",
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  },
  {
    name: "Pose 1",
    position: { x: 2, y: 0, z: 0 },
    quaternion: { x: 0, y: 0.383, z: 0, w: 0.924 }
  },
  {
    name: "Pose 2",
    position: { x: 0, y: 0, z: 2 },
    quaternion: { x: 0.383, y: 0, z: 0, w: 0.924 }
  }
];

function App() {
  const [poses, setPoses] = useState<Poses>(defaultPoses);
  const [representation, setRepresentation] = useState<Representation>("Quaternion");

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
          <RepresentationControl 
            value={representation} 
            onChange={setRepresentation} 
          />
        
        </div>
        
      </header>

      <main className="container mx-auto p-4 flex gap-4 h-[calc(100vh-5rem)]">
        <div className="w-1/3 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <JsonEditor
            value={poses}
            onChange={setPoses}
          />
        </div>
        <div className="w-1/3 bg-gray-800 rounded-lg shadow-lg space-y-2">
          <PoseVisualizer poses={poses} onChange={setPoses} />
        </div>
        <div className="w-1/3 bg-gray-800 rounded-lg shadow-lg space-y-2">
          <PoseDisplay poses={poses} representation={representation} />
        </div>
      </main>
    </div>
  );
}

export default App;