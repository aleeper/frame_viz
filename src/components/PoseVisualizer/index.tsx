import { useEffect, useRef, useCallback } from 'react';
import { Scene } from './Scene';
import { createFrame } from './utils';
import { Pose } from '../../types/Pose';

interface PoseVisualizerProps {
  poses: Pose[];
  onChange?: (poses: Pose[]) => void;
}

export function PoseVisualizer({ poses, onChange }: PoseVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene>();

  const handleTransformChange = useCallback(() => {
    if (!sceneRef.current || !onChange) return;
    
    const scene = sceneRef.current;
    const newPoses = scene.frames.map((frame, index) => ({
      ...poses[index],
      position: {
        x: frame.position.x,
        y: frame.position.y,
        z: frame.position.z,
      },
      quaternion: {
        x: frame.quaternion.x,
        y: frame.quaternion.y,
        z: frame.quaternion.z,
        w: frame.quaternion.w,
      },
    }));
    
    onChange(newPoses);
  }, [poses, onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new Scene(containerRef.current);
    sceneRef.current = scene;

    const handleResize = () => {
      if (!containerRef.current) return;
      scene.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    scene.clearFrames();
    poses.forEach((pose) => {
      const frame = createFrame(pose);
      scene.addFrame(frame, handleTransformChange);
    });
  }, [poses, handleTransformChange]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-80 p-2 rounded-lg">
        <p className="text-sm text-white">
          W: Translate | E: Rotate | +/-: Adjust Control Size | Click and drag to orbit | Scroll to zoom
        </p>
      </div>
    </div>
  );
}