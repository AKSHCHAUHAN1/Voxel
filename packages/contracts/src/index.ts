export type RequestId = string & { readonly __brand: 'RequestId' };

export type ApiErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHORIZATION_DENIED'
  | 'VALIDATION_FAILED'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiMeta {
  readonly nextCursor?: string;
  readonly hasMore?: boolean;
}

export interface ApiSuccess<TData> {
  readonly success: true;
  readonly data: TData;
  readonly meta: ApiMeta;
  readonly requestId: RequestId;
  readonly timestamp: string;
}

export interface ApiFailure {
  readonly success: false;
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details: readonly string[];
  };
  readonly requestId: RequestId;
  readonly timestamp: string;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export const createRequestId = (value: string): RequestId => value as RequestId;
