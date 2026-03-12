import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY = 50;

export function useUndoRedo<T>(initial: T) {
  const historyRef = useRef<T[]>([initial]);
  const indexRef = useRef(0);
  const [, setTick] = useState(0);
  const tick = () => setTick(t => t + 1);

  // Push a new history entry, truncating any redo entries ahead of the cursor.
  const set = useCallback((next: T) => {
    historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
    historyRef.current.push(next);
    if (historyRef.current.length > MAX_HISTORY) {
      // Drop oldest; index stays the same — still points to the last item.
      historyRef.current.shift();
    } else {
      indexRef.current++;
    }
    tick();
  }, []);

  // Replace the current entry in-place. No new history entry, no re-render.
  const setSilent = useCallback((next: T) => {
    historyRef.current[indexRef.current] = next;
  }, []);

  const undo = useCallback(() => {
    if (indexRef.current > 0) {
      indexRef.current--;
      tick();
    }
  }, []);

  const redo = useCallback(() => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++;
      tick();
    }
  }, []);

  const snapshot = historyRef.current[indexRef.current];
  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < historyRef.current.length - 1;

  return { snapshot, set, setSilent, undo, redo, canUndo, canRedo };
}
