import * as THREE from 'three';
import { MyControls } from './controls/Controls';
import { TransformControls } from './controls/CustomTransformControls';
import { UpDirection } from '../../types/Representation';
import { createBaseAxes } from './utils';
import { InteractionState } from './types/InteractionState';

interface ParentLine {
  line: THREE.Line;
  childIndex: number;
  parentIndex: number;
}

// Saved camera state used to restore position/orientation after scene recreation.
export interface CameraState {
  position: THREE.Vector3;
  up: THREE.Vector3;
  target: THREE.Vector3;
}

interface UpAnimState {
  startTime: number;
  orbitTarget: THREE.Vector3;
  // Phase 1 (optional): azimuthal sidestep when camera is within 10° of the pole.
  // The camera slides ±20° around the *old* up axis, then Phase 2 rolls camera.up.
  // phase1End === 0 means phase 1 is skipped.
  phase1End: number;
  phase1CurrentUp: THREE.Vector3; // old up direction (normalized)
  phase1CamDir0: THREE.Vector3;   // initial camera direction from orbitTarget (normalized)
  phase1CamDist: number;
  phase1AzimuthDelta: number;     // total azimuthal rotation (±20° in radians)
  // Phase 2: slerp camera.up (full phase 2 duration, linear).
  phase2End: number;   // ms from startTime
  upQuat0: THREE.Quaternion;
  upQuat1: THREE.Quaternion;
  // Grid: slerps from gridQuat0 → gridQuat1 over its own independent window.
  // gridEnd may extend past phase2End; onUpAnimComplete fires at max(phase2End, gridEnd).
  gridAnimStart: number;  // ms from startTime
  gridEnd: number;        // ms from startTime (= gridAnimStart + GRID_DURATION)
  gridQuat0: THREE.Quaternion;
  gridQuat1: THREE.Quaternion;
}

export class Scene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: MyControls;
  public frames: THREE.Group[] = [];
  private control_list: TransformControls[] = [];
  private cleanupFunctions: (() => void)[] = [];
  private animationFrameId?: number;
  private gridHelper?: THREE.GridHelper;
  private baseAxes?: THREE.Group;
  private lastActiveMode: 'Translate' | 'Rotate' = 'Translate';
  private parentLinesGroup = new THREE.Group();
  private upAnimState: UpAnimState | null = null;
  private noGizmoIndices: Set<number> = new Set();

  // Called when click interactions change the interaction mode.
  public onInteractionStateChange: ((state: InteractionState) => void) | null = null;

  // Called once after a drag gesture completes.
  public onDragCommit: (() => void) | null = null;

  // Called when the up-direction animation finishes.
  // PoseVisualizer uses this to save camera state and recreate the scene so
  // that OrbitControls is freshly initialised with the new up direction.
  public onUpAnimComplete: (() => void) | null = null;

  constructor(container: HTMLElement, upDirection: UpDirection, cameraState?: CameraState) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    this.setupScene();

    if (cameraState) {
      // Restore camera from saved state (scene recreated after animation).
      this.camera.position.copy(cameraState.position);
      this.camera.up.copy(cameraState.up);
      this.camera.lookAt(cameraState.target);
      // Grid matches the new up direction (already reached by animation end).
      this.gridHelper!.quaternion.copy(Scene.upDirGridQuat(upDirection));
    } else {
      this.camera.position.set(5, 5, 5);
      this.camera.lookAt(0, 0, 0);
      this.applyUpDirectionImmediate(upDirection);
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.controls = new MyControls(this.camera, this.renderer.domElement);
    if (cameraState) {
      // Restore orbit target so rotation centre is preserved.
      this.controls.setOrbitTarget(cameraState.target);
    }
    this.controls.onActivate = () => {
      this.setInteractionState(this.lastActiveMode);
      this.onInteractionStateChange?.(this.lastActiveMode);
    };
    this.controls.onDeactivate = () => {
      this.setInteractionState('Off');
      this.onInteractionStateChange?.('Off');
    };
    this.controls.onDragCommit = () => this.onDragCommit?.();

    this.animate();
  }

  private setupScene() {
    this.baseAxes = createBaseAxes();
    this.scene.add(this.baseAxes);
    this.scene.add(this.parentLinesGroup);

    this.gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x444444);
    this.scene.add(this.gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }

  public setWorldAxesVisible(visible: boolean) {
    if (this.baseAxes) this.baseAxes.visible = visible;
  }

  // ─── Up-direction helpers ─────────────────────────────────────────────────

  private static upDirVec(dir: UpDirection): THREE.Vector3 {
    if (dir === 'X') return new THREE.Vector3(1, 0, 0);
    if (dir === 'Y') return new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3(0, 0, 1);
  }

  private static upDirGridQuat(dir: UpDirection): THREE.Quaternion {
    const q = new THREE.Quaternion();
    if (dir === 'Z') q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    else if (dir === 'X') q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
    // Y → identity
    return q;
  }

  // Smoothstep — used for Phase 1 position movement.
  private static smoothstep(t: number): number {
    return t * t * (3 - 2 * t);
  }

  private applyUpDirectionImmediate(dir: UpDirection): void {
    this.camera.up.copy(Scene.upDirVec(dir));
    this.gridHelper!.quaternion.copy(Scene.upDirGridQuat(dir));
  }

  // ─── Animated up-direction change ────────────────────────────────────────

  public setUpDirection(upDirection: UpDirection) {
    const newUp = Scene.upDirVec(upDirection);
    if (this.camera.up.distanceTo(newUp) < 1e-6) return;

    const orbitTarget = this.controls.getOrbitTarget();
    const currentUp = this.camera.up.clone().normalize();
    const currentPos = this.camera.position.clone();
    const camDist = currentPos.distanceTo(orbitTarget);

    // Quaternion slerp for camera.up: represent each up direction as a quaternion
    // that rotates the world-Y reference axis to that direction.
    const refY = new THREE.Vector3(0, 1, 0);
    const upQuat0 = new THREE.Quaternion().setFromUnitVectors(refY, currentUp);
    const upQuat1 = new THREE.Quaternion().setFromUnitVectors(refY, newUp);

    // Camera direction and right vector (used by both grid and Phase 1 below).
    const camDir = currentPos.clone().sub(orbitTarget).normalize();
    // Camera local +X is right in the rendered image (THREE.js: -Z forward, +X right).
    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);

    // ── Grid rotation ─────────────────────────────────────────────────────
    // The grid always rotates exactly 90° around the "odd one out" axis C —
    // the positive coordinate axis that is neither currentUp nor newUp.
    // We choose the sign of C (lambda) so the rotation folds the near grid edge
    // away from the viewer.  The correct direction depends on whether the camera
    // is above or below the new ground plane (camDir·newUp positive vs negative).
    const gridQuat0 = this.gridHelper!.quaternion.clone();
    const coordAxes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    const C = coordAxes.find(
      ax => Math.abs(ax.dot(currentUp)) < 0.1 && Math.abs(ax.dot(newUp)) < 0.1
    ) ?? coordAxes[0];
    const aboveGround = camDir.dot(newUp) >= 0;
    const lambda = C.clone();
    // Above: tip top of plane over with right hand → lambda aligns with camRight.
    // Below: scoop bottom of plane up with right hand → lambda aligns with camLeft.
    if (aboveGround ? lambda.dot(camRight) < 0 : lambda.dot(camRight) > 0) lambda.negate();
    const gridRotQuat = new THREE.Quaternion().setFromAxisAngle(lambda, Math.PI / 2);
    const gridQuat1 = gridRotQuat.clone().multiply(gridQuat0);

    // ── Singularity detection ─────────────────────────────────────────────
    // If the camera is within 10° of the pole in the new up system, Phase 1
    // slides it ±20° around the *old* up axis before Phase 2 rolls camera.up.
    // The scene is recreated after animation so OrbitControls is re-initialized;
    // Phase 1 is purely cosmetic — it avoids a jarring visual pop at the pole.
    const polarDot = camDir.dot(newUp);
    const POLE_THRESHOLD = Math.cos(10 * Math.PI / 180); // cos 10° ≈ 0.985

    let phase1End = 0;
    // Default phase-1 params (unused when phase1End === 0).
    let phase1CurrentUp = currentUp.clone();
    let phase1CamDir0 = camDir.clone();
    let phase1AzimuthDelta = 0;

    if (Math.abs(polarDot) > POLE_THRESHOLD) {
      // Positive rotation around currentUp moves in the currentUp × camDir direction.
      // Slide toward camRight: azimuthSign = sign((currentUp × camDir)·camRight).
      const moveDir = new THREE.Vector3().crossVectors(currentUp, camDir);
      const azimuthSign = moveDir.dot(camRight) >= 0 ? 1 : -1;

      phase1CurrentUp = currentUp.clone();
      phase1CamDir0 = camDir.clone();
      phase1AzimuthDelta = azimuthSign * (20 * Math.PI / 180); // ±20°
      phase1End = 300; // ms
    }

    this.controls.setOrbitEnabled(false);

    // ── Timing constants — adjust these to taste ──────────────────────────
    const PHASE2_DURATION  = 700;  // ms: how long camera.up rolls
    const GRID_DELAY_FRAC  = 0.99; // grid starts this fraction into Phase 2 (0–1)
    const GRID_DURATION    = 600;  // ms: how long the grid rotation takes
    // ─────────────────────────────────────────────────────────────────────

    const phase2End    = phase1End + PHASE2_DURATION;
    const gridAnimStart = phase1End + PHASE2_DURATION * GRID_DELAY_FRAC;
    const gridEnd      = gridAnimStart + GRID_DURATION;

    this.upAnimState = {
      startTime: performance.now(),
      orbitTarget,
      phase1End,
      phase1CurrentUp,
      phase1CamDir0,
      phase1CamDist: camDist,
      phase1AzimuthDelta,
      phase2End,
      upQuat0,
      upQuat1,
      gridAnimStart,
      gridEnd,
      gridQuat0,
      gridQuat1,
    };
  }

  // Advances the up-direction animation by one frame.
  private tickUpAnimation(): void {
    if (!this.upAnimState) return;
    const { startTime, orbitTarget, phase1End, phase2End,
            phase1CurrentUp, phase1CamDir0, phase1CamDist, phase1AzimuthDelta,
            upQuat0, upQuat1,
            gridAnimStart, gridEnd, gridQuat0, gridQuat1 } = this.upAnimState;

    const elapsed = performance.now() - startTime;

    if (phase1End > 0 && elapsed < phase1End) {
      // Phase 1: azimuthal sidestep — rotate camera ±20° around the old up axis
      // so the pole singularity doesn't cause a jarring visual pop.
      const t = Scene.smoothstep(elapsed / phase1End);
      const rotQuat = new THREE.Quaternion().setFromAxisAngle(
        phase1CurrentUp, phase1AzimuthDelta * t
      );
      this.camera.position
        .copy(orbitTarget)
        .addScaledVector(phase1CamDir0.clone().applyQuaternion(rotQuat), phase1CamDist);
      this.camera.lookAt(orbitTarget);

    } else {
      // Phase 2: slerp camera.up at constant angular velocity (linear t).
      const p2Duration = phase2End - phase1End;
      const t_cam = Math.min((elapsed - phase1End) / p2Duration, 1);

      const interpUp = new THREE.Quaternion().slerpQuaternions(upQuat0, upQuat1, t_cam);
      this.camera.up.set(0, 1, 0).applyQuaternion(interpUp);
      this.camera.lookAt(orbitTarget);

      // Grid slerp has its own independent window (may extend past phase2End).
      if (elapsed >= gridAnimStart) {
        const t_grid = Math.min((elapsed - gridAnimStart) / (gridEnd - gridAnimStart), 1);
        this.gridHelper!.quaternion.slerpQuaternions(gridQuat0, gridQuat1, t_grid);
      }

      // Fire when both camera.up roll and grid rotation are complete.
      if (elapsed >= Math.max(phase2End, gridEnd)) {
        this.controls.setOrbitEnabled(true);
        this.upAnimState = null;
        this.onUpAnimComplete?.();
      }
    }
  }

  // Returns a snapshot of the current camera state for scene reconstruction.
  public getCameraState(): CameraState {
    return {
      position: this.camera.position.clone(),
      up: this.camera.up.clone(),
      target: this.controls.getOrbitTarget(),
    };
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.tickUpAnimation();
    this.updateParentLines();
    this.renderer.render(this.scene, this.camera);
  };

  private updateParentLines(): void {
    const children = this.parentLinesGroup.children as THREE.Line[];
    children.forEach((line) => {
      const userData = line.userData as { childIndex: number; parentIndex: number };
      const child = this.frames[userData.childIndex];
      const parent = this.frames[userData.parentIndex];
      if (!child || !parent) return;
      const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      attr.setXYZ(0, parent.position.x, parent.position.y, parent.position.z);
      attr.setXYZ(1, child.position.x, child.position.y, child.position.z);
      attr.needsUpdate = true;
    });
  }

  public addParentLine(childIndex: number, parentIndex: number): void {
    const positions = new Float32Array(6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.45 });
    const line = new THREE.Line(geometry, material);
    line.userData = { childIndex, parentIndex };
    this.parentLinesGroup.add(line);
  }

  public setParentLinesVisible(visible: boolean): void {
    this.parentLinesGroup.visible = visible;
  }

  public addFrame(frame: THREE.Group, onChange: () => void) {
    this.scene.add(frame);
    this.frames.push(frame);

    const { control, cleanup } = this.controls.addTransformControl(
      this.camera,
      this.renderer.domElement,
      frame,
      onChange
    );
    this.controls.registerFrameIndex(control, this.frames.length - 1);
    this.scene.add(control.getHelper());
    this.control_list.push(control);
    this.cleanupFunctions.push(cleanup);

    this.controls.setFrames(this.frames);
  }

  public getDraggedFrameIndex(): number {
    return this.controls.getDraggedFrameIndex();
  }

  public setNoGizmoIndices(indices: Set<number>): void {
    this.noGizmoIndices = indices;
  }

  public setInteractionState(interactionState: InteractionState) {
    if (interactionState !== 'Off') {
      this.lastActiveMode = interactionState;
    }
    this.controls.interactionActive = interactionState !== 'Off';

    this.control_list.forEach((control, index) => {
      control.detach();
      if (this.noGizmoIndices.has(index)) return;
      switch(interactionState) {
        case "Off":
          break;
        case "Translate":
          control.attach(this.frames[index]);
          control.setMode("translate");
          break;
        case "Rotate":
          control.attach(this.frames[index]);
          control.setMode("rotate");
          break;
      }
    });
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public clearFrames() {
    this.frames.forEach((frame) => this.scene.remove(frame));
    this.frames = [];
    this.control_list.forEach((control) => this.scene.remove(control.getHelper()));
    this.control_list = [];
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    this.cleanupFunctions = [];
    this.parentLinesGroup.children.forEach((obj) => {
      const line = obj as THREE.Line;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.parentLinesGroup.clear();
    this.noGizmoIndices = new Set();
    this.controls.setFrames(this.frames);
  }

  public dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.upAnimState) {
      this.controls.setOrbitEnabled(true);
      this.upAnimState = null;
    }
    this.clearFrames();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
