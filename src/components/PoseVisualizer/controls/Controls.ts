import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import { TransformControls as CustomTransformControls } from './CustomTransformControls';
import { InteractionState } from '../types/InteractionState';

const CLICK_DEADBAND_PX = 5;

export class MyControls {
  private orbitControls: OrbitControls;
  private transformControls: Map<string, CustomTransformControls> = new Map();
  private camera: THREE.Camera;
  private domElement: HTMLElement;

  // The single control currently handling a drag (null when not dragging).
  private activeDragControl: CustomTransformControls | null = null;

  // Maps each TransformControl → its frame index in Scene.frames (for drag identification).
  private controlToFrameIndex = new Map<CustomTransformControls, number>();

  // Frame objects for hit-testing when gizmos are detached (Off mode).
  private frames: THREE.Object3D[] = [];
  private _frameRaycaster = new THREE.Raycaster();

  // Deadband tracking — used to distinguish a click from an orbit/drag.
  private _pointerDownClientX = 0;
  private _pointerDownClientY = 0;
  private _hasDragged = false;
  private _wasInteractionActiveAtPointerDown = false;
  private _frameHitAtPointerDown = false;

  // Set by Scene to reflect the current interaction mode.
  public interactionActive = false;

  // Class-level space so it persists across scene rebuilds (clearFrames/addFrame).
  private _space: 'local' | 'world' = 'local';

  // Called when a click on a frame should activate interaction mode.
  public onActivate: (() => void) | null = null;
  // Called when a click (no drag) should deactivate interaction mode.
  public onDeactivate: (() => void) | null = null;
  // Called once on pointer-up after a real drag completes (not a click).
  public onDragCommit: (() => void) | null = null;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.orbitControls = new OrbitControls(camera, domElement);
    this.setupOrbitControls();

    // Disable touch scrolling on the canvas (normally done by TransformControls.connect()).
    this.domElement.style.touchAction = 'none';

    // Single centralized pointer handlers. Individual TransformControls are
    // disconnected from the DOM so only this coordinator sees pointer events.
    this.domElement.addEventListener('pointermove', this._onPointerHover);
    this.domElement.addEventListener('pointermove', this._onPointerMove);
    this.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.domElement.addEventListener('pointerup', this._onPointerUp);
    // Class-level 's' handler — one listener, not one-per-control, so space
    // toggles exactly once per keypress and survives scene rebuilds.
    window.addEventListener('keydown', this._onSpaceKey);
  }

  // Toggle local/world space for all controls. A single handler ensures the
  // toggle fires once per keypress regardless of how many frames are in the scene.
  private _onSpaceKey = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== 's') return;
    this._space = this._space === 'local' ? 'world' : 'local';
    this.transformControls.forEach(c => c.setSpace(this._space));
  };

  public setSpace(space: 'local' | 'world') {
    this._space = space;
    this.transformControls.forEach(c => c.setSpace(space));
  }

  public registerFrameIndex(control: CustomTransformControls, index: number): void {
    this.controlToFrameIndex.set(control, index);
  }

  // Returns the frame index currently being dragged, or -1 if no drag is active.
  public getDraggedFrameIndex(): number {
    if (!this.activeDragControl) return -1;
    return this.controlToFrameIndex.get(this.activeDragControl) ?? -1;
  }

  public setFrames(frames: THREE.Object3D[]) {
    this.frames = frames;
  }

  // Replicates _getPointer from CustomTransformControls.
  private getPointer(event: PointerEvent) {
    if (this.domElement.ownerDocument.pointerLockElement) {
      return { x: 0, y: 0, button: event.button };
    }
    const rect = this.domElement.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      button: event.button,
    };
  }

  // Returns true if the pointer ray hits the hit-zone geometry of any frame.
  // Each frame has an invisible 'hitZone' group with sized cylinder meshes
  // that define the precise clickable region for each axis.
  private checkFrameHit(pointer: { x: number; y: number }): boolean {
    if (this.frames.length === 0) return false;
    this._frameRaycaster.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), this.camera);
    return this.frames.some(frame => {
      const hitZone = frame.getObjectByName('hitZone');
      if (!hitZone) return false;
      return this._frameRaycaster.intersectObject(hitZone, true).length > 0;
    });
  }

  // Hover: update axis highlight, but only for the closest hit control.
  private _onPointerHover = (event: PointerEvent) => {
    // Track movement for deadband — used in pointerUp to detect clicks vs drags.
    if (this._pointerDownClientX !== 0 || this._pointerDownClientY !== 0) {
      const dx = event.clientX - this._pointerDownClientX;
      const dy = event.clientY - this._pointerDownClientY;
      if (Math.sqrt(dx * dx + dy * dy) >= CLICK_DEADBAND_PX) {
        this._hasDragged = true;
      }
    }

    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    if (this.activeDragControl !== null) return; // mid-drag, skip hover

    const pointer = this.getPointer(event);

    // Let all controls evaluate the ray so we know who's hit.
    this.transformControls.forEach(c => c.pointerHover(pointer));

    const hitting = Array.from(this.transformControls.values())
      .filter(c => c.axis !== null);

    if (hitting.length <= 1) return;

    // More than one hit — keep highlight only on the closest frame.
    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    hitting.sort((a, b) => {
      const pa = new THREE.Vector3();
      const pb = new THREE.Vector3();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a as any).object?.getWorldPosition(pa);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b as any).object?.getWorldPosition(pb);
      return pa.distanceTo(camPos) - pb.distanceTo(camPos);
    });
    // Clear axis on losers — removes their hover highlight.
    hitting.slice(1).forEach(c => { c.axis = null; });
  };

  // Down: handle activation (Off mode) or drag start (active mode).
  private _onPointerDown = (event: PointerEvent) => {
    if (!document.pointerLockElement) {
      this.domElement.setPointerCapture(event.pointerId);
    }

    this._pointerDownClientX = event.clientX;
    this._pointerDownClientY = event.clientY;
    this._hasDragged = false;
    this._wasInteractionActiveAtPointerDown = this.interactionActive;

    const pointer = this.getPointer(event);

    if (!this.interactionActive) {
      // Record whether a frame was hit, but don't activate yet — wait for
      // pointer up so that orbit drags over a frame don't trigger activation.
      this._frameHitAtPointerDown = this.checkFrameHit(pointer);
      return;
    }

    // Interaction is active — re-run hover so axis state reflects the exact
    // click position, then pick the closest hit control and start a drag.
    this.transformControls.forEach(c => c.pointerHover(pointer));

    const hitting = Array.from(this.transformControls.values())
      .filter(c => c.axis !== null);

    if (hitting.length === 0) return;

    let winner = hitting[0];
    if (hitting.length > 1) {
      const camPos = new THREE.Vector3();
      this.camera.getWorldPosition(camPos);
      hitting.sort((a, b) => {
        const pa = new THREE.Vector3();
        const pb = new THREE.Vector3();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a as any).object?.getWorldPosition(pa);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (b as any).object?.getWorldPosition(pb);
        return pa.distanceTo(camPos) - pb.distanceTo(camPos);
      });
      winner = hitting[0];
    }

    winner.pointerDown(pointer);
    this.activeDragControl = winner;
  };

  // Move during drag: route only to the active control.
  private _onPointerMove = (event: PointerEvent) => {
    if (this.activeDragControl === null) return;
    this.activeDragControl.pointerMove(this.getPointer(event));
  };

  // Up: finish drag and detect clicks for mode toggling.
  private _onPointerUp = (event: PointerEvent) => {
    this.domElement.releasePointerCapture(event.pointerId);

    if (this.activeDragControl !== null) {
      this.activeDragControl.pointerUp(this.getPointer(event));
      if (this._hasDragged) {
        this.onDragCommit?.();
      }
      this.activeDragControl = null;
    }

    if (!this._hasDragged) {
      if (this._wasInteractionActiveAtPointerDown) {
        // Click while active → deactivate.
        this.onDeactivate?.();
      } else if (this._frameHitAtPointerDown) {
        // Click on a frame while inactive → activate.
        this.onActivate?.();
      }
    }

    this._pointerDownClientX = 0;
    this._pointerDownClientY = 0;
  };

  private setupOrbitControls() {
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.screenSpacePanning = false;
    this.orbitControls.minDistance = 1;
    this.orbitControls.maxDistance = 50;
    this.orbitControls.maxPolarAngle = Math.PI * 0.8;
  }

  public addTransformControl(
    camera: THREE.Camera,
    domElement: HTMLElement,
    object: THREE.Object3D,
    onChange: () => void
  ) {
    const control = new CustomTransformControls(camera, domElement);
    // Disconnect from DOM — this coordinator handles all pointer routing.
    control.disconnect();

    control.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
    });
    // Inherit the current class-level space so new controls match existing ones
    // after a scene rebuild (clearFrames/addFrame cycle).
    control.setSpace(this._space);
    control.setSize(0.8);

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case '+':
          control.setSize(Math.min(control.size + 0.1, 2));
          break;
        case '-':
          control.setSize(Math.max(control.size - 0.1, 0.5));
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const id = object.uuid;
    this.transformControls.set(id, control);

    control.addEventListener('change', onChange);
    return {
      control,
      cleanup: () => {
        window.removeEventListener('keydown', handleKeyDown);
        control.dispose();
        this.transformControls.delete(id);
        this.controlToFrameIndex.delete(control);
      },
    };
  }

  public update() {
    this.orbitControls.update();
  }

  public dispose() {
    this.domElement.removeEventListener('pointermove', this._onPointerHover);
    this.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.domElement.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('keydown', this._onSpaceKey);
    this.orbitControls.dispose();
    this.transformControls.forEach((control) => control.dispose());
    this.transformControls.clear();
  }
}
