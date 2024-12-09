import * as THREE from 'three';
import { MyControls } from './controls/Controls';
import { TransformControls } from './controls/CustomTransformControls';
import { UpDirection } from '../../types/Representation';
import { createBaseAxes } from './utils';

export class Scene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: MyControls;
  private frames: THREE.Group[] = [];
  private control_list: TransformControls[] = [];
  private cleanupFunctions: (() => void)[] = [];
  private animationFrameId?: number;
  private gridHelper?: THREE.GridHelper;

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
    
    // Setup scene
    this.animate();
  }

  private setupScene() {
    const baseAxes = createBaseAxes();
    this.scene.add(baseAxes);

    this.gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x444444);
    this.scene.add(this.gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }
  
  public setUpDirection(upDirection: UpDirection) {
    if (upDirection == "X") {
      this.scene.up.set(1, 0, 0);
      this.camera.up.set(1, 0, 0);
      this.gridHelper.rotation.z = Math.PI / 2;
    } else if (upDirection == "Y") {
      this.scene.up.set(0, 1, 0);
      this.camera.up.set(0, 1, 0);
      // No change to gridHelper.
    } else if (upDirection == "Z") {
      this.scene.up.set(0, 0, 1);
      this.camera.up.set(0, 0, 1);
      this.gridHelper.rotation.x = Math.PI / 2;
    } else {
      console.log("Unrecognized direction: " + upDirection);
    }
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public addFrame(frame: THREE.Group, onChange: () => void) {
    this.scene.add(frame);
    this.frames.push(frame);

    const { control, cleanup } = this.controls.addTransformControl(
      this.camera,
      this.renderer.domElement,
      frame,
      onChange
    );
    this.scene.add(control.getHelper());
    this.control_list.push(control);
    this.cleanupFunctions.push(cleanup);
  }

  public setInteractive(interactive: boolean) {
    this.control_list.forEach((control, index) => {
      if (interactive) {
        control.attach(this.frames[index]);
      } else {
        control.detach();
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
