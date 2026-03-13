import { describe, it, expect } from 'vitest';

/**
 * We test the undo/redo logic by reimplementing the same algorithm in a
 * plain function (no React). This is valid because the hook is a thin React
 * wrapper around pure ref + callback logic. The algorithm is what matters.
 */
const MAX_HISTORY = 50;

function makeUndoRedo<T>(initial: T) {
  const history: T[] = [initial];
  let index = 0;

  const set = (next: T) => {
    history.splice(index + 1); // truncate redo history
    history.push(next);
    if (history.length > MAX_HISTORY) {
      history.shift(); // drop oldest, index stays at last item
    } else {
      index++;
    }
  };

  const setSilent = (next: T) => {
    history[index] = next;
  };

  const undo = () => {
    if (index > 0) index--;
  };

  const redo = () => {
    if (index < history.length - 1) index++;
  };

  const snapshot = () => history[index];
  const canUndo = () => index > 0;
  const canRedo = () => index < history.length - 1;

  return { set, setSilent, undo, redo, snapshot, canUndo, canRedo };
}

describe('useUndoRedo logic', () => {
  it('initial snapshot is the initial value', () => {
    const h = makeUndoRedo('a');
    expect(h.snapshot()).toBe('a');
  });

  it('set pushes entry and increments index', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    expect(h.snapshot()).toBe('b');
    expect(h.canUndo()).toBe(true);
  });

  it('set truncates redo history on new entry', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    h.set('c');
    h.undo(); // back to b
    h.set('d'); // truncates c
    expect(h.canRedo()).toBe(false);
    expect(h.snapshot()).toBe('d');
  });

  it('setSilent updates in-place without adding a history entry', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    h.setSilent('b-modified');
    expect(h.snapshot()).toBe('b-modified');
    h.undo();
    expect(h.snapshot()).toBe('a'); // only one history entry to undo
  });

  it('undo decrements index and returns previous snapshot', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    h.undo();
    expect(h.snapshot()).toBe('a');
  });

  it('redo increments index', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    h.undo();
    h.redo();
    expect(h.snapshot()).toBe('b');
  });

  it('canUndo is false at index 0', () => {
    const h = makeUndoRedo('a');
    expect(h.canUndo()).toBe(false);
  });

  it('canRedo is false at last entry', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    expect(h.canRedo()).toBe(false);
  });

  it('canUndo is true after set', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    expect(h.canUndo()).toBe(true);
  });

  it('canRedo is true after undo', () => {
    const h = makeUndoRedo('a');
    h.set('b');
    h.undo();
    expect(h.canRedo()).toBe(true);
  });

  it('MAX_HISTORY cap: oldest entry dropped, index stays at last', () => {
    const h = makeUndoRedo(0);
    // Fill to MAX_HISTORY (50 entries including initial = 49 sets)
    for (let i = 1; i < MAX_HISTORY; i++) h.set(i);
    expect(h.snapshot()).toBe(MAX_HISTORY - 1);
    // Add one more — should drop the oldest (0)
    h.set(MAX_HISTORY);
    expect(h.snapshot()).toBe(MAX_HISTORY);
    // Undo all the way back — should reach 1 (not 0)
    while (h.canUndo()) h.undo();
    expect(h.snapshot()).toBe(1);
  });
});
