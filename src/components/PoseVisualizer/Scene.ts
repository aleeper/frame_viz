import * as THREE from 'three';
import { MyControls } from './controls/Controls';

export class Scene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: MyControls;
  private frames: THREE.Group[] = [];
  private cleanupFunctions: (() => void)[] = [];
  private animationFrameId?: number;

  constructor(container: HTMLElement) {
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

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Setup controls
    this.controls = new MyControls(this.camera, this.renderer.domElement);

    // Setup scene
    this.setupScene();
    this.animate();
  }

  private setupScene() {
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x444444);
    this.scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
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
    this.scene.add(control);
    this.cleanupFunctions.push(cleanup);
  }

  public resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public clearFrames() {
    this.frames.forEach((frame) => this.scene.remove(frame));
    this.frames = [];
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
