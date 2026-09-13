import { describe, expect, it } from 'vitest';
import { MAX_EDITING_ELEMENT_ID_LENGTH, validEditingElementId } from './local-editing-presence';
import { LocalPresenceState } from './local-presence-state';

describe('local editing Presence', () => {
  it('accepts IDs at the backend limit and rejects longer IDs', () => { expect(validEditingElementId('x'.repeat(MAX_EDITING_ELEMENT_ID_LENGTH))).toHaveLength(MAX_EDITING_ELEMENT_ID_LENGTH); expect(validEditingElementId('x'.repeat(MAX_EDITING_ELEMENT_ID_LENGTH + 1))).toBeNull(); });
  it('publishes start and clear snapshots without losing other Presence fields', () => { const state = new LocalPresenceState(); state.setCursor({ x: 100, y: 200 }); state.setSelectionIds(['class-2', 'relationship-1']); state.setActivity('editing'); state.setEditingElementId(validEditingElementId('class-1')); expect(state.snapshot()).toEqual({ cursor: { x: 100, y: 200 }, selectionIds: ['class-2', 'relationship-1'], editingElementId: 'class-1', activity: 'editing' }); state.setEditingElementId(null); expect(state.snapshot()).toMatchObject({ editingElementId: null, cursor: { x: 100, y: 200 }, selectionIds: ['class-2', 'relationship-1'], activity: 'editing' }); });
});
