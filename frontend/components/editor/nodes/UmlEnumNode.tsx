'use client';

import { Box, Paper, Typography } from '@mui/material';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { UmlEnumNodeData } from '../../../lib/editor/projection/project-document-to-flow';

export function UmlEnumNode({ data, selected }: NodeProps) {
  const nodeData = data as UmlEnumNodeData;
  return (
    <Paper data-testid="uml-enum-node" elevation={0} sx={{ minWidth: 218, border: 1, borderColor: selected ? '#22A7B8' : '#C8D3DA', borderRadius: 0.75, overflow: 'hidden', bgcolor: '#F8FAFB', boxShadow: selected ? '0 0 0 2px rgba(34,167,184,0.35)' : 'none' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#22A7B8', borderColor: '#164E72' }} />
      <Box sx={{ bgcolor: '#ffffff', px: 1.25, py: 0.75, borderBottom: '1px solid #C8D3DA' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#647580', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontWeight: 900, letterSpacing: 1 }}>ENUM</Typography>
          {(nodeData.errorCount > 0 || nodeData.warningCount > 0) && <Typography variant="caption" sx={{ color: nodeData.errorCount > 0 ? '#C2413A' : '#D97706', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontWeight: 900 }}>{nodeData.errorCount > 0 ? `${nodeData.errorCount}E` : `${nodeData.warningCount}W`}</Typography>}
        </Box>
        <Typography fontWeight={900} sx={{ color: '#0B1F33' }}>{nodeData.name}</Typography>
      </Box>
      <Box sx={{ p: 1 }}>
        {nodeData.literals.map((literal) => <Typography key={literal.id} variant="body2" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12.5, color: '#0B1F33', lineHeight: 1.55 }}>{literal.name}</Typography>)}
      </Box>
      <Handle type="source" position={Position.Right} style={{ background: '#22A7B8', borderColor: '#164E72' }} />
    </Paper>
  );
}
