import { Editor } from '@monaco-editor/react';
import { useCallback } from 'react';
import { Pose } from '../types/Pose';

interface JsonEditorProps {
  value: string;
  onChange: (poses: Pose[]) => void;
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      try {
        const poses = JSON.parse(value);
        if (Array.isArray(poses)) {
          onChange(poses);
        }
      } catch (e) {
        console.error('Invalid JSON');
      }
    },
    [onChange]
  );

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="json"
        value={value}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}