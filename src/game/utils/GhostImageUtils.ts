export const GhostImageUtils = {
    _emptyImage: null as HTMLImageElement | null,

    getEmptyDragImage: (): Element => {
        if (typeof document === "undefined") return new Image(); // SSR safety
        
        // Option 1: Canvas (Most reliable for immediate use)
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "rgba(0,0,0,0)";
            ctx.fillRect(0, 0, 1, 1);
        }
        return canvas;

        // Option 2: Pre-loaded Image (If canvas fails or specific browser issues)
        /*
        if (!GhostImageUtils._emptyImage) {
            const img = new Image();
            img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            GhostImageUtils._emptyImage = img;
        }
        return GhostImageUtils._emptyImage;
        */
    }
};
