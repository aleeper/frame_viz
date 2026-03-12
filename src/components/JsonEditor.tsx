import { Editor } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const debouncedValue = useDebounce(localValue, 1000);
  // Track the last external value so we can skip calling onChange when the
  // editor content just reflects an undo/redo rather than a user edit.
  const externalValueRef = useRef(value);
  externalValueRef.current = value;

  useEffect(() => {
    setLocalValue(JSON.stringify(value, null, 2));
  }, [value]);

  useEffect(() => {
    try {
      const poses = JSON.parse(debouncedValue);
      if (Array.isArray(poses)) {
        const validPoses = poses.filter(isValidPose);
        if (validPoses.length === poses.length) {
          // Skip if content matches the external value — this debounce fired
          // because an undo/redo updated localValue, not because the user typed.
          if (JSON.stringify(validPoses) !== JSON.stringify(externalValueRef.current)) {
            onChange(validPoses);
          }
          setError(null);
        } else {
          setError('Some elements are not valid Pose objects.');
        }
      } else {
        setError('Parsed JSON is not an array.');
      }
    } catch (e) {
      setError('Invalid JSON format.');
    }
  }, [debouncedValue, onChange]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={localValue}
          onChange={(e) => setLocalValue(e ?? "")}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
          }}
        />
      </div>
      {error && (
        <div className="bg-red-100 text-red-500 text-sm p-2 rounded-md overflow-y-auto">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
