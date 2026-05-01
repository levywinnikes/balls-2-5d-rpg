import React, { useEffect, useState } from "react";
import {
  PlayerState,
  NotificationType,
} from "../../game/entities/Player/PlayerState";
import { t_game } from "../../game/i18n/translations";

// NotificationType is now imported from PlayerState.ts

export interface GameNotification {
  id: string;
  type: NotificationType;
  message: string;
  timestamp: number;
  closing?: boolean;
  startProgress?: number;
  endProgress?: number;
}

const NotificationItem: React.FC<{ notif: GameNotification }> = ({ notif }) => {
  const [progress, setProgress] = useState(notif.startProgress ?? 0);

  useEffect(() => {
    if (notif.type === "exp" && notif.endProgress !== undefined) {
      // Small delay to ensure mount for animation
      const timer = setTimeout(() => {
        setProgress(notif.endProgress!);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [notif]);

  const getStyles = (type: NotificationType) => {
    switch (type) {
      case "exp":
        return "border-yellow-600/60 bg-black/80 text-yellow-100";
      case "willpower":
        return "border-purple-500/50 bg-black/80 text-purple-300 font-bold";
      case "error":
        return "border-red-500/50 bg-red-950/80 text-red-100";
      case "warning":
        return "border-orange-500/50 bg-black/80 text-orange-200";
      case "pickup":
        return "border-white/10 bg-black/80 text-gray-200";
      case "heal":
        return "border-green-500/40 bg-black/80 text-green-300";
      default:
        return "border-gray-500/20 bg-black/80 text-gray-300";
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "exp":
        return "⭐";
      case "willpower":
        return "✨";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "pickup":
        return "🎒";
      case "success":
        return "✅";
      case "heal":
        return "💖";
      default:
        return "ℹ️";
    }
  };

  return (
    <div
      className={`
                relative min-w-[200px] max-w-[280px] px-4 py-3 rounded-md border-l-[6px] shadow-2xl backdrop-blur-md
                flex items-center gap-3 overflow-hidden
                transition-all duration-700 cubic-bezier(0.22, 1, 0.36, 1)
                ${notif.closing ? "opacity-0 -translate-x-full scale-90 blur-sm" : "opacity-100 translate-x-0 scale-100 animate-notification-slide-in"}
                ${getStyles(notif.type)}
            `}
    >
      {/* Background Progress Bar for XP */}
      {notif.type === "exp" && (
        <div className="absolute inset-0 z-0 bg-yellow-900/20 pointer-events-none">
          <div
            className="h-full bg-yellow-500/20 transition-all duration-1000 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <span className="relative z-10 text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
        {getIcon(notif.type)}
      </span>
      <span className="relative z-10 text-sm font-semibold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] uppercase italic">
        {notif.message}
      </span>

      {/* Glossy overlay effect for premium feel */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10 z-20 pointer-events-none" />
    </div>
  );
};

export const NotificationSystem: React.FC<{
  suppressTypes?: NotificationType[];
}> = ({ suppressTypes = [] }) => {
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const maxNotifications = 5;

  const addNotification = (
    type: NotificationType,
    message: string,
    startProgress?: number,
    endProgress?: number,
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotif: GameNotification = {
      id,
      type,
      message,
      timestamp: Date.now(),
      startProgress,
      endProgress,
    };

    setNotifications((prev) => {
      const updated = [...prev, newNotif];
      return updated;
    });
  };

  useEffect(() => {
    if (notifications.length > maxNotifications) {
      const activeNotifs = notifications.filter((n) => !n.closing);
      if (activeNotifs.length > maxNotifications) {
        const oldestId = activeNotifs[0].id;
        setNotifications((prev) =>
          prev.map((n) => (n.id === oldestId ? { ...n, closing: true } : n)),
        );
      }
    }
  }, [notifications]);

  useEffect(() => {
    const closingItems = notifications.filter((n) => n.closing);
    if (closingItems.length > 0) {
      const t = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => !n.closing));
      }, 800);
      return () => clearTimeout(t);
    }
  }, [notifications]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNotifications((prev) => {
        const hasOld = prev.some((n) => !n.closing && now - n.timestamp > 4500);
        if (!hasOld) return prev;
        return prev.map((n) =>
          !n.closing && now - n.timestamp > 4500 ? { ...n, closing: true } : n,
        );
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ps = PlayerState.getInstance();

    const handleUiNotification = (data: {
      type: NotificationType;
      message: string;
      value?: number;
      startProgress?: number;
      endProgress?: number;
    }) => {
      if (suppressTypes.includes(data.type)) {
        return;
      }
      addNotification(
        data.type,
        data.message,
        data.startProgress,
        data.endProgress,
      );
    };

    const handleWillpower = (tier: number) => {
      addNotification(
        "willpower",
        t_game("notif_reached_tier").replace("{tier}", tier.toString()),
      );
    };

    ps.on("uiNotification", handleUiNotification);
    ps.on("willpowerTierUp", handleWillpower);

    return () => {
      ps.off("uiNotification", handleUiNotification);
      ps.off("willpowerTierUp", handleWillpower);
    };
  }, [suppressTypes]);

  return (
    <div className="fixed bottom-6 left-6 flex flex-col-reverse gap-3 z-[9999] pointer-events-none w-72">
      {notifications.map((notif) => (
        <NotificationItem key={notif.id} notif={notif} />
      ))}
    </div>
  );
};
