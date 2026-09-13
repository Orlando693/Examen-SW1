import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalCursorPresence } from './local-cursor-presence';
import type { FlowCursor } from './cursor-presence-publisher';

describe('LocalCursorPresence', () => {
  afterEach(() => vi.useRealTimers());

  it('converts client coordinates through the supplied React Flow transformation before publishing', () => {
    const sent: FlowCursor[] = []; const presence = new LocalCursorPresence((cursor) => sent.push(cursor)); const screenToFlowPosition = vi.fn(() => ({ x: 20, y: 30 }));
    presence.publishPointer({ clientX: 200, clientY: 300 }, screenToFlowPosition);
    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 200, y: 300 }); expect(sent).toEqual([{ x: 20, y: 30 }]); expect(sent).not.toContainEqual({ x: 200, y: 300 });
  });

  it('coalesces rapid flow cursor events and cancels a pending event on dispose', () => {
    vi.useFakeTimers(); vi.setSystemTime(0); const sent: FlowCursor[] = []; const presence = new LocalCursorPresence((cursor) => sent.push(cursor));
    presence.publish({ x: 1, y: 1 }); presence.publish({ x: 2, y: 2 }); presence.publish({ x: 3, y: 3 }); expect(sent).toEqual([{ x: 1, y: 1 }]); vi.advanceTimersByTime(50); expect(sent).toEqual([{ x: 1, y: 1 }, { x: 3, y: 3 }]); presence.publish({ x: 4, y: 4 }); presence.dispose(); vi.advanceTimersByTime(50); expect(sent).not.toContainEqual({ x: 4, y: 4 });
  });

  it('publishes a coalesced null clear', () => {
    vi.useFakeTimers(); vi.setSystemTime(0); const sent: FlowCursor[] = []; const presence = new LocalCursorPresence((cursor) => sent.push(cursor));
    presence.publish({ x: 1, y: 1 }); presence.clear(); vi.advanceTimersByTime(50); expect(sent).toEqual([{ x: 1, y: 1 }, null]);
  });

  it('replaces a pending cursor with a null clear without reviving it', () => {
    vi.useFakeTimers(); vi.setSystemTime(0); const sent: FlowCursor[] = []; const presence = new LocalCursorPresence((cursor) => sent.push(cursor));
    presence.publish({ x: 1, y: 1 }); presence.publish({ x: 2, y: 2 }); presence.clear(); vi.advanceTimersByTime(50); expect(sent).toEqual([{ x: 1, y: 1 }, null]); vi.advanceTimersByTime(100); expect(sent).not.toContainEqual({ x: 2, y: 2 });
  });
});
