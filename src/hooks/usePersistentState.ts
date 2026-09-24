import { useEffect, useState } from "react";

/** 状态持久化到 localStorage：重开页面后可接着处理 */
export function usePersistentState<T>(key: string, createInitial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`读取本地数据失败（${key}）`, err);
    }
    return createInitial();
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`写入本地数据失败（${key}）`, err);
    }
  }, [key, value]);

  return [value, setValue] as const;
}
