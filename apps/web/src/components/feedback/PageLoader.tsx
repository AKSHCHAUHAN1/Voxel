import { useEffect, useState } from 'react';
import appIcon from '@/assets/app-icon.png';

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
      className="relative flex min-h-screen flex-col items-center justify-center bg-[#070a13] overflow-hidden text-slate-100 font-sans select-none"
    >
      {/* Immersive Game Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px), 
                            linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Cybernetic Sweeper Laser Scan Line */}
      <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-20 pointer-events-none animate-[scan_3s_linear_infinite]" />

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
          <div 
            className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/30 opacity-60 w-full h-full animate-[rotate-ring_12s_linear_infinite]"
          />
          {/* Inner Fast Ring Spinner */}
          <div 
            className="absolute inset-2 rounded-full border border-violet-400/40 border-t-transparent border-b-transparent w-[calc(100%-16px)] h-[calc(100%-16px)] animate-[rotate-ring_3s_linear_infinite_reverse]"
          />

          {/* Glowing center aura */}
          <div className="absolute w-20 h-20 bg-violet-600/10 rounded-full blur-xl animate-pulse" />

          {/* Brand Icon */}
          <img 
            src={appIcon} 
            alt="Voxel Logo" 
            className="w-20 h-20 object-contain relative z-10 animate-bounce" 
          />
        </div>

        {/* Loading Progress & Tip Messages */}
        <div className="w-full space-y-4">
          
          {/* Status Text Info */}
          <div className="space-y-1">
            <div className="text-[10px] font-extrabold tracking-[0.25em] text-violet-400 uppercase">
              SYSTEM CONSTRUCT INITIALIZATION
            </div>
            <div className="text-xs font-mono font-medium text-slate-300 tracking-wider h-5 flex items-center justify-center">
              {progress < 100 ? loadingTips[tipIndex] : 'DECRYPTION COMPLETE. LAUNCHING WORKSPACE...'}
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="relative w-full h-2.5 bg-slate-900 border border-white/5 rounded-full overflow-hidden p-0.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Loading Percentage */}
          <div className="text-base font-mono font-bold text-slate-300 tracking-wide">
            {progress}%
          </div>
        </div>
      </div>
      
      {/* Cyberpunk corner details */}
      <div className="absolute bottom-6 left-6 text-[9px] font-mono text-slate-650 uppercase tracking-widest">
        SECURE GATEWAY v0.1.0 // ACTIVE
      </div>
      <div className="absolute bottom-6 right-6 text-[9px] font-mono text-slate-655 uppercase tracking-widest">
        VOXEL VISUAL SYSTEMS INC.
      </div>
    </div>
  );
}
