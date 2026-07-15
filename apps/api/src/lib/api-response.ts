import type { ApiFailure, ApiMeta, ApiSuccess, RequestId } from '@voxel/contracts';

const now = (): string => new Date().toISOString();

export const success = <TData>(
  data: TData,
  requestId: RequestId,
  meta: ApiMeta = {},
): ApiSuccess<TData> => ({
  success: true,
  data,
  meta,
  requestId,
  timestamp: now(),
});

export const failure = (
  requestId: RequestId,
  code: ApiFailure['error']['code'],
  message: string,
  details: readonly string[] = [],
): ApiFailure => ({
  success: false,
  error: { code, message, details },
  requestId,
  timestamp: now(),
});
