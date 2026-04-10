import { useEffect, useRef } from 'react';

export function useTraceUpdates(props: any) {
  const prev = useRef(props);
  useEffect(() => {
    const changedProps = Object.entries(props).reduce((ps, [k, v]) => {
      if (prev.current[k] !== v) {
        ps[k] = [prev.current[k], v];
      }
      return ps;
    }, {} as any);
    if (Object.keys(changedProps).length > 0) {
      console.log('Changed props:', changedProps);
    }
    prev.current = props;
  });
}

export function useRenderCount(componentName: string) {
    const renders = useRef(0);
    useEffect(() => {
        renders.current += 1;
        console.log(`[${componentName}] Render #${renders.current} at ${new Date().toISOString()}`);
    });
}
