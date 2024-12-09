import { Editor } from '@monaco-editor/react';
import { useCallback, useEffect, useState} from 'react';
import { Pose, Poses, isValidPose } from '../types/Pose';

interface JsonEditorProps {
  value: Poses;
  onChange: (poses: Pose[]) => void;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const [localValue, setLocalValue] = useState(JSON.stringify(value, null, 2));
  const debouncedValue = useDebounce(localValue, 1000);

  useEffect(() => {
    console.log("A");
    setLocalValue(JSON.stringify(value, null, 2));
  }, [value]);

  useEffect(() => {
    console.log("B");
    try {
      const poses = JSON.parse(debouncedValue);
      if (Array.isArray(poses)) {
        const validPoses = poses.filter(isValidPose);
        if (validPoses.length === poses.length) {
          onChange(validPoses);
        }
      }
    } catch (e) {
      console.error('Invalid JSON');
    }
  }, [debouncedValue, onChange]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="json"
        value={localValue}
        onChange={(e) => setLocalValue(e ?? "")}
        theme="vs-darkq"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}