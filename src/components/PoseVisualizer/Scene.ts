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

  // Called when click interactions change the interaction mode.
  // PoseVisualizer sets this to keep React state in sync.
  public onInteractionStateChange: ((state: InteractionState) => void) | null = null;

  // Called once after a drag gesture completes. PoseVisualizer wires this to
  // push a history snapshot.
  public onDragCommit: (() => void) | null = null;

  constructor(container: HTMLElement, upDirection: UpDirection) {
    // Setup scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    this.setupScene();
    this.setUpDirection(upDirection);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Setup controls
    this.controls = new MyControls(this.camera, this.renderer.domElement);
    this.controls.onActivate = () => {
      this.setInteractionState(this.lastActiveMode);
      this.onInteractionStateChange?.(this.lastActiveMode);
    };
    this.controls.onDeactivate = () => {
      this.setInteractionState('Off');
      this.onInteractionStateChange?.('Off');
    };
    this.controls.onDragCommit = () => this.onDragCommit?.();

    // Setup scene
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

  public setUpDirection(upDirection: UpDirection) {
    if (upDirection == "X") {
      this.camera.up.set(1, 0, 0);
      this.gridHelper.rotation.z = Math.PI / 2;
    } else if (upDirection == "Y") {
      this.camera.up.set(0, 1, 0);
      // No change to gridHelper.
    } else if (upDirection == "Z") {
      this.camera.up.set(0, 0, 1);
      this.gridHelper.rotation.x = Math.PI / 2;
    } else {
      console.log("Unrecognized direction: " + upDirection);
    }
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.updateParentLines();
    this.renderer.render(this.scene, this.camera);
  };

  private updateParentLines(): void {
    const children = this.parentLinesGroup.children as THREE.Line[];
    // parentLinesGroup.children lines are in the same order as addParentLine calls
    children.forEach((line, i) => {
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
    const positions = new Float32Array(6); // 2 points × 3 coords
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

  public setInteractionState(interactionState: InteractionState) {
    if (interactionState !== 'Off') {
      this.lastActiveMode = interactionState;
    }
    this.controls.interactionActive = interactionState !== 'Off';

    this.control_list.forEach((control, index) => {
      control.detach();
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
    // Dispose parent line geometries/materials and clear the group.
    this.parentLinesGroup.children.forEach((obj) => {
      const line = obj as THREE.Line;
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    this.parentLinesGroup.clear();

    this.controls.setFrames(this.frames);
  }

  public dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.clearFrames();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
