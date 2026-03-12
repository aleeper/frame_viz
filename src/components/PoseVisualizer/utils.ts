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

  // Invisible hit-zone cylinders for each axis.
  // Positive extent matches the arrow length (1.0); negative extent is half
  // that (0.5) so clicking slightly behind the origin still works but the
  // hit region doesn't surprise the user when frames are close together.
  const hitRadius = 0.10;
  const hitPosExtent = 1.0;
  const hitNegExtent = 0.5;
  const hitLength = hitPosExtent + hitNegExtent;
  const hitCenterOffset = (hitPosExtent - hitNegExtent) / 2; // 0.25 from origin

  const hitGeo = new THREE.CylinderGeometry(hitRadius, hitRadius, hitLength, 8);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  const hitZone = new THREE.Group();
  hitZone.name = 'hitZone';

  const xHit = new THREE.Mesh(hitGeo, hitMat);
  xHit.rotation.z = -Math.PI / 2;
  xHit.position.x = hitCenterOffset;
  hitZone.add(xHit);

  const yHit = new THREE.Mesh(hitGeo, hitMat);
  yHit.position.y = hitCenterOffset;
  hitZone.add(yHit);

  const zHit = new THREE.Mesh(hitGeo, hitMat);
  zHit.rotation.x = Math.PI / 2;
  zHit.position.z = hitCenterOffset;
  hitZone.add(zHit);

  frame.add(hitZone);

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
  const shaftRadius = 0.01;
  const headLength = 0.4;
  const headRadius = 0.12;
  const shaftLength = axisLength - headLength;

  const makeAxis = (color: number, quat: THREE.Quaternion) => {
    const mat = new THREE.MeshLambertMaterial({ color });
    const group = new THREE.Group();

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 8), mat);
    shaft.position.y = shaftLength / 2;
    group.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 8), mat);
    head.position.y = shaftLength + headLength / 2;
    group.add(head);

    group.quaternion.copy(quat);
    return group;
  };

  // Rotate each group so its local Y points along the desired world axis.
  const xQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
  const yQuat = new THREE.Quaternion(); // identity — Y is already up
  const zQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

  const frame = new THREE.Group();
  frame.add(makeAxis(0xff3333, xQuat));
  frame.add(makeAxis(0x33ff33, yQuat));
  frame.add(makeAxis(0x3333ff, zQuat));
  return frame;
}
