# Architecture Contract

## Source Of Truth

`ProjectDocument.model` is UML semantics. `ProjectDocument.layout` is persistible logical placement only. React Flow receives `Node[]` and `Edge[]` produced by a projection adapter.

```text
ProjectDocument.model + ProjectDocument.layout
  -> projectDocumentToFlow
  -> React Flow nodes / edges
```

Never persist React Flow internals as the UML model. Do not make `Node[]` or `Edge[]` a second editable domain.

## Mutation Route

Every UML mutation follows:

```text
UI intent -> UmlCommand -> UmlCommandBus / UmlHistory
  -> ProjectDocument -> projection -> React Flow
```

- Node drag completion emits `MoveNode` and updates `DiagramLayout`.
- Auto layout calculates with ELK, then applies one `ApplyLayout` command to `DiagramLayout`.
- Future collaboration transmits/reconciles commands and authoritative documents, not React Flow store mutations.
- Responsive presentation changes viewport and chrome only; it never rewrites `DiagramLayout`.

The adapter may enrich nodes with diagnostics or UI selection, but semantic relationship kind, multiplicity, endpoints, and validation remain in the canonical model.
