import type { PresenceInput } from './contracts';

const initial = (): PresenceInput => ({ cursor: null, selectionIds: [], editingElementId: null, activity: null });

export class LocalPresenceState {
  private value = initial();
  setCursor(cursor: PresenceInput['cursor']): void { this.value.cursor = cursor; }
  setSelectionIds(selectionIds: string[]): void { this.value.selectionIds = [...selectionIds]; }
  setEditingElementId(editingElementId: string | null): void { this.value.editingElementId = editingElementId; }
  setActivity(activity: PresenceInput['activity']): void { this.value.activity = activity; }
  snapshot(): PresenceInput { return { ...this.value, selectionIds: [...this.value.selectionIds] }; }
  reset(): void { this.value = initial(); }
}
