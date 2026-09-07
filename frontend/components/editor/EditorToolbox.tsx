'use client';

import { Box, Button, Divider, Menu, MenuItem, Paper, Stack, Tooltip } from '@mui/material';
import { useCallback, useState } from 'react';
import { useEditorStore, type EditorTool } from '../../stores/editor-store';

const relationshipTools: Array<{ id: EditorTool; label: string }> = [
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
  const applyAutoLayout = useEditorStore((state) => state.applyAutoLayout);
  const [relationshipAnchor, setRelationshipAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const relationActive = relationshipTools.some((tool) => tool.id === activeTool);

  const choose = useCallback((tool: EditorTool) => {
    if (tool === 'class') {
      createClass();
    } else if (tool === 'enum') {
      createEnumeration();
    }
    setActiveTool(tool === 'class' || tool === 'enum' ? 'select' : tool);
  }, [createClass, createEnumeration, setActiveTool]);

  const chooseRelationship = useCallback((tool: EditorTool) => {
    setRelationshipAnchor(null);
    choose(tool);
  }, [choose]);

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
            <Button size="small" variant={relationActive ? 'contained' : 'text'} aria-pressed={relationActive} aria-haspopup="menu" onClick={(event) => setRelationshipAnchor(event.currentTarget)} sx={toolButtonSx(relationActive)}>
              Relation
            </Button>
          </Tooltip>
          <Menu anchorEl={relationshipAnchor} open={Boolean(relationshipAnchor)} onClose={() => setRelationshipAnchor(null)}>
            {relationshipTools.map((tool) => <MenuItem key={tool.id} selected={activeTool === tool.id} onClick={() => chooseRelationship(tool.id)}>{tool.label}</MenuItem>)}
          </Menu>
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
