import { CursorPresencePublisher, type FlowCursor } from './cursor-presence-publisher';

export function flowCursorFromPointer(pointer: { clientX: number; clientY: number }, screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }): FlowCursor {
  return screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
}

export class LocalCursorPresence {
  private readonly publisher: CursorPresencePublisher;
  constructor(send: (cursor: FlowCursor) => void) { this.publisher = new CursorPresencePublisher(send); }
  publish(cursor: FlowCursor): void { this.publisher.publish(cursor); }
  publishPointer(pointer: { clientX: number; clientY: number }, screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number }): void { this.publisher.publish(flowCursorFromPointer(pointer, screenToFlowPosition)); }
  clear(): void { this.publisher.publish(null); }
  dispose(): void { this.publisher.dispose(); }
}
