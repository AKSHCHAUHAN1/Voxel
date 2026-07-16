const now = () => new Date().toISOString();

export const success = (
  data,
  requestId,
  meta = {},
) => ({
  success: true,
  data,
  meta,
  requestId,
  timestamp: now(),
});

export const failure = (
  requestId,
  code,
  message,
  details = [],
) => ({
  success: false,
  error: { code, message, details },
  requestId,
  timestamp: now(),
});
