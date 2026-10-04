'use client';

import { useEffect } from 'react';

function stringifyError(value: unknown) {
  if (value instanceof Error) {
    return `${value.message}\n${value.stack ?? ''}`;
  }

  return String(value ?? '');
}

function isBenignWebVitalsStartTimeError(message: unknown, detail?: unknown) {
  const text = `${stringifyError(message)}\n${stringifyError(detail)}`;

  return (
    text.includes("Cannot read properties of undefined (reading 'startTime')") &&
    (text.includes('reportAllChanges') || text.includes('web-vitals'))
  );
}

export function BrowserErrorGuard() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (isBenignWebVitalsStartTimeError(event.message, event.error)) {
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isBenignWebVitalsStartTimeError(event.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
