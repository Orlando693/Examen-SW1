import type { Uuid } from '../ids.js';
import type { DiagramPosition, DiagramSize } from '../model/layout.js';
import type { Multiplicity, UmlRelationshipKind } from '../model/relationships.js';
import type { GenerationMetadata, UmlTypeRef, Visibility } from '../model/types.js';

export type UmlCommand =
  | CreateClassCommand
  | DeleteClassCommand
  | RenameClassCommand
  | CreateEnumerationCommand
  | RenameEnumerationCommand
  | DeleteEnumerationCommand
  | AddEnumerationLiteralCommand
  | UpdateEnumerationLiteralCommand
  | RemoveEnumerationLiteralCommand
  | AddAttributeCommand
  | RemoveAttributeCommand
  | UpdateAttributeCommand
  | CreateAssociationCommand
  | CreateGeneralizationCommand
  | DeleteRelationshipCommand
  | UpdateMultiplicityCommand
  | MoveNodeCommand
  | ApplyLayoutCommand;

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

export interface CreateEnumerationCommand {
  type: 'CreateEnumeration';
  enumerationId?: Uuid;
  name: string;
  packageId?: Uuid;
  generation?: GenerationMetadata;
}

export interface RenameEnumerationCommand {
  type: 'RenameEnumeration';
  enumerationId: Uuid;
  name: string;
}

export interface DeleteEnumerationCommand {
  type: 'DeleteEnumeration';
  enumerationId: Uuid;
}

export interface AddEnumerationLiteralCommand {
  type: 'AddEnumerationLiteral';
  enumerationId: Uuid;
  literalId?: Uuid;
  name: string;
  generation?: GenerationMetadata;
}

export interface UpdateEnumerationLiteralCommand {
  type: 'UpdateEnumerationLiteral';
  enumerationId: Uuid;
  literalId: Uuid;
  name?: string;
  generation?: GenerationMetadata;
}

export interface RemoveEnumerationLiteralCommand {
  type: 'RemoveEnumerationLiteral';
  enumerationId: Uuid;
  literalId: Uuid;
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

export interface CreateGeneralizationCommand {
  type: 'CreateGeneralization';
  relationshipId?: Uuid;
  sourceClassId: Uuid;
  targetClassId: Uuid;
  name?: string;
}

export interface DeleteRelationshipCommand {
  type: 'DeleteRelationship';
  relationshipId: Uuid;
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

export interface ApplyLayoutCommand {
  type: 'ApplyLayout';
  updates: ApplyLayoutUpdate[];
}

export interface ApplyLayoutUpdate {
  elementId: Uuid;
  position: DiagramPosition;
  size?: DiagramSize;
  nodeId?: Uuid;
}
