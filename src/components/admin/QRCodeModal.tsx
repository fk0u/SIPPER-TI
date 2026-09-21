'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Copy, Check, Download, Printer, ExternalLink } from 'lucide-react';
import { toast } from '@/store/useToastStore';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  courseName?: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
  courseName,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !url) return;

    QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => {
        console.error('Failed to generate QR Code', err);
        toast.error('Gagal membuat QR Code.');
      });
  }, [isOpen, url]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    toast.success('Tautan berhasil disalin ke clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode-${title.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.click();
    toast.success('QR Code berhasil diunduh!');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="doppelrand-shell max-w-md w-full">
        <div className="doppelrand-core p-6 space-y-5">
          
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                  QR Code Akses Dosen
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                  {title}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition"
              aria-label="Tutup modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* QR Code Graphic Frame */}
          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-slate-200/80 shadow-inner">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR Code untuk ${title}`}
                className="w-56 h-56 object-contain rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs font-mono">
                Membuat QR Code...
              </div>
            )}
            <p className="text-[11px] font-medium text-slate-600 mt-2 font-mono text-center">
              Pindai dengan kamera HP dosen untuk membuka rekap
            </p>
          </div>

          {/* URL box */}
          <div className="p-2.5 bg-slate-100/90 dark:bg-white/[0.04] rounded-xl border border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
              {url}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition shrink-0"
              title="Salin tautan"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleDownload}
              className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh PNG</span>
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/20 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Tautan</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
