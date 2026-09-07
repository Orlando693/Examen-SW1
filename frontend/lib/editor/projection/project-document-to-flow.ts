import type { Edge, Node } from '@xyflow/react';
import type { DiagramNodeLayout, ProjectDocument, UmlClass, UmlEnumeration, UmlRelationship, ValidationDiagnostic } from '@examen-sw1/uml-core';

export type EditorSelection =
  | { type: 'class'; id: string }
  | { type: 'enumeration'; id: string }
  | { type: 'relationship'; id: string }
  | null;

export interface UmlClassNodeData extends Record<string, unknown> {
  elementId: string;
  name: string;
  attributes: string[];
  operations: string[];
  errorCount: number;
  warningCount: number;
}

export interface UmlEnumNodeData extends Record<string, unknown> {
  elementId: string;
  name: string;
  literals: Array<{ id: string; name: string }>;
  errorCount: number;
  warningCount: number;
}

export interface UmlRelationshipEdgeData extends Record<string, unknown> {
  relationshipId: string;
  kind: UmlRelationship['kind'];
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
}

export type UmlFlowNode = Node<UmlClassNodeData, 'umlClass'> | Node<UmlEnumNodeData, 'umlEnum'>;
export type UmlFlowEdge = Edge<UmlRelationshipEdgeData, 'umlRelationship'>;

export interface ProjectDocumentFlow {
  nodes: UmlFlowNode[];
  edges: UmlFlowEdge[];
}

export function projectDocumentToFlow(document: ProjectDocument, selection: EditorSelection = null, diagnostics: ValidationDiagnostic[] = []): ProjectDocumentFlow {
  const nodes: UmlFlowNode[] = [
    ...document.model.classes.map((umlClass, index) => classToFlowNode(umlClass, layoutFor(document, umlClass.id), index, selection, diagnostics)),
    ...document.model.enumerations.map((enumeration, index) => enumToFlowNode(enumeration, layoutFor(document, enumeration.id), index, selection, diagnostics)),
  ];

  const edges = document.model.relationships.map((relationship) => relationshipToFlowEdge(relationship, selection));

  return { nodes, edges };
}

export function classToFlowNode(umlClass: UmlClass, layout: DiagramNodeLayout | undefined, index: number, selection: EditorSelection, diagnostics: ValidationDiagnostic[]): UmlFlowNode {
  return {
    id: umlClass.id,
    type: 'umlClass',
    position: layout?.position ?? fallbackPosition(index, 0),
    selected: selection?.type === 'class' && selection.id === umlClass.id,
    data: {
      elementId: umlClass.id,
      name: umlClass.name,
      attributes: umlClass.attributes.map((attribute) => `${visibilitySymbol(attribute.visibility)} ${attribute.name}: ${formatType(attribute.type)}`),
      operations: umlClass.operations.map((operation) => `${visibilitySymbol(operation.visibility)} ${operation.name}(): ${formatType(operation.returnType)}`),
      ...diagnosticCounts(diagnostics, umlClass.id),
    },
  };
}

export function enumToFlowNode(enumeration: UmlEnumeration, layout: DiagramNodeLayout | undefined, index: number, selection: EditorSelection, diagnostics: ValidationDiagnostic[]): UmlFlowNode {
  return {
    id: enumeration.id,
    type: 'umlEnum',
    position: layout?.position ?? fallbackPosition(index, 1),
    selected: selection?.type === 'enumeration' && selection.id === enumeration.id,
    data: {
      elementId: enumeration.id,
      name: enumeration.name,
      literals: enumeration.literals.map((literal) => ({ id: literal.id, name: literal.name })),
      ...diagnosticCounts(diagnostics, enumeration.id),
    },
  };
}

export function relationshipToFlowEdge(relationship: UmlRelationship, selection: EditorSelection): UmlFlowEdge {
  return {
    id: relationship.id,
    type: 'umlRelationship',
    source: relationship.source.classId,
    target: relationship.target.classId,
    selected: selection?.type === 'relationship' && selection.id === relationship.id,
    label: relationship.name ?? relationship.kind,
    data: {
      relationshipId: relationship.id,
      kind: relationship.kind,
      label: relationship.name,
      sourceMultiplicity: formatMultiplicity(relationship.source.multiplicity),
      targetMultiplicity: formatMultiplicity(relationship.target.multiplicity),
    },
  };
}

export function formatMultiplicity(multiplicity: UmlRelationship['source']['multiplicity']): string | undefined {
  if (!multiplicity) {
    return undefined;
  }
  return multiplicity.lower === multiplicity.upper ? String(multiplicity.lower) : `${multiplicity.lower}..${multiplicity.upper}`;
}

function layoutFor(document: ProjectDocument, elementId: string): DiagramNodeLayout | undefined {
  return document.layout.nodes.find((node) => node.elementId === elementId);
}

function fallbackPosition(index: number, row: number) {
  return { x: 80 + index * 260, y: 80 + row * 220 };
}

function diagnosticCounts(diagnostics: ValidationDiagnostic[], elementId: string) {
  return {
    errorCount: diagnostics.filter((diagnostic) => diagnostic.elementId === elementId && diagnostic.severity === 'ERROR').length,
    warningCount: diagnostics.filter((diagnostic) => diagnostic.elementId === elementId && diagnostic.severity === 'WARNING').length,
  };
}

function visibilitySymbol(visibility: string): string {
  return { public: '+', private: '-', protected: '#', package: '~' }[visibility] ?? '';
}

function formatType(type: UmlClass['attributes'][number]['type']): string {
  if (type.kind === 'primitive' || type.kind === 'custom') {
    return type.name;
  }
  if (type.kind === 'class') {
    return type.classId;
  }
  return type.enumerationId;
}
