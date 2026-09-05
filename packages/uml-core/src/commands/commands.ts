import type { Uuid } from '../ids.js';
import type { DiagramPosition, DiagramSize } from '../model/layout.js';
import type { Multiplicity, UmlRelationshipKind } from '../model/relationships.js';
import type { GenerationMetadata, UmlTypeRef, Visibility } from '../model/types.js';

export type UmlCommand =
  | CreateClassCommand
  | DeleteClassCommand
  | RenameClassCommand
  | AddAttributeCommand
  | RemoveAttributeCommand
  | UpdateAttributeCommand
  | CreateAssociationCommand
  | UpdateMultiplicityCommand
  | MoveNodeCommand;

export interface CreateClassCommand {
  type: 'CreateClass';
  classId?: Uuid;
  name: string;
  packageId?: Uuid;
  generation?: GenerationMetadata;
}

export interface DeleteClassCommand {
  type: 'DeleteClass';
  classId: Uuid;
}

export interface RenameClassCommand {
  type: 'RenameClass';
  classId: Uuid;
  name: string;
}

export interface AddAttributeCommand {
  type: 'AddAttribute';
  classId: Uuid;
  attributeId?: Uuid;
  name: string;
  attributeType: UmlTypeRef;
  visibility?: Visibility;
  generation?: GenerationMetadata;
}

export interface RemoveAttributeCommand {
  type: 'RemoveAttribute';
  classId: Uuid;
  attributeId: Uuid;
}

export interface UpdateAttributeCommand {
  type: 'UpdateAttribute';
  classId: Uuid;
  attributeId: Uuid;
  name?: string;
  attributeType?: UmlTypeRef;
  visibility?: Visibility;
  generation?: GenerationMetadata;
}

export interface CreateAssociationCommand {
  type: 'CreateAssociation';
  relationshipId?: Uuid;
  kind?: Exclude<UmlRelationshipKind, 'generalization'>;
  name?: string;
  sourceClassId: Uuid;
  targetClassId: Uuid;
  sourceMultiplicity?: Multiplicity;
  targetMultiplicity?: Multiplicity;
}

export interface UpdateMultiplicityCommand {
  type: 'UpdateMultiplicity';
  relationshipId: Uuid;
  endpoint: 'source' | 'target';
  multiplicity: Multiplicity;
}

export interface MoveNodeCommand {
  type: 'MoveNode';
  elementId: Uuid;
  position: DiagramPosition;
  size?: DiagramSize;
  nodeId?: Uuid;
}
