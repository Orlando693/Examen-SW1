import { describe, expect, it } from 'vitest';
import { MAX_PRESENCE_SELECTION_IDS, presenceSelectionIds } from './local-selection-presence';
import { LocalPresenceState } from './local-presence-state';

describe('local selection Presence', () => {
  it('publishes deterministic deduplicated node and edge IDs within the backend limit', () => { expect(presenceSelectionIds([{ id: 'class-1' }, { id: 'class-1' }], [{ id: 'relationship-1' }])).toEqual(['class-1', 'relationship-1']); expect(presenceSelectionIds(Array.from({ length: 60 }, (_, index) => ({ id: `class-${index}` })), [])).toEqual(Array.from({ length: MAX_PRESENCE_SELECTION_IDS }, (_, index) => `class-${index}`)); });
  it('preserves cursor, editing, and activity in the immediate full Presence snapshot', () => { const state = new LocalPresenceState(); state.setCursor({ x: 100, y: 200 }); state.setEditingElementId('class-2'); state.setActivity('editing'); state.setSelectionIds(presenceSelectionIds([{ id: 'class-1' }], [{ id: 'relationship-1' }])); expect(state.snapshot()).toEqual({ cursor: { x: 100, y: 200 }, selectionIds: ['class-1', 'relationship-1'], editingElementId: 'class-2', activity: 'editing' }); state.setSelectionIds([]); expect(state.snapshot()).toMatchObject({ selectionIds: [], cursor: { x: 100, y: 200 }, editingElementId: 'class-2', activity: 'editing' }); });
});
