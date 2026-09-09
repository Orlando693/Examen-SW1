import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UmlEditorClient } from '../../components/editor/UmlEditorClient';

export const metadata: Metadata = {
  title: 'Editor UML | Examen SW1 CASE',
  description: 'Workspace UML manual en memoria para CU-02',
};

export default function EditorPage() {
  return <Suspense fallback={null}><UmlEditorClient /></Suspense>;
}
