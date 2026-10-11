import { createHash, createHmac } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value, encoding) => createHmac('sha256', key).update(value).digest(encoding);
const EMPTY_HASH = sha256('');

const encodePath = (value) => value.split('/').map(encodeURIComponent).join('/');

export class ObjectStorageError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const createObjectStorage = ({
  endpoint,
  bucket,
  region = 'us-east-1',
  accessKey,
  secretKey,
  fetchImpl = fetch,
  clock = () => new Date(),
}) => {
  const base = new URL(endpoint);
  if (base.search || base.hash || base.username || base.password) {
    throw new Error('Object storage endpoint must not include credentials, query parameters, or a fragment.');
  }

  const request = async (method, key, body, contentType) => {
    const url = new URL(base);
    const prefix = url.pathname.replace(/\/$/, '');
    url.pathname = `${prefix}/${encodeURIComponent(bucket)}/${encodePath(key)}`;
    const payloadHash = body ? sha256(body) : EMPTY_HASH;
    const now = clock();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const canonicalHeaders = `${contentType ? `content-type:${contentType}\n` : ''}host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = `${contentType ? 'content-type;' : ''}host;x-amz-content-sha256;x-amz-date`;
    const canonicalRequest = `${method}\n${url.pathname}\n\n${canonicalHeaders}${signedHeaders}\n${payloadHash}`;
    const scope = `${date}/${region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    const dateKey = hmac(`AWS4${secretKey}`, date);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = hmac(signingKey, stringToSign, 'hex');
    const headers = {
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(contentType ? { 'content-type': contentType } : {}),
    };

    let response;
    try {
      response = await fetchImpl(url, { method, headers, ...(body ? { body } : {}), redirect: 'error' });
    } catch (error) {
      throw new ObjectStorageError(`Object storage is unavailable: ${error.message}`);
    }
    if (!response.ok && response.status !== 404) {
      throw new ObjectStorageError(`Object storage rejected the ${method} request.`, 502);
    }
    return response;
  };

  return {
    put: async (key, body, contentType) => request('PUT', key, body, contentType),
    get: async (key) => {
      const response = await request('GET', key);
      if (response.status === 404) throw new ObjectStorageError('Stored file is missing.', 404);
      return Buffer.from(await response.arrayBuffer());
    },
    delete: async (key) => { await request('DELETE', key); },
  };
};
