import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls as CustomTransformControls } from 'three/examples/jsm/controls/TransformControls';
// import { CustomTransformControls } from './CustomTransformControls';

export class MyControls {
  private orbitControls: OrbitControls;
  private transformControls: Map<string, CustomTransformControls> = new Map();

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.orbitControls = new OrbitControls(camera, domElement);
    this.setupOrbitControls();
  }

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
    control.attach(object);
    control.addEventListener('dragging-changed', (event) => {
      this.orbitControls.enabled = !event.value;
    });
    control.addEventListener('change', onChange);

    // Add keyboard controls
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'q':
          control.enabled = !control.enabled;
          control.visible = control.enabled;
          break;
        case 'w':
          control.setMode('translate');
          break;
        case 'e':
          control.setMode('rotate');
          break;
        // case 'r':
        //   control.setMode('scale');
        //   break;
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

    return {
      control,
      cleanup: () => {
        window.removeEventListener('keydown', handleKeyDown);
        control.dispose();
        this.transformControls.delete(id);
      },
    };
  }

  public update() {
    this.orbitControls.update();
  }

  public dispose() {
    this.orbitControls.dispose();
    this.transformControls.forEach((control) => control.dispose());
    this.transformControls.clear();
  }
}
