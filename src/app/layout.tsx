import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';

export const metadata: Metadata = {
  title: 'SIPPER-TI | Sistem Perizinan & Presensi TI Internasional UMKT',
  description:
    'Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika Universitas Muhammadiyah Kalimantan Timur.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark scroll-smooth" suppressHydrationWarning>
      <body className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans bg-grid-pattern selection:bg-blue-600/30 selection:text-blue-200 pb-24 sm:pb-16 antialiased transition-colors">
        {/* Floating Island Navigation */}
        <Navbar />
        
        {/* Main Content Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 pb-8">
          {children}
        </main>

        {/* Ergonomic Mobile Bottom Navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
