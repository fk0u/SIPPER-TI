import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'SIPPER-TI - Presensi & Perizinan Kelas Internasional TI UMKT',
  description:
    'Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika Universitas Muhammadiyah Kalimantan Timur.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 sm:pb-12">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
