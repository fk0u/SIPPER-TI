'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { 
  GraduationCap, 
  Sparkles, 
  ExternalLink, 
  ShieldCheck, 
  LogOut,
  User as UserIcon,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export interface StaggeredMenuItem {
  label: string;
  sublabel?: string;
  link: string;
  badge?: string | number;
  icon?: React.ElementType;
  roleRequired?: ('mahasiswa' | 'sipen' | 'km')[];
}

interface StaggeredMenuProps {
  position?: 'left' | 'right';
  colors?: string[];
  items?: StaggeredMenuItem[];
  accentColor?: string;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export const StaggeredMenu: React.FC<StaggeredMenuProps> = ({
  position = 'right',
  colors = ['#1e293b', '#1d4ed8', '#0f172a'],
  items = [],
  accentColor = '#3b82f6',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const iconHRef = useRef<HTMLSpanElement | null>(null);
  const iconVRef = useRef<HTMLSpanElement | null>(null);
  const textInnerRef = useRef<HTMLDivElement | null>(null);
  const isBusyRef = useRef(false);

  // Close menu when pathname changes
  useEffect(() => {
    if (isOpen) {
      handleClose();
    }
  }, [pathname]);

  // Initial GSAP Setup
  useEffect(() => {
    const panel = panelRef.current;
    const preContainer = preLayersRef.current;
    const backdrop = backdropRef.current;
    const iconH = iconHRef.current;
    const iconV = iconVRef.current;
    const textInner = textInnerRef.current;

    if (!panel || !preContainer || !backdrop || !iconH || !iconV || !textInner) return;

    const preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLElement[];
    const offscreen = position === 'left' ? -100 : 100;

    gsap.set([panel, ...preLayers], { xPercent: offscreen });
    gsap.set(backdrop, { opacity: 0, pointerEvents: 'none' });
    gsap.set(iconH, { rotate: 0, transformOrigin: '50% 50%' });
    gsap.set(iconV, { rotate: 90, transformOrigin: '50% 50%' });
    gsap.set(textInner, { yPercent: 0 });
  }, [position]);

  // Build Open Timeline
  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const preContainer = preLayersRef.current;
    const backdrop = backdropRef.current;
    const iconH = iconHRef.current;
    const iconV = iconVRef.current;
    const textInner = textInnerRef.current;

    if (!panel || !preContainer || !backdrop || !iconH || !iconV || !textInner) return null;

    openTlRef.current?.kill();
    closeTweenRef.current?.kill();

    const preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLElement[];
    const itemEls = Array.from(panel.querySelectorAll('.sm-item-label')) as HTMLElement[];
    const itemNumbers = Array.from(panel.querySelectorAll('.sm-item-num')) as HTMLElement[];
    const footers = Array.from(panel.querySelectorAll('.sm-footer-el')) as HTMLElement[];

    const offscreen = position === 'left' ? -100 : 100;

    // Reset initial positions
    gsap.set(itemEls, { yPercent: 120, opacity: 0 });
    gsap.set(itemNumbers, { opacity: 0, x: -10 });
    gsap.set(footers, { y: 20, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    // Backdrop reveal
    tl.to(backdrop, { opacity: 1, pointerEvents: 'auto', duration: 0.35, ease: 'power2.out' }, 0);

    // Toggle button morph to 'X'
    tl.to(iconH, { rotate: 45, duration: 0.35, ease: 'back.out(2)' }, 0);
    tl.to(iconV, { rotate: -45, duration: 0.35, ease: 'back.out(2)' }, 0);
    tl.to(textInner, { yPercent: -50, duration: 0.35, ease: 'power2.inOut' }, 0);

    // Pre-layers staggered slide
    preLayers.forEach((layer, i) => {
      tl.fromTo(
        layer,
        { xPercent: offscreen },
        { xPercent: 0, duration: 0.45, ease: 'power4.out' },
        i * 0.06
      );
    });

    const panelStartTime = preLayers.length ? preLayers.length * 0.05 : 0;

    // Main Panel slide
    tl.fromTo(
      panel,
      { xPercent: offscreen },
      { xPercent: 0, duration: 0.55, ease: 'power4.out' },
      panelStartTime
    );

    // Staggered Items entrance
    const itemsStartTime = panelStartTime + 0.15;
    tl.to(
      itemEls,
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.45,
        ease: 'power3.out',
        stagger: 0.06,
      },
      itemsStartTime
    );

    tl.to(
      itemNumbers,
      {
        opacity: 1,
        x: 0,
        duration: 0.4,
        ease: 'power2.out',
        stagger: 0.06,
      },
      itemsStartTime + 0.05
    );

    tl.to(
      footers,
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power3.out',
        stagger: 0.05,
      },
      itemsStartTime + 0.2
    );

    openTlRef.current = tl;
    return tl;
  }, [position]);

  const handleOpen = useCallback(() => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setIsOpen(true);
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback('onComplete', () => {
        isBusyRef.current = false;
      });
      tl.play(0);
    } else {
      isBusyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const handleClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;

    const panel = panelRef.current;
    const preContainer = preLayersRef.current;
    const backdrop = backdropRef.current;
    const iconH = iconHRef.current;
    const iconV = iconVRef.current;
    const textInner = textInnerRef.current;

    if (!panel || !preContainer || !backdrop || !iconH || !iconV || !textInner) {
      setIsOpen(false);
      return;
    }

    const preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLElement[];
    const all = [...preLayers, panel];
    const offscreen = position === 'left' ? -100 : 100;

    // Reset button
    gsap.to(iconH, { rotate: 0, duration: 0.25, ease: 'power2.inOut' });
    gsap.to(iconV, { rotate: 90, duration: 0.25, ease: 'power2.inOut' });
    gsap.to(textInner, { yPercent: 0, duration: 0.25, ease: 'power2.inOut' });
    gsap.to(backdrop, { opacity: 0, pointerEvents: 'none', duration: 0.25 });

    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreen,
      duration: 0.35,
      ease: 'power3.in',
      onComplete: () => {
        setIsOpen(false);
        isBusyRef.current = false;
      },
    });
  }, [position]);

  const toggleMenu = () => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  // Filter items based on user role
  const visibleItems = items.filter((item) => {
    if (!item.roleRequired || item.roleRequired.length === 0) return true;
    if (!user) return false;
    return item.roleRequired.includes(user.role);
  });

  return (
    <div className="relative font-sans" ref={containerRef}>
      {/* Menu Trigger Button (ReactBits Architectural Button) */}
      <button
        onClick={toggleMenu}
        aria-label={isOpen ? 'Tutup navigasi' : 'Buka navigasi'}
        aria-expanded={isOpen}
        className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-900/80 hover:bg-slate-200/90 dark:hover:bg-slate-800 border border-slate-300/80 dark:border-white/10 text-slate-800 dark:text-slate-100 transition shadow-sm active:scale-[0.97] cursor-pointer"
      >
        {/* Animated Rolling Label */}
        <div className="hidden sm:block h-[15px] overflow-hidden text-[11px] font-mono font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300 select-none">
          <div ref={textInnerRef} className="flex flex-col leading-[15px]">
            <span>MENU</span>
            <span className="text-blue-600 dark:text-blue-400">TUTUP</span>
          </div>
        </div>

        {/* Morphing Icon (+ to x) */}
        <div className="relative w-4 h-4 flex items-center justify-center text-slate-800 dark:text-slate-200">
          <span
            ref={iconHRef}
            className="absolute w-3.5 h-[2px] bg-current rounded-xs will-change-transform"
          />
          <span
            ref={iconVRef}
            className="absolute w-3.5 h-[2px] bg-current rounded-xs will-change-transform"
          />
        </div>
      </button>

      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleClose}
        className="fixed inset-0 z-[998] bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Staggered Pre-layers (ReactBits Colored Layer Underlays) */}
      <div
        ref={preLayersRef}
        className={`fixed top-0 bottom-0 z-[999] pointer-events-none w-full sm:w-[380px] md:w-[420px] ${
          position === 'left' ? 'left-0' : 'right-0'
        }`}
        aria-hidden="true"
      >
        {colors.map((c, i) => (
          <div
            key={i}
            className="sm-prelayer absolute inset-0 w-full h-full shadow-2xl opacity-90"
            style={{
              backgroundColor: c,
              transform: position === 'left' ? 'translateX(-100%)' : 'translateX(100%)',
            }}
          />
        ))}
      </div>

      {/* Main Staggered Drawer Panel */}
      <aside
        ref={panelRef}
        aria-modal="true"
        role="dialog"
        className={`fixed top-0 bottom-0 z-[1000] w-full sm:w-[380px] md:w-[420px] bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between p-6 sm:p-8 overflow-y-auto ${
          position === 'left' ? 'left-0 border-r border-l-0' : 'right-0'
        }`}
        style={{
          transform: position === 'left' ? 'translateX(-100%)' : 'translateX(100%)',
        }}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">SIPPER-TI</span>
                <span className="text-[9px] font-mono font-semibold text-blue-700 dark:text-blue-300 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded-md">
                  INTL-CLASS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">UMKT Attendance Portal</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
            aria-label="Tutup"
          >
            <span className="text-xs font-mono font-bold">✕</span>
          </button>
        </div>

        {/* Navigation Items (Staggered Animation with 01, 02 Numbering) */}
        <div className="py-6 flex-1 flex flex-col justify-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 px-1">
            Navigasi Utama
          </p>

          <nav className="space-y-2" role="list">
            {visibleItems.map((item, idx) => {
              const isActive = pathname === item.link;
              const Icon = item.icon;
              const formattedIndex = String(idx + 1).padStart(2, '0');

              return (
                <div key={item.link} className="relative overflow-hidden group">
                  <Link
                    href={item.link}
                    onClick={handleClose}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border-blue-500/40 shadow-sm'
                        : 'bg-slate-50/50 dark:bg-slate-900/40 border-transparent hover:border-slate-200 dark:hover:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="sm-item-num font-mono text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {formattedIndex}
                      </span>
                      {Icon && (
                        <div className={`p-1.5 rounded-lg border ${
                          isActive 
                            ? 'bg-blue-600 text-white border-blue-500' 
                            : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300/60 dark:border-slate-700'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <span className="sm-item-label block font-semibold text-sm tracking-tight group-hover:translate-x-0.5 transition-transform">
                          {item.label}
                        </span>
                        {item.sublabel && (
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-bold rounded-md">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Drawer Footer & User Context */}
        <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800/80 space-y-4">
          {isAuthenticated && user ? (
            <div className="sm-footer-el bg-slate-100/80 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                    {user.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.full_name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">NIM: {user.nim}</p>
                  </div>
                </div>

                <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                  {user.role}
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                  {user.email}
                </span>
                <button
                  onClick={() => {
                    handleClose();
                    logout();
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
                >
                  <LogOut className="w-3 h-3" />
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="sm-footer-el">
              <Link
                href="/login"
                onClick={handleClose}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-[0.98]"
              >
                <UserIcon className="w-3.5 h-3.5" />
                Masuk ke Portal
              </Link>
            </div>
          )}

          {/* Academic Portal Footer Info */}
          <div className="sm-footer-el flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Verifikasi Kampus
            </span>
            <span className="hover:text-blue-500 transition-colors">
              Teknik Informatika UMKT
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default StaggeredMenu;
