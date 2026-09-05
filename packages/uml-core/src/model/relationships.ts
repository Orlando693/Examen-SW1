import type { Uuid } from '../ids.js';

export type MultiplicityUpperBound = number | '*';

export interface Multiplicity {
  lower: number;
  upper: MultiplicityUpperBound;
}

export interface UmlRelationshipEndpoint {
  classId: Uuid;
  roleName?: string;
  multiplicity?: Multiplicity;
}

export type UmlRelationshipKind = 'association' | 'aggregation' | 'composition' | 'generalization';

interface BaseRelationship {
  id: Uuid;
  name?: string;
}

export interface UmlAssociationRelationship extends BaseRelationship {
  kind: 'association' | 'aggregation' | 'composition';
  source: UmlRelationshipEndpoint;
  target: UmlRelationshipEndpoint;
}

export interface UmlGeneralizationRelationship extends BaseRelationship {
  kind: 'generalization';
  source: UmlRelationshipEndpoint;
  target: UmlRelationshipEndpoint;
}

export type UmlRelationship = UmlAssociationRelationship | UmlGeneralizationRelationship;

export const one: Multiplicity = { lower: 1, upper: 1 };
export const zeroToMany: Multiplicity = { lower: 0, upper: '*' };
