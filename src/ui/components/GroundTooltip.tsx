
import React, { useEffect, useState } from "react";
import { PlayerState } from "../../game/entities/Player/PlayerState";

export const GroundTooltip: React.FC = () => {
  const [tooltip, setTooltip] = useState<{text: string, x: number, y: number} | null>(null);

  useEffect(() => {
     const handleShow = (data: any) => {
         setTooltip({ text: data.text, x: data.x, y: data.y });
     };
     const handleHide = () => {
         setTooltip(null);
     };
     PlayerState.getInstance().on("showGroundTooltip", handleShow);
     PlayerState.getInstance().on("hideGroundTooltip", handleHide);
     return () => {
         PlayerState.getInstance().off("showGroundTooltip", handleShow);
         PlayerState.getInstance().off("hideGroundTooltip", handleHide);
     };
  }, []);

  if (!tooltip) return null;

  return (
       <div 
         className="fixed pointer-events-none z-[10000] bg-black bg-opacity-90 border border-[#555] text-white text-xs p-1 rounded whitespace-pre-line shadow-lg"
         style={{ 
             left: tooltip.x + 10, 
             top: tooltip.y + 10 
         }}
       >
           {tooltip.text}
       </div>
  );
};
