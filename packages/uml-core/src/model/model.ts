import type { UmlRelationship } from './relationships.js';
import type { UmlClass, UmlEnumeration, UmlPackage } from './types.js';

export interface UmlModel {
  packages: UmlPackage[];
  classes: UmlClass[];
  enumerations: UmlEnumeration[];
  relationships: UmlRelationship[];
}

export type CanonicalUmlModel = UmlModel;

export function createEmptyUmlModel(): CanonicalUmlModel {
  return {
    packages: [],
    classes: [],
    enumerations: [],
    relationships: [],
  };
}
