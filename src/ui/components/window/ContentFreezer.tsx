import React from "react";

interface ContentFreezerProps {
    frozen: boolean;
    children: React.ReactNode;
}

export const ContentFreezer = React.memo(({ children }: ContentFreezerProps) => {
    return <>{children}</>;
}, (prev, next) => {
    // If next is frozen, ALWAYS return true (skip render)
    // regardless of whether children changed.
    if (next.frozen) return true;

    // If we are unfreezing (prev=true, next=false), we MUST render.
    if (prev.frozen && !next.frozen) return false;

    // Otherwise, standard React.memo behavior (shallow compare props usually, 
    // but here we only care about children changing? 
    // Actually, React.memo by default shallow compares. 
    // If we want standard behavior, we should probably return false if children changed?
    // But children is complex. Let's just rely on standard memo if not frozen?
    // No, standard memo needs strict equality.
    
    // Simplest logic:
    // 1. If Locked -> Return TRUE (Don't update)
    // 2. If Unlocked -> Return FALSE (Always update, rely on React's internal diffing for children)
    return false;
});
