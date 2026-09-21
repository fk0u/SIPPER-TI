'use client';

import React, { useState, useEffect } from 'react';
import { LeaveAttachment } from '@/types/database';
import { X, ExternalLink, FileText, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachments: LeaveAttachment[];
  title?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  attachments,
  title = 'Berkas Bukti Perizinan',
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Keyboard shortcut support (Escape to close, Arrows to paginate)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && attachments.length > 1) {
        setSelectedIndex((prev) => (prev + 1) % attachments.length);
        setIsZoomed(false);
      } else if (e.key === 'ArrowLeft' && attachments.length > 1) {
        setSelectedIndex((prev) => (prev - 1 + attachments.length) % attachments.length);
        setIsZoomed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, attachments.length]);

  if (!isOpen || attachments.length === 0) return null;

  const currentFile = attachments[selectedIndex] || attachments[0];
  const isPdf = currentFile.name.toLowerCase().endsWith('.pdf') || currentFile.type.includes('pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-[#0b0f19] border border-slate-200/90 dark:border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/80 dark:bg-black/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-mono">
                {currentFile.name} • {currentFile.size ? `${(currentFile.size / 1024).toFixed(0)} KB` : 'Lampiran'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isPdf && (
              <button
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition"
                title={isZoomed ? 'Perkecil' : 'Perbesar'}
              >
                {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              </button>
            )}
            <a
              href={currentFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition"
              title="Buka di tab baru"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition"
              title="Tutup (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="relative flex-1 overflow-auto p-4 bg-slate-100/50 dark:bg-black/40 flex items-center justify-center min-h-[320px] max-h-[70vh]">
          {isPdf ? (
            <div className="w-full h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-black/30 rounded-2xl border border-slate-200/80 dark:border-white/5">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mb-3">
                <FileText className="w-8 h-8 text-rose-500" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                Dokumen Lampiran PDF Resmi
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm leading-relaxed">
                Surat keterangan resmi dalam format PDF. Silakan buka dokumen di tab baru atau unduh untuk pemeriksaan stempel instansi.
              </p>
              <a
                href={currentFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition active:scale-95"
              >
                <Download className="w-4 h-4" /> Buka Dokumen PDF Penuh
              </a>
            </div>
          ) : (
            <div className={`transition-transform duration-200 ${isZoomed ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'}`}>
              <img
                src={currentFile.url}
                alt={currentFile.name}
                onClick={() => setIsZoomed(!isZoomed)}
                className="max-h-[64vh] w-auto max-w-full rounded-xl shadow-lg object-contain border border-slate-200/80 dark:border-white/10"
              />
            </div>
          )}
        </div>

        {/* Multi-file switcher footer */}
        {attachments.length > 1 && (
          <div className="px-4 sm:px-6 py-2.5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-black/30 flex items-center justify-between gap-2 overflow-x-auto">
            <span className="text-[10px] font-mono text-slate-500">
              Lampiran {selectedIndex + 1} dari {attachments.length}
            </span>
            <div className="flex items-center gap-1.5">
              {attachments.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedIndex(idx);
                    setIsZoomed(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition border active:scale-95 ${
                    selectedIndex === idx
                      ? 'bg-blue-600/15 border-blue-500 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'bg-white dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[100px]">{file.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DocumentViewerModal;
