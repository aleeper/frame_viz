// src/types/PlatformProps.ts
import type { AppSnapshot } from './AppSnapshot'

export interface CurrentScene {
  id: string
  title: string
  version: number
}

export interface PlatformProps {
  /**
   * Current scene identity. null means the scene is new/unsaved.
   * When this changes (different id), the platform re-mounts App with a new key
   * so undo history resets cleanly.
   */
  currentScene?: CurrentScene | null

  /**
   * Initial snapshot to load. Pass the scene's stored snapshot when loading
   * a saved scene. Becomes the initial state for useUndoRedo.
   */
  initialSnapshot?: AppSnapshot

  /** Disables all editing controls; shows a "View only" badge. */
  readOnly?: boolean

  /**
   * Called whenever the snapshot changes (every edit, including during drag).
   * The platform layer debounces this and persists when appropriate.
   */
  onSnapshotChange?: (snapshot: AppSnapshot) => void

  /**
   * Called when the user explicitly forks a read-only scene.
   * Only relevant when readOnly=true.
   */
  onFork?: (snapshot: AppSnapshot) => Promise<void>

  /**
   * When provided, replaces the ScenePanel (file import/export) in the right panel.
   * The platform renders its scene library here.
   */
  renderSceneLibrary?: () => React.ReactNode

  /**
   * When provided, rendered in the header alongside the title.
   * The platform renders its save area (title input, save status, conflict banner) here.
   */
  renderSaveArea?: () => React.ReactNode
}
