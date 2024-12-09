import { useEffect, useRef, useCallback, useState } from 'react';
import { Scene } from './Scene';
import { createFrame } from './utils';
import { Pose, Poses } from '../../types/Pose';
import { UpDirection } from '../../types/Representation';
import { InteractionState } from './types/InteractionState';

interface PoseVisualizerProps {
  poses: Poses;
  upDirection: UpDirection;
  onChange?: (newPoses: Poses) => void;
}

export function PoseVisualizer({ poses, upDirection, onChange }: PoseVisualizerProps) {
  // console.log("PoseVisualize constructor!");
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene>();
  const [prevPoses, setPrevPoses] = useState([]);
  const [interactionState, setInteractionState] = useState<InteractionState>("Off");
  // const [upDirection, setUpDirection] = useState("Y");

  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        setPrevPoses([]); // Reset prevPoses to ensure reinitialization.
      });
    }
  }, []);

  // Callback for pose updates from the Three.js window.
  const handleTransformChange = () => {
    // console.log("Z");
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
    setPrevPoses([]);
    const scene = new Scene(containerRef.current, upDirection);
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
  }, [upDirection]);

  useEffect(() => {
    // console.log("X");
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
      const frame = createFrame(pose, upDirection);
      scene.addFrame(frame, handleTransformChange);
    });
    // console.log("Setting interactionState: " + interactionState);
    scene.setInteractionState(interactionState);
  }, [poses, handleTransformChange]);

  useEffect(() => {
    let isKeyDown = false;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKeyDown) return;
      // console.log("PoseVisualizer.keydown");
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      console.log("Event: " + event.key);
      setInteractionState((prevState) => {
        let newInteractionState: InteractionState = prevState;
        switch (event.key.toLowerCase()) {
          case 'q':
            newInteractionState = "Off";
            break;
          case 'w':
            newInteractionState = "Translate";
            break;
          case 'e':
            newInteractionState = "Rotate";
            break;
        }
        // console.log("interactionState: " + prevState + ", newInteractionState: " + newInteractionState);
        if (newInteractionState !== prevState) {
          scene.setInteractionState(newInteractionState);
        }
        return newInteractionState;
      });
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

  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setUpDirection(upDirection);
  }, [upDirection]);


  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-80 p-2 rounded-lg">
        <p className="text-sm text-white">
          Q: Controls Off | W: Translate | E: Rotate | S: local vs global
        </p>
        {/* <p className="text-sm text-white">
          +/-: Adjust Control Size | Click and drag to orbit | Scroll to zoom
        </p> */}
      </div>
    </div>
  );
}