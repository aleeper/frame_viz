import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlatformProps } from './types/PlatformProps';
import { JsonEditor } from './components/JsonEditor';
import { DropdownControl } from './components/DropdownControl';
import { FrameList, ReparentMode } from './components/FrameList';
import { composePath, posesToMap, multiply, invert } from './utils/transforms';
import { PoseVisualizer } from './components/PoseVisualizer';
import { Poses } from './types/Pose';
import { LayoutGrid, Undo2, Redo2, FolderOpen, Settings } from 'lucide-react';
import { useUndoRedo } from './hooks/useUndoRedo';
import type { AppSnapshot } from './types/AppSnapshot';
import { Representation, UpDirection } from './types/Representation';
import { nanoid } from 'nanoid';
import type { PinnedExpression } from './types/PinnedExpression';
import { PinnedPanel } from './components/PinnedPanel';
import { ScenePanel } from './components/ScenePanel';
import { OptionsPanel } from './components/OptionsPanel';

const WORLD_ID = 'worldxxx';

const defaultPoses: Poses = [
  {
    id: WORLD_ID,
    name: 'World',
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  },
  {
    id: 'frame1xxx',
    name: "Frame 1",
    parent_id: WORLD_ID,
    position: { x: 0, y: 3, z: 1 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  },
  {
    id: 'frameAxxx',
    name: "Frame A",
    parent_id: WORLD_ID,
    position: { x: 2, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: -0.383, w: 0.924 },
  },
  {
    id: 'frameBxxx',
    name: "Frame B",
    parent_id: 'frameAxxx',
    position: { x: 1.5, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
  },
];

const defaultPinnedExpressions: PinnedExpression[] = [
  {
    id: 'pin1xxxx',
    base_frame_id: 'frame1xxx',
    target_frame_id: 'frameBxxx',
    kind: 'transform',
  },
];

function App({
  currentScene = null,
  initialSnapshot,
  readOnly = false,
  onSnapshotChange,
  onFork,
  renderSceneLibrary,
  renderSaveArea,
}: PlatformProps = {}) {
  const { snapshot, set, undo, redo, canUndo, canRedo } =
    useUndoRedo<AppSnapshot>(
      initialSnapshot ?? {
        version: 1,
        poses: defaultPoses,
        pinnedExpressions: defaultPinnedExpressions,
        view: { observer_frame_id: WORLD_ID },
      }
    );
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => {
    onSnapshotChange?.(snapshot);
  }, [snapshot, onSnapshotChange]);
  const [dragPoses, setDragPoses] = useState<Poses | null>(null);
  const poses = dragPoses ?? snapshot.poses;
  const effectiveObserverFrameId = (() => {
    const id = snapshot.view?.observer_frame_id;
    if (id && poses.some(p => p.id === id)) return id;
    return poses[0]?.id ?? '';
  })();
  const pinnedExpressions = snapshot.pinnedExpressions ?? [];
  const handleDragChange = useCallback((p: Poses) => setDragPoses(p), []);
  // Use snapshotRef so the callback stays stable across renders (no snapshot dep),
  // preventing PoseVisualizer's scene effect from re-running (clearFrames) when
  // unrelated snapshot fields change (e.g. a pin is added while a drag is live).
  const handleDragCommit = useCallback((p: Poses) => { set({ ...snapshotRef.current, poses: p }); setDragPoses(null); }, [set]);
  // Clear dragPoses on undo/redo: a sub-threshold drag (< deadband) can leave
  // dragPoses non-null, causing `poses = dragPoses` to shadow snapshot.poses and
  // making undo appear to do nothing.
  const handleUndo = useCallback(() => { setDragPoses(null); undo(); }, [undo]);
  const handleRedo = useCallback(() => { setDragPoses(null); redo(); }, [redo]);
  const handleJsonChange = useCallback((p: Poses) => set({ ...snapshotRef.current, poses: p }), [set]);
  const [representation, setRepresentation] = useState<Representation>("Matrix");
  const [upDirection, setUpDirection] = useState<UpDirection>("Z");
  const [viewMode, setViewMode] = useState<'panels' | 'yaml'>('panels');
  const [showWorldAxes, setShowWorldAxes] = useState(true);
  const [showParentLines, setShowParentLines] = useState(true);
  const [frameScale, setFrameScale] = useState(1.0);
  const [reparentMode, setReparentMode] = useState<ReparentMode>('preserve world');
  const [rightPanel, setRightPanel] = useState<'pinned' | 'scene' | 'options' | null>(
    renderSceneLibrary ? 'scene' : 'pinned'
  );
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const usedNames = new Set(poses.map(p => p.name));
    let i = 1;
    while (usedNames.has(`Frame ${i}`)) i++;
    set({ ...snapshot, poses: [...poses, {
      id: nanoid(8),
      name: `Frame ${i}`,
      parent_id: effectiveObserverFrameId || undefined,
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    }] });
  }, [snapshot, poses, set, effectiveObserverFrameId]);

  const handleSetObserver = useCallback((id: string) => {
    set({ ...snapshotRef.current, view: { observer_frame_id: id } });
  }, [set]);

  const handleRemove = useCallback((id: string) => {
    const newPoses = poses
      .filter(p => p.id !== id)
      .map(p => p.parent_id === id ? { ...p, parent_id: undefined } : p);

    const currentObserverId = snapshotRef.current.view?.observer_frame_id;
    const newObserverId =
      currentObserverId === id
        ? (newPoses[0]?.id ?? '')
        : (currentObserverId ?? newPoses[0]?.id ?? '');

    set({
      ...snapshotRef.current,
      poses: newPoses,
      view: { observer_frame_id: newObserverId },
    });
  }, [poses, set]);

  // Destructuring removes the `name` key entirely when clearing, so the
  // serialized JSON never contains `name: undefined` as an explicit property.
  const handleRename = useCallback((id: string, name: string | undefined) =>
    set({
      ...snapshot,
      poses: poses.map(pose => {
        if (pose.id !== id) return pose;
        const { name: _removed, ...rest } = pose;
        return name !== undefined ? { ...rest, name } : rest;
      }),
    }), [snapshot, poses, set]);

  const handleSetParent = useCallback((id: string, newParentId: string | undefined) => {
    set({
      ...snapshot,
      poses: poses.map(pose => {
        if (pose.id !== id) return pose;

        if (reparentMode === 'preserve world') {
          try {
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
          } catch {
            // parent chain is broken (e.g. parent_id set to a name via YAML instead of an id) —
            // fall through to preserve-numbers behaviour so the operation still completes
          }
        }

        // preserve numbers (also fallback when preserve world chain is broken)
        return newParentId !== undefined
          ? { ...pose, parent_id: newParentId }
          : (() => { const { parent_id: _removed, ...rest } = pose; return rest; })();
      }),
    });
  }, [snapshot, poses, set, reparentMode]);

  const handleLoadScene = useCallback((newSnapshot: AppSnapshot) => {
    set(newSnapshot);
    setDragPoses(null);
  }, [set]);

  const handleAddPin = useCallback((expr: PinnedExpression) =>
    set({ ...snapshot, pinnedExpressions: [...pinnedExpressions, expr] }),
    [snapshot, set, pinnedExpressions]);

  const handleRemovePin = useCallback((id: string) =>
    set({ ...snapshot, pinnedExpressions: pinnedExpressions.filter(e => e.id !== id) }),
    [snapshot, set, pinnedExpressions]);

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        set({ version: 1, poses: defaultPoses, pinnedExpressions: defaultPinnedExpressions, view: { observer_frame_id: WORLD_ID } });
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if      (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      else if (mod && e.shiftKey  && e.key.toLowerCase() === 'z') { e.preventDefault(); handleRedo(); }
      else if (mod && !e.shiftKey && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto flex items-center">
          <LayoutGrid className="w-6 h-6 mr-2" />
          <h1 className="text-xl font-bold">3D Pose Visualizer</h1>
          {readOnly && (
            <span className="ml-3 text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
              View only
            </span>
          )}
          <div className="flex-grow"></div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              aria-disabled={!canUndo}
              aria-label="Undo"
              className={`p-1.5 rounded transition-colors ${canUndo ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              aria-disabled={!canRedo}
              aria-label="Redo"
              className={`p-1.5 rounded transition-colors ${canRedo ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 cursor-not-allowed'}`}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          {renderSaveArea && (
            <div className="ml-4 flex items-center">
              {renderSaveArea()}
            </div>
          )}

        </div>

      </header>

      <main className="p-4 flex gap-4 h-[calc(100vh-5rem)]">
        {/* Left column */}
        <div className="flex flex-col w-80 bg-gray-800 rounded-lg shadow-lg overflow-hidden shrink-0">
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
                    <option value="preserve numbers">preserve numbers</option>
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
                observerFrameId={effectiveObserverFrameId}
                selectedId={selectedFrameId}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onRename={handleRename}
                onSetParent={handleSetParent}
                onSelect={setSelectedFrameId}
              />
            </div>
          )}

        </div>

        {/* Middle Column */}
        <div className="flex-1 min-w-0 overflow-hidden bg-gray-800 rounded-lg shadow-lg relative">
          <PoseVisualizer
            poses={poses}
            onChange={readOnly ? undefined : handleDragChange}
            onChangeCommit={readOnly ? undefined : handleDragCommit}
            upDirection={upDirection}
            showWorldAxes={showWorldAxes}
            showParentLines={showParentLines}
            frameScale={frameScale}
            observerFrameId={effectiveObserverFrameId}
            selectedFrameId={selectedFrameId}
            onSelectFrame={setSelectedFrameId}
            onDeselect={() => setSelectedFrameId(null)}
          />
          {/* Observer overlay — top-left of 3D viewport */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-gray-900 bg-opacity-75 rounded-lg px-2 py-1">
            <span className="text-xs text-gray-400 shrink-0">Observer</span>
            <select
              className="text-xs bg-transparent text-white border-none outline-none cursor-pointer"
              value={effectiveObserverFrameId}
              onChange={e => handleSetObserver(e.target.value)}
            >
              {poses.map(p => (
                <option key={p.id} value={p.id} className="bg-gray-900">{p.name ?? p.id}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right panel */}
        {rightPanel !== null && (
          <div className="w-56 bg-gray-800 rounded-lg shadow-lg flex flex-col overflow-hidden shrink-0">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">
                {rightPanel === 'pinned' ? 'Pinned' : rightPanel === 'scene' ? 'Scene' : 'Options'}
              </span>
              <button
                className="text-gray-500 hover:text-white text-xs"
                onClick={() => setRightPanel(null)}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {rightPanel === 'pinned' && (
                <PinnedPanel
                  poses={poses}
                  pinnedExpressions={pinnedExpressions}
                  representation={representation}
                  onAdd={handleAddPin}
                  onRemove={handleRemovePin}
                />
              )}
              {rightPanel === 'scene' && (
                renderSceneLibrary ? renderSceneLibrary() : (
                  <ScenePanel
                    snapshot={snapshot}
                    onLoad={handleLoadScene}
                  />
                )
              )}
              {rightPanel === 'options' && (
                <OptionsPanel
                  upDirection={upDirection}
                  onUpDirectionChange={setUpDirection}
                  showWorldAxes={showWorldAxes}
                  onShowWorldAxesChange={setShowWorldAxes}
                  showParentLines={showParentLines}
                  onShowParentLinesChange={setShowParentLines}
                  frameScale={frameScale}
                  onFrameScaleChange={setFrameScale}
                />
              )}
            </div>
          </div>
        )}

        {/* Activity bar */}
        <div className="w-8 bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex flex-col items-center py-2 gap-1 shrink-0">
          <button
            title="Load / save scene"
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors
              ${rightPanel === 'scene' ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-200'}`}
            onClick={() => setRightPanel(p => p === 'scene' ? null : 'scene')}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            title="Scene options"
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors
              ${rightPanel === 'options' ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-200'}`}
            onClick={() => setRightPanel(p => p === 'options' ? null : 'options')}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            title="Pinned expressions"
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors
              ${rightPanel === 'pinned' ? 'bg-gray-700 text-blue-400' : 'text-gray-500 hover:text-gray-200'}`}
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