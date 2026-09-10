'use client';

import { Box, Divider, List, ListItem, ListItemText, Tooltip, Typography } from '@mui/material';
import { useEditorStore } from '../../stores/editor-store';

export function EditorSidebar({ compact }: { compact: boolean }) {
  const document = useEditorStore((state) => state.currentDocument);
  const projectId = useEditorStore((state) => state.projectId);

  return (
    <Box data-testid="editor-sidebar" sx={{ width: compact ? 280 : 220, flex: compact ? '0 0 auto' : '0 0 220px', minWidth: 0, borderRight: compact ? 0 : 1, borderColor: '#C8D3DA', bgcolor: '#F8FAFB', p: 1.5, overflowX: 'hidden', overflowY: 'auto' }}>
      <Typography variant="caption" sx={{ color: '#647580', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>Model Rail</Typography>
      <Typography variant="h6" fontWeight={900} sx={{ color: '#0B1F33', lineHeight: 1.1, mt: 0.25 }}>Modelo UML</Typography>
      {!projectId && <Tooltip title="Demo temporal en memoria.">
        <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mt: 1.25, mb: 1.25, px: 0.75, py: 0.25, border: '1px solid #C8D3DA', borderRadius: 1, color: '#164E72', fontWeight: 800, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }}><Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22A7B8' }} />LOCAL DEMO</Typography>
      </Tooltip>}
      <Divider sx={{ borderColor: '#C8D3DA' }} />
      <List dense>
        <ListItem disableGutters><ListItemText primary="Classes" secondary={`${document.model.classes.length} nodes`} primaryTypographyProps={{ fontWeight: 800, color: '#0B1F33' }} secondaryTypographyProps={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', color: '#647580' }} /></ListItem>
        <ListItem disableGutters><ListItemText primary="Enums" secondary={`${document.model.enumerations.length} nodes`} primaryTypographyProps={{ fontWeight: 800, color: '#0B1F33' }} secondaryTypographyProps={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', color: '#647580' }} /></ListItem>
        <ListItem disableGutters><ListItemText primary="Relationships" secondary={`${document.model.relationships.length} edges`} primaryTypographyProps={{ fontWeight: 800, color: '#0B1F33' }} secondaryTypographyProps={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', color: '#647580' }} /></ListItem>
      </List>
    </Box>
  );
}
