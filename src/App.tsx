import { useCallback, useEffect, useState } from 'react';
import { JsonEditor } from './components/JsonEditor';
import { DropdownControl } from './components/DropdownControl';
import { FrameList, ReparentMode } from './components/FrameList';
import { composePath, posesToMap, multiply, invert } from './utils/transforms';
import { PoseVisualizer } from './components/PoseVisualizer';
import { Poses } from './types/Pose';
import { LayoutGrid, Undo2, Redo2 } from 'lucide-react';
import { useUndoRedo } from './hooks/useUndoRedo';
import type { AppSnapshot } from './types/AppSnapshot';
import { Representation, UpDirection } from './types/Representation';
import { nanoid } from 'nanoid';

const defaultPoses: Poses = [
  {
    id: 'pose1aaa',
    name: "Pose1",
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  },
  {
    id: 'pose2bbb',
    name: "Pose 2",
    position: { x: 2, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: -0.383, w: 0.924 }
  },
];

function App() {
  const { snapshot, set, undo, redo, canUndo, canRedo } =
    useUndoRedo<AppSnapshot>({ poses: defaultPoses });
  const [dragPoses, setDragPoses] = useState<Poses | null>(null);
  const poses = dragPoses ?? snapshot.poses;
  const handleDragChange = useCallback((p: Poses) => setDragPoses(p), []);
  const handleDragCommit = useCallback((p: Poses) => { set({ poses: p }); setDragPoses(null); }, [set]);
  const handleJsonChange = useCallback((p: Poses) => set({ poses: p }), [set]);
  const [representation, setRepresentation] = useState<Representation>("Matrix");
  const [upDirection, setUpDirection] = useState<UpDirection>("Z");
  const [viewMode, setViewMode] = useState<'panels' | 'yaml'>('panels');
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [reparentMode, setReparentMode] = useState<ReparentMode>('preserve world');
  const [rightPanel, setRightPanel] = useState<'pinned' | null>(null);

  const handleAdd = useCallback(() => {
    const usedNames = new Set(poses.map(p => p.name));
    let i = 1;
    while (usedNames.has(`Frame ${i}`)) i++;
    set({ ...snapshot, poses: [...poses, {
      id: nanoid(8),
      name: `Frame ${i}`,
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    }] });
  }, [snapshot, poses, set]);

  const handleRemove = useCallback((id: string) => {
    set({
      poses: poses
        .filter(p => p.id !== id)
        .map(p => p.parent_id === id ? { ...p, parent_id: undefined } : p),
    });
  }, [poses, set]);

  // Destructuring removes the `name` key entirely when clearing, so the
  // serialized JSON never contains `name: undefined` as an explicit property.
  const handleRename = useCallback((id: string, name: string | undefined) =>
    set({
      poses: poses.map(pose => {
        if (pose.id !== id) return pose;
        const { name: _removed, ...rest } = pose;
        return name !== undefined ? { ...rest, name } : rest;
      }),
    }), [poses, set]);

  const handleSetParent = useCallback((id: string, newParentId: string | undefined) => {
    set({
      poses: poses.map(pose => {
        if (pose.id !== id) return pose;

        if (reparentMode === 'preserve world') {
          const frameMap = posesToMap(poses);
          const global_T_frame = composePath(id, frameMap);

          if (newParentId !== undefined) {
            const global_T_new_parent = composePath(newParentId, frameMap);
            const new_parent_T_frame = multiply(invert(global_T_new_parent), global_T_frame);
            return {
              ...pose,
              parent_id: newParentId,
              position: new_parent_T_frame.position,
              quaternion: new_parent_T_frame.quaternion,
            };
          } else {
            const { parent_id: _removed, ...rest } = pose;
            return {
              ...rest,
              position: global_T_frame.position,
              quaternion: global_T_frame.quaternion,
            };
          }
        }

        // preserve local
        return newParentId !== undefined
          ? { ...pose, parent_id: newParentId }
          : (() => { const { parent_id: _removed, ...rest } = pose; return rest; })();
      }),
    });
  }, [poses, set, reparentMode]);

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        set({ poses: defaultPoses }); // Reset poses to ensure reinitialization.
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if      (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      else if (mod && e.shiftKey  && e.key.toLowerCase() === 'z') { e.preventDefault(); redo(); }
      else if (mod && !e.shiftKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto flex items-center">
          <LayoutGrid className="w-6 h-6 mr-2" />
          <h1 className="text-xl font-bold">3D Pose Visualizer</h1>
          <div className="flex-grow"></div>
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              aria-disabled={!canUndo}
              aria-label="Undo"
              className={`p-1.5 rounded transition-colors ${canUndo ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              aria-disabled={!canRedo}
              aria-label="Redo"
              className={`p-1.5 rounded transition-colors ${canRedo ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

        </div>

      </header>

      <main className="p-4 flex gap-4 h-[calc(100vh-5rem)]">
        {/* Left column */}
        <div className="flex flex-col w-80 bg-gray-800 rounded-lg shadow-lg overflow-hidden shrink-0">
          {/* Scene Options */}
          <div className="shrink-0 px-2 pt-2 pb-1">
            <div className="bg-gray-700 rounded-lg overflow-hidden">
              <div className="px-2 py-1 border-b border-gray-600">
                <span className="text-gray-300 text-xs font-semibold uppercase tracking-wide">Scene Options</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <p className="text-gray-300 text-xs shrink-0">Up Direction</p>
                <DropdownControl
                  id="up-direction"
                  value={upDirection}
                  onChange={setUpDirection}
                  options={["X", "Y", "Z"].map((item) => ({ label: item, value: item }))}
                />
              </div>
              <label className="flex items-center gap-2 px-2 py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWorldAxes}
                  onChange={e => setShowWorldAxes(e.target.checked)}
                  className="accent-blue-500"
                />
                <span className="text-gray-300 text-xs">World axes</span>
              </label>
            </div>
          </div>

          {/* Toggle + settings bar */}
          <div className="flex flex-col gap-1 px-2 pb-1 shrink-0">
            <div className="flex bg-gray-700 rounded p-0.5">
              <button
                className={`flex-1 text-xs py-1 rounded transition-colors ${viewMode === 'panels' ? 'bg-gray-500 text-white' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setViewMode('panels')}
              >Panels</button>
              <button
                className={`flex-1 text-xs py-1 rounded transition-colors ${viewMode === 'yaml' ? 'bg-gray-500 text-white' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setViewMode('yaml')}
              >YAML</button>
            </div>
            {viewMode === 'panels' && (
              <>
                <div className="flex items-center space-x-2">
                  <p className="w-32 text-right text-xs">Representation: </p>
                  <DropdownControl
                    id="representation"
                    value={representation}
                    onChange={setRepresentation}
                    options={
                      ["Quaternion", "Matrix", "Euler (Body ZYX)", "Euler (World XYZ)"].map((item) => ({ label: item, value: item }))
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <p className="w-32 text-right text-xs">Re-parent: </p>
                  <select
                    className="text-xs border border-gray-600 rounded bg-gray-700 text-white px-1 py-0.5"
                    value={reparentMode}
                    onChange={e => setReparentMode(e.target.value as ReparentMode)}
                  >
                    <option value="preserve world">preserve world</option>
                    <option value="preserve local">preserve local</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Main content area */}
          {viewMode === 'yaml' ? (
            <div className="flex-1 overflow-hidden">
              <JsonEditor value={poses} onChange={handleJsonChange} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              <FrameList
                poses={poses}
                representation={representation}
                reparentMode={reparentMode}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onRename={handleRename}
                onSetParent={handleSetParent}
              />
            </div>
          )}

        </div>

        {/* Middle Column */}
        <div className="flex-1 min-w-0 bg-gray-800 rounded-lg shadow-lg space-y-2">
          <PoseVisualizer
            poses={poses}
            onChange={handleDragChange}
            onChangeCommit={handleDragCommit}
            upDirection={upDirection}
            showWorldAxes={showWorldAxes}
          />
        </div>

        {/* Right panel (Spec D content goes here) */}
        {rightPanel !== null && (
          <div className="w-48 bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">
                {rightPanel === 'pinned' ? 'Pinned' : rightPanel}
              </span>
              <button
                className="text-gray-500 hover:text-white text-xs"
                onClick={() => setRightPanel(null)}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 p-2 text-xs text-gray-500 italic">
              Coming in Spec D…
            </div>
          </div>
        )}

        {/* Activity bar */}
        <div className="w-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex flex-col items-center py-2 gap-1 shrink-0">
          <button
            title="Pinned expressions"
            className={`w-6 h-6 flex items-center justify-center rounded text-sm transition-colors
              ${rightPanel === 'pinned'
                ? 'bg-gray-700 text-blue-400'
                : 'text-gray-500 hover:text-gray-200'}`}
            onClick={() => setRightPanel(p => p === 'pinned' ? null : 'pinned')}
          >
            ⇄
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;