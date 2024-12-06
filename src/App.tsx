import React, { useState } from 'react';
import { JsonEditor } from './components/JsonEditor';
import { PoseVisualizer } from './components/PoseVisualizer';
import { Pose } from './types/Pose';
import { LayoutGrid } from 'lucide-react';

const defaultPoses: Pose[] = [
  {
    name: "Origin",
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  },
  {
    name: "Pose 1",
    position: { x: 2, y: 0, z: 0 },
    quaternion: { x: 0, y: 0.383, z: 0, w: 0.924 }
  }
];

function App() {
  const [poses, setPoses] = useState<Pose[]>(defaultPoses);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto flex items-center">
          <LayoutGrid className="w-6 h-6 mr-2" />
          <h1 className="text-xl font-bold">3D Pose Visualizer</h1>
        </div>
      </header>
      
      <main className="container mx-auto p-4 flex gap-4 h-[calc(100vh-5rem)]">
        <div className="w-1/3 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <JsonEditor
            value={JSON.stringify(poses, null, 2)}
            onChange={setPoses}
          />
        </div>
        <div className="w-2/3 bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <PoseVisualizer poses={poses} />
        </div>
      </main>
    </div>
  );
}

export default App;