'use client';

import { Alert, Box, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useEditorStore } from '../../stores/editor-store';

export function DiagnosticsPanel() {
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const setSelection = useEditorStore((state) => state.setSelection);
  const document = useEditorStore((state) => state.currentDocument);
  const lastCommandError = useEditorStore((state) => state.lastCommandError);

  function selectDiagnostic(elementId?: string) {
    if (!elementId) {
      return;
    }
    if (document.model.classes.some((umlClass) => umlClass.id === elementId)) {
      setSelection({ type: 'class', id: elementId });
    } else if (document.model.enumerations.some((enumeration) => enumeration.id === elementId)) {
      setSelection({ type: 'enumeration', id: elementId });
    } else if (document.model.relationships.some((relationship) => relationship.id === elementId)) {
      setSelection({ type: 'relationship', id: elementId });
    }
  }

  return (
    <Box data-testid="diagnostics-panel" sx={{ borderTop: 1, borderColor: 'rgba(15,76,129,0.14)', p: 1.5, maxHeight: 220, overflowX: 'hidden', overflowY: 'auto', bgcolor: '#f8fbff' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase' }}>Diagnostics</Typography>
      {lastCommandError && <Alert severity="error" variant="outlined" sx={{ my: 1, py: 0.5 }}>{lastCommandError}</Alert>}
      {diagnostics.length === 0 && <Alert severity="success" variant="outlined" sx={{ mt: 1, py: 0.5 }}>Sin diagnosticos</Alert>}
      <List dense disablePadding sx={{ mt: 0.75 }}>
        {diagnostics.map((diagnostic) => (
          <ListItemButton key={`${diagnostic.code}-${diagnostic.path}`} onClick={() => selectDiagnostic(diagnostic.elementId)} sx={{ border: 1, borderColor: diagnostic.severity === 'ERROR' ? 'rgba(211,47,47,0.24)' : 'rgba(237,108,2,0.28)', borderRadius: 1, mb: 0.75, bgcolor: '#fff', alignItems: 'flex-start' }}>
            <ListItemText primary={`${diagnostic.severity}: ${diagnostic.message}`} secondary={diagnostic.path} primaryTypographyProps={{ color: diagnostic.severity === 'ERROR' ? 'error' : 'warning.main', fontWeight: 700, fontSize: 13 }} secondaryTypographyProps={{ sx: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
