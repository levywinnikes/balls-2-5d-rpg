import { useEffect, useRef } from "react";
import { createDebugSliceScene } from "../runtime/createDebugSliceScene";

export function ThreeDSliceView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const runtime = createDebugSliceScene(canvas);
    const handleResize = () => runtime.engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      runtime.dispose();
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-[#0b0f17] overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block outline-none" />
    </div>
  );
}
