'use client';

import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useEditorStore } from '../../stores/editor-store';
import type { Multiplicity, PrimitiveTypeName, UmlTypeRef } from '@examen-sw1/uml-core';

const primitiveTypeOptions: PrimitiveTypeName[] = ['string', 'number', 'boolean', 'date', 'datetime'];

export function InspectorPanel({ onEditingChange }: { onEditingChange?: (elementId: string | null) => void }) {
  const document = useEditorStore((state) => state.currentDocument);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const selection = useEditorStore((state) => state.selection);
  const renameClass = useEditorStore((state) => state.renameClass);
  const deleteClass = useEditorStore((state) => state.deleteClass);
  const addAttribute = useEditorStore((state) => state.addAttribute);
  const updateAttribute = useEditorStore((state) => state.updateAttribute);
  const removeAttribute = useEditorStore((state) => state.removeAttribute);
  const renameEnumeration = useEditorStore((state) => state.renameEnumeration);
  const deleteEnumeration = useEditorStore((state) => state.deleteEnumeration);
  const addEnumerationLiteral = useEditorStore((state) => state.addEnumerationLiteral);
  const updateEnumerationLiteral = useEditorStore((state) => state.updateEnumerationLiteral);
  const removeEnumerationLiteral = useEditorStore((state) => state.removeEnumerationLiteral);
  const updateRelationship = useEditorStore((state) => state.updateRelationship);
  const deleteRelationship = useEditorStore((state) => state.deleteRelationship);
  const collaborationRequired = useEditorStore((state) => state.collaborationRequired);
  const collaborationState = useEditorStore((state) => state.collaborationState);
  const realtimeCommandPending = useEditorStore((state) => state.realtimeCommandPending);
  const mutationsBlocked = collaborationRequired && (collaborationState !== 'connected' || realtimeCommandPending);
  const [draftName, setDraftName] = useState('');

  const selectedClass = selection?.type === 'class' ? document.model.classes.find((umlClass) => umlClass.id === selection.id) : undefined;
  const selectedEnum = selection?.type === 'enumeration' ? document.model.enumerations.find((enumeration) => enumeration.id === selection.id) : undefined;
  const selectedRelationship = selection?.type === 'relationship' ? document.model.relationships.find((relationship) => relationship.id === selection.id) : undefined;
  const selectedDiagnostics = selection ? diagnostics.filter((diagnostic) => diagnostic.elementId === selection.id) : [];

  return (
    <Box data-testid="inspector-panel" onFocusCapture={() => onEditingChange?.(selection?.id ?? null)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onEditingChange?.(null); }} sx={{ p: 2, overflowX: 'hidden', overflowY: 'auto', minWidth: 0, bgcolor: '#ffffff' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase' }}>Inspector</Typography>
      {!selection && (
        <Paper variant="outlined" sx={{ mt: 1.5, p: 2, borderColor: 'rgba(15,76,129,0.14)', bgcolor: '#f8fbff' }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0b355d' }}>Nada seleccionado</Typography>
          <Typography variant="body2" color="text.secondary">Selecciona una clase, enum o relacion para editar sus propiedades.</Typography>
        </Paper>
      )}

      {selectedClass && (
        <Stack spacing={1.5} data-testid="inspector-class-sections">
          <Typography variant="h6" sx={{ color: '#0b355d' }}>Clase</Typography>
          <SectionTitle>General</SectionTitle>
          <TextField label="Nombre" size="small" fullWidth defaultValue={selectedClass.name} onChange={(event) => setDraftName(event.target.value)} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => renameClass(selectedClass.id, draftName || selectedClass.name)} disabled={mutationsBlocked}>Renombrar</Button>
            <Button color="error" onClick={() => deleteClass(selectedClass.id)} disabled={mutationsBlocked}>Eliminar</Button>
          </Stack>
          <Divider sx={{ borderColor: 'rgba(15,76,129,0.12)' }} />
          <SectionTitle>Attributes</SectionTitle>
           <Button variant="outlined" onClick={() => addAttribute(selectedClass.id)} disabled={mutationsBlocked} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>Agregar atributo</Button>
          {selectedClass.attributes.map((attribute) => (
            <Paper key={attribute.id} variant="outlined" sx={{ p: 1.25, borderColor: 'rgba(15,76,129,0.14)', bgcolor: '#fbfdff' }}>
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">Atributo</Typography>
                <TextField label="Nombre atributo" slotProps={{ htmlInput: { 'aria-label': `attribute-${attribute.id}` } }} fullWidth size="small" disabled={mutationsBlocked} defaultValue={attribute.name} onBlur={(event) => updateAttribute(selectedClass.id, attribute.id, event.target.value)} />
                <TextField
                  select
                  SelectProps={{ native: true }}
                  slotProps={{ htmlInput: { 'aria-label': `attribute-type-${attribute.id}` } }}
                  label="Tipo"
                  fullWidth
                  size="small"
                  disabled={mutationsBlocked}
                  value={typeToSelectValue(attribute.type)}
                  onChange={(event) => updateAttribute(selectedClass.id, attribute.id, undefined, selectValueToType(event.target.value))}
                >
                  {primitiveTypeOptions.map((name) => <option key={`primitive:${name}`} value={`primitive:${name}`}>{name}</option>)}
                  {document.model.classes.map((umlClass) => <option key={`class:${umlClass.id}`} value={`class:${umlClass.id}`}>{umlClass.name}</option>)}
                  {document.model.enumerations.map((enumeration) => <option key={`enumeration:${enumeration.id}`} value={`enumeration:${enumeration.id}`}>{enumeration.name}</option>)}
                </TextField>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button color="error" onClick={() => removeAttribute(selectedClass.id, attribute.id)} disabled={mutationsBlocked}>Eliminar atributo</Button>
                </Box>
              </Stack>
            </Paper>
          ))}
          <DiagnosticSummary diagnostics={selectedDiagnostics} />
        </Stack>
      )}

      {selectedEnum && (
        <Stack spacing={1.5} data-testid="inspector-enum-sections">
          <Typography variant="h6" sx={{ color: '#0b355d' }}>Enumeration</Typography>
          <SectionTitle>General</SectionTitle>
          <TextField label="Nombre" size="small" fullWidth defaultValue={selectedEnum.name} onChange={(event) => setDraftName(event.target.value)} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={() => renameEnumeration(selectedEnum.id, draftName || selectedEnum.name)} disabled={mutationsBlocked}>Renombrar</Button>
            <Button color="error" onClick={() => deleteEnumeration(selectedEnum.id)} disabled={mutationsBlocked}>Eliminar</Button>
          </Stack>
          <Divider sx={{ borderColor: 'rgba(15,76,129,0.12)' }} />
          <SectionTitle>Literals</SectionTitle>
           <Button variant="outlined" onClick={() => addEnumerationLiteral(selectedEnum.id)} disabled={mutationsBlocked} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>Agregar literal</Button>
          {selectedEnum.literals.map((literal) => (
            <Stack key={literal.id} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <TextField slotProps={{ htmlInput: { 'aria-label': `literal-${literal.id}` } }} size="small" fullWidth disabled={mutationsBlocked} defaultValue={literal.name} onBlur={(event) => updateEnumerationLiteral(selectedEnum.id, literal.id, event.target.value)} />
              <Button color="error" onClick={() => removeEnumerationLiteral(selectedEnum.id, literal.id)} disabled={mutationsBlocked}>Quitar</Button>
            </Stack>
          ))}
          <DiagnosticSummary diagnostics={selectedDiagnostics} />
        </Stack>
      )}

      {selectedRelationship && (
        <Stack spacing={1.5} data-testid="inspector-relationship-sections">
          <Typography variant="h6" sx={{ color: '#0b355d' }}>Relacion</Typography>
          <SectionTitle>General</SectionTitle>
          <Typography variant="body2">Tipo: {selectedRelationship.kind}</Typography>
          <Typography variant="body2">Origen: {selectedRelationship.source.classId}</Typography>
          <Typography variant="body2">Destino: {selectedRelationship.target.classId}</Typography>
          {selectedRelationship.kind !== 'generalization' && (
            <>
              <Divider sx={{ borderColor: 'rgba(15,76,129,0.12)' }} />
              <SectionTitle>Multiplicity</SectionTitle>
               <RelationshipEditor relationship={selectedRelationship} updateRelationship={updateRelationship} disabled={mutationsBlocked} />
            </>
          )}
           {selectedRelationship.kind === 'generalization' && <RelationshipEditor relationship={selectedRelationship} updateRelationship={updateRelationship} disabled={mutationsBlocked} />}
           <Button color="error" onClick={() => deleteRelationship(selectedRelationship.id)} disabled={mutationsBlocked}>Eliminar relacion</Button>
          <DiagnosticSummary diagnostics={selectedDiagnostics} />
        </Stack>
      )}
    </Box>
  );
}

function RelationshipEditor({ relationship, updateRelationship, disabled }: { relationship: { id: string; kind: string; name?: string; source: { multiplicity?: Multiplicity }; target: { multiplicity?: Multiplicity } }; updateRelationship: (relationshipId: string, details: { name: string | null; sourceMultiplicity?: Multiplicity | null; targetMultiplicity?: Multiplicity | null }) => unknown; disabled: boolean }) {
  const [name, setName] = useState(relationship.name ?? '');
  const [sourceMultiplicity, setSourceMultiplicity] = useState(multiplicityPreset(relationship.source.multiplicity));
  const [targetMultiplicity, setTargetMultiplicity] = useState(multiplicityPreset(relationship.target.multiplicity));

  useEffect(() => {
    setName(relationship.name ?? '');
    setSourceMultiplicity(multiplicityPreset(relationship.source.multiplicity));
    setTargetMultiplicity(multiplicityPreset(relationship.target.multiplicity));
  }, [relationship.id, relationship.name, relationship.source.multiplicity, relationship.target.multiplicity]);

  return <Stack spacing={1}>
    <TextField label="Nombre de relación" size="small" fullWidth disabled={disabled} value={name} onChange={(event) => setName(event.target.value)} helperText="Deje vacío para quitarlo." />
    {relationship.kind !== 'generalization' && <>
      <MultiplicitySelect label="Multiplicidad origen" value={sourceMultiplicity} onChange={setSourceMultiplicity} disabled={disabled} />
      <MultiplicitySelect label="Multiplicidad destino" value={targetMultiplicity} onChange={setTargetMultiplicity} disabled={disabled} />
    </>}
    <Button variant="outlined" disabled={disabled} onClick={() => updateRelationship(relationship.id, {
      name: name.trim() === '' ? null : name.trim(),
      ...(relationship.kind === 'generalization' ? {} : {
        sourceMultiplicity: parseMultiplicityPreset(sourceMultiplicity),
        targetMultiplicity: parseMultiplicityPreset(targetMultiplicity),
      }),
    })}>Guardar cambios</Button>
  </Stack>;
}

function MultiplicitySelect({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <TextField select SelectProps={{ native: true }} label={label} size="small" fullWidth disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Sin multiplicidad</option>
    <option value="0..1">0..1</option>
    <option value="1">1</option>
    <option value="0..*">0..*</option>
    <option value="1..*">1..*</option>
  </TextField>;
}

function multiplicityPreset(multiplicity: Multiplicity | undefined): string {
  if (!multiplicity) return '';
  if (multiplicity.lower === 0 && multiplicity.upper === 1) return '0..1';
  if (multiplicity.lower === 1 && multiplicity.upper === 1) return '1';
  if (multiplicity.lower === 1 && multiplicity.upper === '*') return '1..*';
  return '0..*';
}

function parseMultiplicityPreset(value: string): Multiplicity | null {
  if (value === '') return null;
  if (value === '0..1') return { lower: 0, upper: 1 };
  if (value === '1') return { lower: 1, upper: 1 };
  if (value === '1..*') return { lower: 1, upper: '*' };
  return { lower: 0, upper: '*' };
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase' }}>{children}</Typography>;
}

function DiagnosticSummary({ diagnostics }: { diagnostics: Array<{ severity: string; message: string }> }) {
  return (
    <Box data-testid="inspector-diagnostics-section" sx={{ pt: 0.5 }}>
      <SectionTitle>Diagnostics</SectionTitle>
      {diagnostics.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Sin diagnosticos para la seleccion.</Typography>
      ) : diagnostics.map((diagnostic) => (
        <Alert key={`${diagnostic.severity}-${diagnostic.message}`} severity={diagnostic.severity === 'ERROR' ? 'error' : 'warning'} variant="outlined" sx={{ mt: 0.75, py: 0 }}>{diagnostic.message}</Alert>
      ))}
    </Box>
  );
}

function typeToSelectValue(type: UmlTypeRef): string {
  if (type.kind === 'primitive') {
    return `primitive:${type.name}`;
  }
  if (type.kind === 'class') {
    return `class:${type.classId}`;
  }
  if (type.kind === 'enumeration') {
    return `enumeration:${type.enumerationId}`;
  }
  return `custom:${type.name}`;
}

function selectValueToType(value: string): UmlTypeRef {
  const [kind, id] = value.split(':', 2);
  if (kind === 'class') {
    return { kind: 'class', classId: id ?? '' };
  }
  if (kind === 'enumeration') {
    return { kind: 'enumeration', enumerationId: id ?? '' };
  }
  return { kind: 'primitive', name: (id ?? 'string') as PrimitiveTypeName };
}
