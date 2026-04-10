import React, { useEffect, useState, useRef } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";
import { useLanguage } from "../../context/LanguageContext";

interface LogMessage {
  id: number;
  key: string;
  params?: any;
  color?: string;
  time: string;
}

export const SystemLog: React.FC = () => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const playerState = PlayerState.getInstance();

    const handleLog = (key: string, params?: any, color?: string) => {
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        setLogs(prev => {
            const newLogs = [...prev, { id: Date.now() + Math.random(), key, params, color, time: timeString }];
            if (newLogs.length > 50) newLogs.shift(); // Keep last 50
            return newLogs;
        });
    };

    playerState.on("log", handleLog);

    // Initial Welcome (only if empty to avoid dups on re-render)
    // Removed to avoid spam on hot reload, handled by game init usually or we can check length

    return () => {
      playerState.off("log", handleLog);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Helper to translate text with params
  const translateLog = (log: LogMessage) => {
      let text = t(log.key as any);
      if (log.params) {
          Object.keys(log.params).forEach(param => {
              text = text.replace(`{${param}}`, log.params[param]);
          });
      }
      // Se não encontrou tradução (retornou a key) e tem params, tenta mostrar algo legível
      if (text === log.key && log.params && log.params.target) {
           return `${log.key} ${JSON.stringify(log.params)}`;
      }
      return text;
  };

  // --- TAB LOGIC REMOVED ---
  // Spells are now in SidebarSpellbook.tsx

  return (
    <div className="flex-1 bg-[#111] border border-[#333] rounded p-1 flex flex-col font-mono text-[11px] h-full">
        {/* CONTENT */}
        <div className="flex-1 overflow-auto custom-scrollbar relative">
             <div ref={scrollRef} className="h-full overflow-auto">
                {logs.length === 0 && <div className="text-gray-600 italic text-center mt-4">No events yet...</div>}
                {logs.map(log => (
                    <div key={log.id} style={{ color: log.color || "#aaa", marginBottom: '2px', lineHeight: '1.4' }}>
                        <span className="text-gray-600 mr-2">[{log.time}]</span>
                        {translateLog(log)}
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
