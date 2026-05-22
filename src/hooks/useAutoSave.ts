import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/useMapStore';
import { useTagStore } from '../store/useTagStore';

export function useAutoSave() {
  const dirty = useMapStore((s) => s.dirty);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const saveNow = useMapStore((s) => s.saveNow);
  const buildTagIndex = useTagStore((s) => s.buildTagIndex);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty || !activeMapId) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      await saveNow();
      await buildTagIndex();
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, activeMapId, saveNow, buildTagIndex]);
}
