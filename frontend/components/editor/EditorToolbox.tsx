'use client';

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Menu, MenuItem, Paper, Stack, TextField, Tooltip } from '@mui/material';
import { useCallback, useState } from 'react';
import { useEditorStore, type EditorTool } from '../../stores/editor-store';
import type { Multiplicity } from '@examen-sw1/uml-core';

type RelationshipTool = Exclude<EditorTool, 'select' | 'class' | 'enum'>;

const relationshipTools: Array<{ id: RelationshipTool; label: string }> = [
  { id: 'association', label: 'Asociación' },
  { id: 'aggregation', label: 'Agregación' },
  { id: 'composition', label: 'Composición' },
  { id: 'generalization', label: 'Herencia' },
];

export function EditorToolbox({ compact }: { compact: boolean }) {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const createClass = useEditorStore((state) => state.createClass);
  const createEnumeration = useEditorStore((state) => state.createEnumeration);
  const document = useEditorStore((state) => state.currentDocument);
  const createRelationship = useEditorStore((state) => state.createRelationship);
  const applyAutoLayout = useEditorStore((state) => state.applyAutoLayout);
  const [isRelationDialogOpen, setIsRelationDialogOpen] = useState(false);
  const [relationKind, setRelationKind] = useState<RelationshipTool>('association');
  const [sourceClassId, setSourceClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [relationshipName, setRelationshipName] = useState('');
  const [sourceMultiplicity, setSourceMultiplicity] = useState('');
  const [targetMultiplicity, setTargetMultiplicity] = useState('');
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const choose = useCallback((tool: EditorTool) => {
    if (tool === 'class') {
      createClass();
    } else if (tool === 'enum') {
      createEnumeration();
    }
    setActiveTool(tool === 'class' || tool === 'enum' ? 'select' : tool);
  }, [createClass, createEnumeration, setActiveTool]);

  const openRelationDialog = () => {
    const [firstClass] = document.model.classes;
    setRelationKind('association');
    setSourceClassId(firstClass?.id ?? '');
    setTargetClassId(document.model.classes.find((umlClass) => umlClass.id !== firstClass?.id)?.id ?? '');
    setRelationshipName('');
    setSourceMultiplicity('');
    setTargetMultiplicity('');
    setIsRelationDialogOpen(true);
  };

  const confirmRelation = () => {
    if (!sourceClassId || !targetClassId) return;
    if (createRelationship(relationKind, sourceClassId, targetClassId, {
      ...(relationshipName.trim() === '' ? {} : { name: relationshipName.trim() }),
      ...(relationKind === 'generalization' || sourceMultiplicity === '' ? {} : { sourceMultiplicity: parseMultiplicityPreset(sourceMultiplicity) }),
      ...(relationKind === 'generalization' || targetMultiplicity === '' ? {} : { targetMultiplicity: parseMultiplicityPreset(targetMultiplicity) }),
    })?.ok) {
      setIsRelationDialogOpen(false);
    }
  };

  return (
    <Paper
      data-testid="editor-toolbox"
      data-compact={compact ? 'true' : 'false'}
      elevation={3}
      sx={{
        position: 'absolute',
        zIndex: 5,
        left: '50%',
        right: 'auto',
        top: 'auto',
        bottom: { xs: 12, md: 18 },
        transform: 'translateX(-50%)',
        width: 'auto',
        maxWidth: compact ? 'calc(100% - 16px)' : 'min(calc(100% - 48px), 720px)',
        p: 0.75,
        overflowX: 'auto',
        overflowY: 'hidden',
        borderRadius: 1.5,
        border: 1,
        borderColor: '#C8D3DA',
        bgcolor: '#F8FAFB',
        boxShadow: '0 12px 28px rgba(11, 31, 51, 0.14)',
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 'max-content' }}>
        <ToolButton label="Select" active={activeTool === 'select'} onClick={() => choose('select')} />
        <Divider orientation="vertical" flexItem />
        <Box data-testid="toolbox-group-elements" sx={{ display: 'flex', gap: 0.5 }}>
          <ToolButton label="Clase" active={activeTool === 'class'} onClick={() => choose('class')} />
          {!compact && <ToolButton label="Enum" active={activeTool === 'enum'} onClick={() => choose('enum')} />}
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box data-testid="toolbox-group-relationships">
          <Tooltip title="Crear relación UML">
            <Button size="small" variant="text" aria-haspopup="dialog" onClick={openRelationDialog} sx={toolButtonSx(false)}>
              Relation
            </Button>
          </Tooltip>
          <Dialog open={isRelationDialogOpen} onClose={() => setIsRelationDialogOpen(false)} aria-labelledby="relation-dialog-title" fullWidth maxWidth="xs">
            <DialogTitle id="relation-dialog-title">Crear relación</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField select SelectProps={{ native: true }} label="Tipo de relación" value={relationKind} onChange={(event) => setRelationKind(event.target.value as RelationshipTool)} fullWidth>
                  {relationshipTools.map((tool) => <option key={tool.id} value={tool.id}>{tool.label}</option>)}
                </TextField>
                <TextField select SelectProps={{ native: true }} label="Origen" value={sourceClassId} onChange={(event) => setSourceClassId(event.target.value)} fullWidth>
                  {document.model.classes.map((umlClass) => <option key={umlClass.id} value={umlClass.id}>{umlClass.name}</option>)}
                </TextField>
                <TextField select SelectProps={{ native: true }} label="Destino" value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)} fullWidth>
                  {document.model.classes.map((umlClass) => <option key={umlClass.id} value={umlClass.id}>{umlClass.name}</option>)}
                </TextField>
                <TextField label="Nombre de relación" value={relationshipName} onChange={(event) => setRelationshipName(event.target.value)} fullWidth />
                {relationKind !== 'generalization' && <>
                  <MultiplicitySelect label="Multiplicidad origen" value={sourceMultiplicity} onChange={setSourceMultiplicity} />
                  <MultiplicitySelect label="Multiplicidad destino" value={targetMultiplicity} onChange={setTargetMultiplicity} />
                </>}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsRelationDialogOpen(false)}>Cancelar</Button>
              <Button variant="contained" onClick={confirmRelation} disabled={!sourceClassId || !targetClassId || sourceClassId === targetClassId}>Crear</Button>
            </DialogActions>
          </Dialog>
        </Box>
        <Divider orientation="vertical" flexItem />
        {!compact && <Button size="small" variant="text" onClick={() => void applyAutoLayout()} sx={toolButtonSx(false)}>Layout</Button>}
        {compact && (
          <Box data-testid="toolbox-group-more">
            <Button size="small" variant="text" aria-haspopup="menu" onClick={(event) => setMoreAnchor(event.currentTarget)} sx={toolButtonSx(false)}>More</Button>
            <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
              <MenuItem onClick={() => { setMoreAnchor(null); choose('enum'); }}>Enum</MenuItem>
              <MenuItem onClick={() => { setMoreAnchor(null); void applyAutoLayout(); }}>Layout</MenuItem>
            </Menu>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function MultiplicitySelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <TextField select SelectProps={{ native: true }} label={label} value={value} onChange={(event) => onChange(event.target.value)} helperText="Opcional" fullWidth>
    <option value="">Sin multiplicidad</option>
    <option value="0..1">0..1</option>
    <option value="1">1</option>
    <option value="0..*">0..*</option>
    <option value="1..*">1..*</option>
  </TextField>;
}

function parseMultiplicityPreset(value: string): Multiplicity {
  if (value === '0..1') return { lower: 0, upper: 1 };
  if (value === '1') return { lower: 1, upper: 1 };
  if (value === '1..*') return { lower: 1, upper: '*' };
  return { lower: 0, upper: '*' };
}

function ToolButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Tooltip title={label}>
      <Button size="small" variant={active ? 'contained' : 'text'} aria-pressed={active} onClick={onClick} sx={toolButtonSx(active)}>{label}</Button>
    </Tooltip>
  );
}

function toolButtonSx(active: boolean) {
  return {
    minWidth: 74,
    px: 1.25,
    color: active ? '#0B1F33' : '#0B1F33',
    bgcolor: active ? '#22A7B8' : 'transparent',
    border: 1,
    borderColor: active ? '#22A7B8' : 'transparent',
    borderRadius: 1,
    fontWeight: active ? 800 : 700,
    textTransform: 'none',
    whiteSpace: 'nowrap',
    '&:hover': { bgcolor: active ? '#22A7B8' : 'rgba(34,167,184,0.10)', borderColor: '#22A7B8' },
    '&:focus-visible': { outline: '2px solid rgba(34,167,184,0.42)', outlineOffset: 2 },
  };
}
