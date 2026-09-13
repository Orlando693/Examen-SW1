import { describe, expect, it } from 'vitest';
import { LocalPresenceState } from './local-presence-state';

describe('local drag activity Presence', () => {
  it('publishes immediate start and stop snapshots while preserving other fields', () => { const state = new LocalPresenceState(); state.setCursor({ x: 100, y: 200 }); state.setSelectionIds(['class-1']); state.setEditingElementId('class-2'); state.setActivity('dragging'); expect(state.snapshot()).toEqual({ cursor: { x: 100, y: 200 }, selectionIds: ['class-1'], editingElementId: 'class-2', activity: 'dragging' }); state.setActivity(null); expect(state.snapshot()).toEqual({ cursor: { x: 100, y: 200 }, selectionIds: ['class-1'], editingElementId: 'class-2', activity: null }); });
  it('does not require activity changes for drag frames', () => { const state = new LocalPresenceState(); state.setActivity('dragging'); const before = state.snapshot(); const after = state.snapshot(); expect(after).toEqual(before); });
});
