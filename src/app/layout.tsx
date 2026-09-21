import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { BottomNav } from '@/components/layout/BottomNav';
import { ToastContainer } from '@/components/ui/ToastContainer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SIPPER-TI | Sistem Perizinan & Presensi TI Internasional UMKT',
  description:
    'Sistem Informasi Perizinan & Presensi Kelas Internasional Teknik Informatika Universitas Muhammadiyah Kalimantan Timur.',
  applicationName: 'SIPPER-TI',
  authors: [{ name: 'Teknik Informatika UMKT' }],
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#06090e' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`dark scroll-smooth ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] bg-[#f8fafc] dark:bg-[#06090e] text-[#090d16] dark:text-[#f8fafc] flex flex-col font-sans bg-grid-ambient selection:bg-blue-600/20 selection:text-blue-600 dark:selection:bg-blue-500/30 dark:selection:text-blue-300 pb-28 sm:pb-20 antialiased transition-colors duration-200">
        {/* Global Toast Notifications */}
        <ToastContainer />

        {/* Floating Island Navigation */}
        <Navbar />

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-10">
          {children}
        </main>

        {/* Ergonomic Mobile Floating Dock Navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
