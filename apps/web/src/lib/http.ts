import type { ApiResponse } from '@voxel/contracts';
import { runtime } from '@/config/runtime';

export class ApiClientError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export const request = async <TData>(path: string, init: RequestInit = {}): Promise<TData> => {
  const response = await fetch(`${runtime.apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  });

  if (response.status === 204) return undefined as TData;
  const payload = (await response.json()) as ApiResponse<TData>;
  if (!response.ok || !payload.success) {
    const message = payload.success ? 'The request failed.' : payload.error.message;
    throw new ApiClientError(message, response.status);
  }
  return payload.data;
};
