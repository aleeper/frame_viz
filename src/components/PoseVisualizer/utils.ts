import * as THREE from 'three';
import { Pose } from '../../types/Pose';
import { UpDirection } from '../../types/Representation';

export function createTextCanvas(text: string) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 256;

  ctx.fillStyle = 'white';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 128);

  return canvas;
}

export function createFrame(pose: Pose, upDirection: UpDirection = "Y") {
  const frame = new THREE.Group();

  // Create a single arrow for each axis with thicker lines
  const axisLength = 1;
  const headLength = 0.2;
  const headWidth = 0.1;

  // X axis (red)
  const xArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    axisLength,
    0xff0000,
    headLength,
    headWidth
  );

  // Y axis (green)
  const yArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    axisLength,
    0x00ff00,
    headLength,
    headWidth
  );

  // Z axis (blue)
  const zArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, 0),
    axisLength,
    0x0000ff,
    headLength,
    headWidth
  );

  // Make the lines thicker
  [xArrow, yArrow, zArrow].forEach(arrow => {
    const line = arrow.line as THREE.Line;
    (line.material as THREE.LineBasicMaterial).linewidth = 2;
  });

  frame.add(xArrow, yArrow, zArrow);

  // Set position and rotation
  frame.position.set(pose.position.x, pose.position.y, pose.position.z);
  frame.quaternion.set(
    pose.quaternion.x,
    pose.quaternion.y,
    pose.quaternion.z,
    pose.quaternion.w
  );

  // Add label if name exists
  if (pose.name) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(createTextCanvas(pose.name)),
        sizeAttenuation: false
      })
    );
    const height = 1.4;
    sprite.position.set(height * +(upDirection === "X"), height * +(upDirection === "Y"), height * +(upDirection === "Z"),);
    const scale = 0.5;
    sprite.scale.set(scale, scale, scale);
    frame.add(sprite);
  }

  return frame;
}

export function createBaseAxes(axisLength: number = 5) {
  // Create dashed material
  const createDashedLine = (color: number) =>
  new THREE.LineDashedMaterial({ color, dashSize: 0.25, gapSize: 0.25, linewidth: 2 });
  
  // Geometry for the dashed line.
  const createLineGeometry = (start: THREE.Vector3, end: THREE.Vector3) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    geometry.computeBoundingSphere();
    return geometry;
  };
  
  // X axis (red).
  const xGeometry = createLineGeometry(new THREE.Vector3(0, 0, 0), new THREE.Vector3(axisLength, 0, 0));
  const xLine = new THREE.Line(xGeometry, createDashedLine(0xff0000));
  xLine.computeLineDistances(); // Required for dashed lines
  
  // Y axis (green).
  const yGeometry = createLineGeometry(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, axisLength, 0));
  const yLine = new THREE.Line(yGeometry, createDashedLine(0x00ff00));
  yLine.computeLineDistances();

  // Z axis (blue).
  const zGeometry = createLineGeometry(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, axisLength));
  const zLine = new THREE.Line(zGeometry, createDashedLine(0x0000ff));
  zLine.computeLineDistances();
  
  // Add lines to the frame.
  const frame = new THREE.Group();
  frame.add(xLine, yLine, zLine);
  return frame;
}