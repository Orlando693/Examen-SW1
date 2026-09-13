export const MAX_EDITING_ELEMENT_ID_LENGTH = 64;
export function validEditingElementId(id: string | null): string | null { return id !== null && id.length <= MAX_EDITING_ELEMENT_ID_LENGTH ? id : null; }
