'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  timestamp: string;
  stack?: string;
}

const MAX_ENTRIES = 50;

export function useConsoleCapture() {
  const entriesRef = useRef<ConsoleEntry[]>([]);
  const originalConsoleError = useRef<typeof console.error | null>(null);
  const originalConsoleWarn = useRef<typeof console.warn | null>(null);

  useEffect(() => {
    originalConsoleError.current = console.error;
    originalConsoleWarn.current = console.warn;

    console.error = (...args: unknown[]) => {
      const entry: ConsoleEntry = {
        level: 'error',
        message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
        timestamp: new Date().toISOString(),
        stack: args.find(a => a instanceof Error)?.stack,
      };
      entriesRef.current = [...entriesRef.current.slice(-(MAX_ENTRIES - 1)), entry];
      originalConsoleError.current?.(...args);
    };

    console.warn = (...args: unknown[]) => {
      const entry: ConsoleEntry = {
        level: 'warn',
        message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
        timestamp: new Date().toISOString(),
      };
      entriesRef.current = [...entriesRef.current.slice(-(MAX_ENTRIES - 1)), entry];
      originalConsoleWarn.current?.(...args);
    };

    return () => {
      if (originalConsoleError.current) console.error = originalConsoleError.current;
      if (originalConsoleWarn.current) console.warn = originalConsoleWarn.current;
    };
  }, []);

  const getConsoleErrors = useCallback(() => {
    return [...entriesRef.current];
  }, []);

  return { getConsoleErrors };
}
