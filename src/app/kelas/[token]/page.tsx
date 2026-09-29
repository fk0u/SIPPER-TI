import { connection } from 'next/server';
import { ClassBoardView } from '@/components/schedule/ClassBoardView';
import { fetchClassBoard } from '@/lib/publicPortal';

export const metadata = {
  title: 'Papan Jadwal Kelas - SIPPER-TI',
  description: 'Jadwal kuliah kelas',
  robots: { index: false, follow: false },
};

export default async function ClassBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connection();
  const board = await fetchClassBoard(token);
  return (
    <div className="py-4 sm:py-6">
      <ClassBoardView board={board} token={token} />
    </div>
  );
}
