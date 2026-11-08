import { useEffect, useRef } from 'react';
import { backButtonManager, BACK_PRIORITY, BackPriority } from '../services/backHandler';

export { BACK_PRIORITY };
export type { BackPriority };

export function useBackButton(
  handler: () => boolean | void,
  enabled: boolean = true,
  priority: BackPriority = BACK_PRIORITY.NESTED_MODAL,
  id?: string
) {
  const handlerRef = useRef(handler);

  // Keep ref up to date after committed renders without mutating ref in render phase
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    const handlerId = id || 'back_' + Math.random().toString(36).substring(2, 9);
    const unregister = backButtonManager.register(
      handlerId,
      () => handlerRef.current(),
      priority
    );

    return () => {
      unregister();
    };
  }, [enabled, priority, id]);
}
