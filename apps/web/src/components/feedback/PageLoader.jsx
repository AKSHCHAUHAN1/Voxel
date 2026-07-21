import { useEffect, useState } from 'react';
import appIcon from '@/assets/app-icon.png';
import appIconDark from '@/assets/app-icon-dark.png';

const loadingTips = [
  'BOOTING DYNAMIC CANVAS ENGINE...',
  'RESOLVING METRIC GRAPH STRUCTURE...',
  'SYNCING LIVE CLIENT STREAM SENSORS...',
  'ESTABLISHING ENCRYPTED GATEWAY NODES...',
  'OPTIMIZING MATHEMATICAL PARSER...',
  'RENDERING USER INTERFACE PORTALS...',
  'WARPING VISUAL VECTOR SCHEMAS...',
  'COMPILING LOGIC NODES IN MEMORY...',
];

export function PageLoader() {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Animate progress like a game loader: steps up, pauses, steps up
  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      // Game loaders increment by random jumps
      const jump = Math.floor(Math.random() * 15) + 5;
      current = Math.min(current + jump, 100);
      setProgress(current);

      if (current >= 100) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Cycle loading messages
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % loadingTips.length);
    }, 700);

    return () => clearInterval(tipInterval);
  }, []);

  return (
    <div
      role="status"
      aria-label="Loading Voxel"
      className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#070a13] dark:text-slate-100 overflow-hidden font-sans select-none transition-colors duration-300"
    >
      {/* Immersive Game Grid Background */}
      <div
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px), 
                            linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Cybernetic Sweeper Laser Scan Line */}
      <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-30 dark:opacity-20 pointer-events-none animate-[scan_3s_linear_infinite]" />

      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        @keyframes rotate-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Central Immersive Panel */}
      <div className="relative flex flex-col items-center text-center max-w-sm px-6 space-y-8 z-10">
        {/* Core Ring Scanner + Logo */}
        <div className="relative flex items-center justify-center w-36 h-36">
          {/* Outer Cyberpunk Ring Spinner */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/40 dark:border-violet-500/30 opacity-70 w-full h-full animate-[rotate-ring_12s_linear_infinite]" />

          {/* Inner Fast Ring Spinner */}
          <div className="absolute inset-2 rounded-full border border-violet-500/50 dark:border-violet-400/40 border-t-transparent border-b-transparent w-[calc(100%-16px)] h-[calc(100%-16px)] animate-[rotate-ring_3s_linear_infinite_reverse]" />

          {/* Glowing center aura */}
          <div className="absolute w-20 h-20 bg-violet-500/20 dark:bg-violet-600/10 rounded-full blur-xl animate-pulse" />

          {/* Brand Icon */}
          <img
            src={appIcon}
            alt="Voxel Logo"
            className="w-20 h-20 object-contain relative z-10 animate-bounce block dark:hidden"
          />
          <img
            src={appIconDark}
            alt="Voxel Logo"
            className="w-20 h-20 object-contain relative z-10 animate-bounce hidden dark:block"
          />
        </div>

        {/* Loading Progress & Tip Messages */}
        <div className="w-full space-y-4">
          {/* Status Text Info */}
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold tracking-[0.25em] text-violet-600 dark:text-violet-400 uppercase">
              SYSTEM CONSTRUCT INITIALIZATION
            </div>
            <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 tracking-wider h-5 flex items-center justify-center">
              {progress < 100
                ? loadingTips[tipIndex]
                : 'DECRYPTION COMPLETE. LAUNCHING WORKSPACE...'}
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="relative w-full h-3 bg-slate-200 border border-slate-300/80 dark:bg-slate-900 dark:border-white/5 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Loading Percentage */}
          <div className="text-base font-mono font-extrabold text-slate-800 dark:text-slate-200 tracking-wide">
            {progress}%
          </div>
        </div>
      </div>

      {/* Cyberpunk corner details */}
      <div className="absolute bottom-6 left-6 text-[9px] font-mono text-slate-500 dark:text-slate-500 uppercase tracking-widest font-bold">
        SECURE GATEWAY v0.1.0 // ACTIVE
      </div>
      <div className="absolute bottom-6 right-6 text-[9px] font-mono text-slate-500 dark:text-slate-500 uppercase tracking-widest font-bold">
        VOXEL VISUAL SYSTEMS INC.
      </div>
    </div>
  );
}
