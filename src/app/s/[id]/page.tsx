import { notFound } from 'next/navigation';
import { loadSheet } from '@/lib/sheets';
import Editor from '@/components/Editor';

export const dynamic = 'force-dynamic';

export default async function SheetPage({ params }: { params: { id: string } }) {
  const sheet = await loadSheet(params.id).catch(() => null);
  if (!sheet) notFound();
  return <Editor sheet={sheet} />;
}
