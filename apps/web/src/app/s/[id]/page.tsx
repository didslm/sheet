import { notFound } from 'next/navigation';
import { getSheet } from '@/lib/api';
import Editor from '@/components/Editor';

export const dynamic = 'force-dynamic';

export default async function SheetPage({ params }: { params: { id: string } }) {
  const sheet = await getSheet(params.id).catch(() => null);
  if (!sheet) notFound();
  return <Editor sheet={sheet} />;
}
