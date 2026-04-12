import React, { useEffect, useState, useRef } from 'react';
import { PlayerState } from '../../game/entities/Player/PlayerState';

export const PerfMonitor: React.FC = () => {
    const [metrics, setMetrics] = useState(PlayerState.getInstance().getPerfData());
    const [diag, setDiag] = useState(PlayerState.getInstance().getDiagnosticSettings());
    const [isVisible, setIsVisible] = useState(false);
    const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
    
    // Smoothed metrics using moving average
    const smoothedRef = useRef(PlayerState.getInstance().getPerfData());
    const alpha = 0.15; // Smoothing factor (lower = smoother)

    useEffect(() => {
        const handlePerfUpdate = (data: any) => {
            // Apply smoothing
            const s = smoothedRef.current;
            s.totalUpdateTime = s.totalUpdateTime * (1 - alpha) + data.totalUpdateTime * alpha;
            s.enemyTime = s.enemyTime * (1 - alpha) + data.enemyTime * alpha;
            s.mapTime = s.mapTime * (1 - alpha) + data.mapTime * alpha;
            s.physicsTime = s.physicsTime * (1 - alpha) + data.physicsTime * alpha;
            s.activeEnemies = data.activeEnemies; // Don't smooth counts
            s.renderedTiles = data.renderedTiles;
            s.totalObjects = data.totalObjects;
            s.culprits = data.culprits;
            
            setMetrics({ ...s });
        };

        const handleDiagUpdate = (data: any) => {
            setDiag({ ...data });
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Global toggle: Shift + F or Alt + F
            if (e.key.toLowerCase() === 'f' && (e.shiftKey || e.altKey)) {
                setIsVisible(prev => !prev);
                e.preventDefault();
            }
            // Diagnostic Panel toggle: Shift + D or Alt + D
            if (e.key.toLowerCase() === 'd' && (e.shiftKey || e.altKey)) {
                setIsDiagnosticOpen(prev => !prev);
                if (!isVisible) setIsVisible(true);
                e.preventDefault();
            }
        };

        PlayerState.getInstance().on('perfUpdated', handlePerfUpdate);
        PlayerState.getInstance().on('diagnosticUpdated', handleDiagUpdate);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            PlayerState.getInstance().off('perfUpdated', handlePerfUpdate);
            PlayerState.getInstance().off('diagnosticUpdated', handleDiagUpdate);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isVisible]);

    if (!isVisible) return (
        <div className="absolute top-2 right-12 z-[9000] text-[8px] text-white/30 font-mono select-none pointer-events-none">
            [SHIFT+F] PROFILER | [SHIFT+D] DIAGNOSTIC
        </div>
    );

    const formatMs = (ms: number) => ms.toFixed(1) + 'ms';
    
    const toggleSetting = (key: string) => {
        const current = (diag as any)[key];
        PlayerState.getInstance().updateDiagnosticSetting(key as any, !current);
    };

    return (
        <div className="absolute top-10 right-2 z-[9000] flex flex-col gap-2 pointer-events-none select-none">
            {/* PERFORMANCE PANEL */}
            <div className="bg-black/80 border border-emerald-500/50 p-3 rounded-lg shadow-2xl backdrop-blur-md min-w-[180px]">
                <div className="flex justify-between items-center border-b border-emerald-500/30 mb-2 pb-1">
                    <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest">Perf Profiler</span>
                    <span className={`text-[9px] font-bold ${metrics.totalUpdateTime > 14 ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                        {metrics.totalUpdateTime > 14 ? 'LAG' : 'OK'}
                    </span>
                </div>
                
                <div className="space-y-1 text-[10px] font-mono">
                    <div className="flex justify-between items-center group">
                        <span className="text-gray-400">Main Loop</span>
                        <div className="flex items-center gap-2">
                             <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${metrics.totalUpdateTime > 14 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                    style={{ width: `${Math.min(100, (metrics.totalUpdateTime / 16.6) * 100)}%` }}
                                />
                             </div>
                             <span className={metrics.totalUpdateTime > 14 ? 'text-red-400' : 'text-emerald-300'}>
                                {formatMs(metrics.totalUpdateTime)}
                             </span>
                        </div>
                    </div>

                    <div className="flex justify-between text-gray-500 text-[9px] pl-2 border-l border-gray-800">
                        <span>Map Render</span>
                        <span className="text-emerald-500/80">{formatMs(metrics.mapTime)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[9px] pl-2 border-l border-gray-800">
                        <span>Enemy AI</span>
                        <span className="text-emerald-500/80">{formatMs(metrics.enemyTime)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[9px] pl-2 border-l border-gray-800">
                        <span>Physics</span>
                        <span className="text-emerald-500/80">{formatMs(metrics.physicsTime)}</span>
                    </div>

                    <div className="my-2 border-t border-gray-800/50" />

                    <div className="flex justify-between">
                        <span className="text-gray-400">Active AI</span>
                        <span className="text-white font-bold">{metrics.activeEnemies}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">Tiles Rendered</span>
                        <span className="text-white font-bold">{metrics.renderedTiles}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-800/50 mt-1 pt-1">
                        <span className="text-gray-400">Total Scene Objects</span>
                        <span className={`font-bold ${metrics.totalObjects > 5000 ? 'text-orange-400' : 'text-emerald-400'}`}>
                            {metrics.totalObjects || 0}
                        </span>
                    </div>
                </div>
            </div>

            {/* DIAGNOSTIC PANEL */}
            {isDiagnosticOpen && (
                <div className="bg-slate-900/90 border border-blue-500/50 p-3 rounded-lg shadow-2xl backdrop-blur-md pointer-events-auto">
                    <div className="text-blue-400 font-bold text-[10px] uppercase tracking-widest border-b border-blue-500/30 mb-2 pb-1">
                        Diagnostic Flags
                    </div>
                    
                    <div className="space-y-1">
                        {Object.entries(diag).map(([key, value]) => (
                            <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={value as boolean} 
                                    onChange={() => toggleSetting(key)}
                                    className="hidden"
                                />
                                <div className={`w-3 h-3 rounded border transition-colors ${value ? 'bg-blue-500 border-blue-400' : 'bg-gray-800 border-gray-600'}`}>
                                    {value && <div className="w-full h-full flex items-center justify-center text-[8px] text-white">✓</div>}
                                </div>
                                <span className={`text-[9px] font-mono transition-colors ${value ? (key.startsWith('hide') ? 'text-red-400' : 'text-gray-200') : 'text-gray-500'}`}>
                                    {key.replace('enable', '').replace('hide', 'HIDE ')}
                                </span>
                            </label>
                        ))}
                    </div>

                    {/* DNA ANALYSIS */}
                    <div className="mt-4 pt-2 border-t border-blue-500/20">
                        <div className="text-[9px] text-blue-300 uppercase tracking-tighter mb-1 font-bold">DNA Analysis (Top 5)</div>
                        <div className="space-y-[2px]">
                            {metrics.culprits?.map(([name, count]: [string, number]) => (
                                <div key={name} className="flex justify-between text-[8px] font-mono">
                                    <span className="text-gray-400 truncate max-w-[120px]">{name}</span>
                                    <span className="text-blue-300 font-bold">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={() => (window as any)._dynamicLevelRenderer?.purgeOrphans()}
                        className="w-full mt-4 bg-red-900/40 hover:bg-red-600/60 text-red-400 text-[9px] font-bold py-1 px-2 rounded border border-red-500/30 transition-all pointer-events-auto cursor-pointer"
                    >
                        ☢️ NUCLEAR PURGE (Force Cleanup)
                    </button>
                    
                    <div className="mt-2 text-[8px] text-blue-400/50 italic text-center">
                        Toggle flags to isolate lag source
                    </div>
                </div>
            )}
        </div>
    );
};
