'use client';

import React, { useState } from 'react';
import { LeaveAttachment } from '@/types/database';
import { X, ExternalLink, FileText, Download, ZoomIn, ZoomOut } from 'lucide-react';

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

  if (!isOpen || attachments.length === 0) return null;

  const currentFile = attachments[selectedIndex] || attachments[0];
  const isPdf = currentFile.name.toLowerCase().endsWith('.pdf') || currentFile.type.includes('pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white leading-tight">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{currentFile.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPdf && (
              <button
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                title={isZoomed ? 'Perkecil' : 'Perbesar'}
              >
                {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
              </button>
            )}
            <a
              href={currentFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Buka di tab baru"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative flex-1 overflow-auto p-4 bg-slate-950/40 flex items-center justify-center min-h-[360px] max-h-[70vh]">
          {isPdf ? (
            <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center text-center p-6 bg-slate-900/60 rounded-xl border border-slate-800">
              <FileText className="w-16 h-16 text-rose-400 mb-3" />
              <h4 className="text-sm font-medium text-white mb-1">Dokumen Lampiran PDF</h4>
              <p className="text-xs text-slate-400 mb-4 max-w-md">
                Berkas PDF dapat dilihat secara penuh atau diunduh untuk verifikasi stempel klinik / instansi.
              </p>
              <a
                href={currentFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg transition"
              >
                <Download className="w-4 h-4" /> Unduh / Buka Dokumen PDF
              </a>
            </div>
          ) : (
            <div className={`transition-transform duration-200 ${isZoomed ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'}`}>
              <img
                src={currentFile.url}
                alt={currentFile.name}
                onClick={() => setIsZoomed(!isZoomed)}
                className="max-h-[65vh] w-auto max-w-full rounded-lg shadow-lg object-contain border border-slate-800"
              />
            </div>
          )}
        </div>

        {/* Multiple Attachments Thumbnails (if > 1) */}
        {attachments.length > 1 && (
          <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2 overflow-x-auto">
            {attachments.map((file, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedIndex(idx);
                  setIsZoomed(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition border ${
                  selectedIndex === idx
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 font-medium'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px]">{file.name}</span>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
