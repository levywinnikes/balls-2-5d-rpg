import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";

interface SimpleItem {
    uid: string;
    itemId: string;
    name: string;
    x: number;
    y: number;
}

export const LootPrompt: React.FC = () => {
    const [nearbyItems, setNearbyItems] = useState<SimpleItem[]>([]);

    useEffect(() => {
        const handleNearbyLoot = (items: SimpleItem[]) => {
            setNearbyItems(items);
        };

        const playerState = PlayerState.getInstance();
        playerState.on("nearbyLoot", handleNearbyLoot);

        // Initial check? 
        // We rely on the game loop update.

        return () => {
            playerState.off("nearbyLoot", handleNearbyLoot);
        };
    }, []);

    if (nearbyItems.length === 0) return null;

    const closestItem = nearbyItems[0];
    const itemCount = nearbyItems.length;

    return (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
            <div className="flex flex-col items-center space-y-2 animate-bounce-slight">
                <div className="bg-black/80 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-white/10 rounded-full border border-white/30 text-yellow-400 font-bold text-sm">
                        E
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm uppercase tracking-wider text-yellow-100">
                            Pick Up
                        </span>
                        <span className="text-xs text-white/70">
                            {closestItem.itemId} {itemCount > 1 ? `(+${itemCount - 1} others)` : ""}
                        </span>
                    </div>
                </div>
            </div>
            
            <style>{`
                @keyframes bounce-slight {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                .animate-bounce-slight {
                    animation: bounce-slight 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};
