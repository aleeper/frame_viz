import { useEffect, useRef, useCallback, useState } from 'react';
import { Scene } from './Scene';
import { createFrame } from './utils';
import { Pose, Poses } from '../../types/Pose';

interface PoseVisualizerProps {
  poses: Poses;
  onChange?: (newPoses: Poses) => void;
}

export function PoseVisualizer({ poses, onChange }: PoseVisualizerProps) {
  console.log("PoseVisualize constructor!");
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene>();
  const [prevPoses, setPrevPoses] = useState([]);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        setPrevPoses([]); // Reset prevPoses to ensure reinitialization.
      });
    }
  }, []);

  // Callback for pose updates from the Three.js window.
  const handleTransformChange = () => {
    console.log("Z");
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
    if (JSON.stringify(newPoses) != JSON.stringify(poses)) {
      setPrevPoses(newPoses);
      onChange(newPoses);
    }
  };

  // Setup resize handler for Three.js window.
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
    console.log("X");
    if (!sceneRef.current) return;
    let posesString = JSON.stringify(poses);
    let prevPosesString = JSON.stringify(prevPoses);
    if (posesString == prevPosesString) {
      // console.log("Same poses, skipping update.");
      return;
    }
    
    const scene = sceneRef.current;
    scene.clearFrames();
    poses.forEach((pose) => {
      const frame = createFrame(pose);
      scene.addFrame(frame, handleTransformChange);
    });
    console.log("Setting interactive: " + interactive);
    scene.setInteractive(interactive);
  }, [poses, handleTransformChange]);

  useEffect(() => {

    let isKeyDown = false;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKeyDown) return;
      console.log("PoseVisualizer.keydown");
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      
      switch (event.key.toLowerCase()) {
        case 'q':
          setInteractive((prev) => {
            const newInteractive = !prev;
            console.log("Set interactive: " + newInteractive);
            scene.setInteractive(newInteractive);
            return newInteractive;
          });
          break;
        }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      isKeyDown = false;
    };
    console.log("Adding keydown listener.");
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyDown);
    };
  }, []);
  
  
  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-80 p-2 rounded-lg">
        <p className="text-sm text-white">
          Q: Toggle controls | W: Translate | E: Rotate | S: local vs global
        </p>
        <p className="text-sm text-white">
          +/-: Adjust Control Size | Click and drag to orbit | Scroll to zoom
        </p>
      </div>
    </div>
  );
}