export const AbortControllerWithTimeout = (timeoutMs: number): AbortController => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const clear = () => clearTimeout(timeoutId);
  // Attach cleanup to signal abort event
  controller.signal.addEventListener('abort', clear, { once: true });
  return controller;
};

