import { runtime } from '@/config/runtime';

export class ApiClientError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const request = async (path, init = {}) => {
  const headers = { ...init.headers };
  if (init.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${runtime.apiBaseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  if (response.status === 204) return undefined;
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const message = payload.success ? 'The request failed.' : payload.error.message;
    throw new ApiClientError(message, response.status);
  }
  return payload.data;
};
