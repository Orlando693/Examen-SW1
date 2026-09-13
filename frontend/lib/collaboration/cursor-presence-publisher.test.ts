import { afterEach, describe, expect, it, vi } from 'vitest';
import { CURSOR_PUBLISH_INTERVAL_MS, CursorPresencePublisher, type FlowCursor } from './cursor-presence-publisher';

describe('CursorPresencePublisher', () => {
  afterEach(() => vi.useRealTimers());

  function setup() { vi.useFakeTimers(); vi.setSystemTime(0); const sent: FlowCursor[] = []; return { sent, publisher: new CursorPresencePublisher((cursor) => sent.push(cursor)) }; }

  it('publishes the first cursor immediately', () => {
    const { publisher, sent } = setup(); publisher.publish({ x: 1, y: 2 }); expect(sent).toEqual([{ x: 1, y: 2 }]);
  });

  it('coalesces rapid updates so only the latest pending cursor is sent', () => {
    const { publisher, sent } = setup(); publisher.publish({ x: 1, y: 1 }); vi.advanceTimersByTime(10); publisher.publish({ x: 2, y: 2 }); vi.advanceTimersByTime(10); publisher.publish({ x: 3, y: 3 }); vi.advanceTimersByTime(CURSOR_PUBLISH_INTERVAL_MS - 20);
    expect(sent).toEqual([{ x: 1, y: 1 }, { x: 3, y: 3 }]);
  });

  it('never exceeds twenty publishes in a half-open one-second window of frequent updates', () => {
    const { publisher, sent } = setup();
    for (let time = 0; time < 990; time += 10) { publisher.publish({ x: time, y: time }); vi.advanceTimersByTime(10); }
    expect(sent.length).toBeLessThanOrEqual(20);
  });

  it('coalesces a null clear over a pending cursor without a backlog', () => {
    const { publisher, sent } = setup(); publisher.publish({ x: 1, y: 1 }); publisher.publish({ x: 2, y: 2 }); publisher.publish(null); vi.advanceTimersByTime(CURSOR_PUBLISH_INTERVAL_MS);
    expect(sent).toEqual([{ x: 1, y: 1 }, null]);
  });

  it('cancels pending work idempotently on dispose', () => {
    const { publisher, sent } = setup(); publisher.publish({ x: 1, y: 1 }); publisher.publish({ x: 2, y: 2 }); publisher.dispose(); publisher.dispose(); vi.advanceTimersByTime(CURSOR_PUBLISH_INTERVAL_MS);
    expect(sent).toEqual([{ x: 1, y: 1 }]);
  });

  it('keeps independent publisher state isolated', () => {
    vi.useFakeTimers(); vi.setSystemTime(0); const first: FlowCursor[] = []; const second: FlowCursor[] = []; const publisherA = new CursorPresencePublisher((cursor) => first.push(cursor)); const publisherB = new CursorPresencePublisher((cursor) => second.push(cursor));
    publisherA.publish({ x: 1, y: 1 }); publisherA.publish({ x: 2, y: 2 }); publisherB.publish({ x: 3, y: 3 }); expect(first).toEqual([{ x: 1, y: 1 }]); expect(second).toEqual([{ x: 3, y: 3 }]);
  });
});
