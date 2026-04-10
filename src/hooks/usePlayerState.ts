// src/hooks/usePlayerState.ts
import { useState, useEffect } from "react";
import { PlayerState } from "../game/entities/Player/PlayerState";

// Hook genérico para ouvir eventos do PlayerState
export function usePlayerState<T>(
  event: string | string[],
  getter: () => T,
  defaultValue: T
): T {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    const state = PlayerState.getInstance();

    // Atualiza o valor inicial
    setValue(getter());

    // Função de listener
    const handleUpdate = () => {
      setValue(getter());
    };

    const events = Array.isArray(event) ? event : [event];

    // Inscreve nos eventos
    events.forEach(e => state.on(e, handleUpdate));

    return () => {
      events.forEach(e => state.off(e, handleUpdate));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(event) ? event.join(",") : event]); // Stable dependency check

  return value;
}
