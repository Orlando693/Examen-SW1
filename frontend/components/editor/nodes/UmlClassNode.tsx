'use client';

import { Box, Divider, Paper, Typography } from '@mui/material';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { UmlClassNodeData } from '../../../lib/editor/projection/project-document-to-flow';

export function UmlClassNode({ data, selected }: NodeProps) {
  const nodeData = data as UmlClassNodeData;
  return (
    <Paper data-testid="uml-class-node" elevation={0} sx={{ minWidth: 238, border: 1, borderColor: selected ? '#22A7B8' : '#C8D3DA', borderRadius: 0.75, overflow: 'hidden', bgcolor: '#F8FAFB', boxShadow: selected ? '0 0 0 2px rgba(34,167,184,0.35)' : 'none' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#22A7B8', borderColor: '#164E72' }} />
      <Box sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid #C8D3DA', bgcolor: '#ffffff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#647580', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontWeight: 900, letterSpacing: 1 }}>CLASS</Typography>
          {(nodeData.errorCount > 0 || nodeData.warningCount > 0) && <Typography variant="caption" sx={{ color: nodeData.errorCount > 0 ? '#C2413A' : '#D97706', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontWeight: 900 }}>{nodeData.errorCount > 0 ? `${nodeData.errorCount}E` : `${nodeData.warningCount}W`}</Typography>}
        </Box>
        <Typography fontWeight={900} sx={{ color: '#0B1F33', letterSpacing: 0.1 }}>{nodeData.name}</Typography>
      </Box>
      <Box sx={{ p: 1, minHeight: 48 }}>
        {nodeData.attributes.length === 0 ? <Typography variant="caption" color="text.secondary">Sin atributos</Typography> : nodeData.attributes.map((attribute) => <MemberRow key={attribute} value={attribute} />)}
      </Box>
      <Divider sx={{ borderColor: '#C8D3DA' }} />
      <Box sx={{ p: 1, minHeight: 38 }}>
        {nodeData.operations.length === 0 ? <Typography variant="caption" color="text.secondary">Sin operaciones</Typography> : nodeData.operations.map((operation) => <MemberRow key={operation} value={operation} />)}
      </Box>
      <Handle type="source" position={Position.Right} style={{ background: '#22A7B8', borderColor: '#164E72' }} />
    </Paper>
  );
}

function MemberRow({ value }: { value: string }) {
  const [left, right] = value.includes('):') ? value.split('):', 2) : value.split(':', 2);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1.5, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12.5, lineHeight: 1.55 }}>
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0B1F33' }}>{left}{value.includes('):') ? ')' : ''}</Box>
      {right && <Box component="span" sx={{ color: '#647580' }}>{right.trim()}</Box>}
    </Box>
  );
}
