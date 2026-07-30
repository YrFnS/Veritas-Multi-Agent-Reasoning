export const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new Error('ABORT_SEQUENCE_RECEIVED');
  }
};

export const waitForRetry = (
  milliseconds: number,
  signal?: AbortSignal
): Promise<void> => {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, milliseconds);

    const handleAbort = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', handleAbort);
      reject(new Error('ABORT_SEQUENCE_RECEIVED'));
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
};
