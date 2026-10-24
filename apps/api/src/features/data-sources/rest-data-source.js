import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';

const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 64;
const sensitiveQueryParameters = new Set([
  'api_key', 'apikey', 'access_key', 'access_token', 'auth', 'authorization', 'client_secret',
  'key', 'password', 'secret', 'token', 'signature', 'sig', 'jwt', 'bearer', 'session', 'sessionid',
]);
const blockedIpv4Subnets = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['168.63.129.16', 32],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export class RestDataSourceError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

const ipv4ToNumber = (address) => {
  if (isIP(address) !== 4) return null;
  return address.split('.').reduce((result, octet) => ((result << 8) | Number(octet)) >>> 0, 0);
};

const isInIpv4Subnet = (address, subnet, prefix) => {
  const value = ipv4ToNumber(address);
  const base = ipv4ToNumber(subnet);
  if (value === null || base === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((value & mask) >>> 0) === ((base & mask) >>> 0);
};

export const isPublicIpv4Address = (address) => (
  isIP(address) === 4 && !blockedIpv4Subnets.some(([subnet, prefix]) => isInIpv4Subnet(address, subnet, prefix))
);

export const createPinnedIpv4Lookup = (address) => (_hostname, options, callback) => {
  if (options?.all) callback(null, [{ address, family: 4 }]);
  else callback(null, address, 4);
};

export function validateRestEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new RestDataSourceError('Enter a valid HTTPS JSON endpoint under 2,048 characters.', 422);
  }

  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw new RestDataSourceError('Enter a valid HTTPS JSON endpoint.', 422);
  }

  const hostname = endpoint.hostname.toLowerCase().replace(/\.$/, '');
  const localHostname = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.test')
    || hostname.endsWith('.invalid')
    || !hostname.includes('.');

  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash || (endpoint.port && endpoint.port !== '443')) {
    throw new RestDataSourceError('Only HTTPS endpoints on port 443 are supported.', 422);
  }
  if (!hostname || isIP(hostname) || localHostname) {
    throw new RestDataSourceError('Use a public DNS hostname, not a local or IP address.', 422);
  }

  for (const key of endpoint.searchParams.keys()) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const containsCredential = /(^|_)(api_?key|access_token|refresh_token|id_token|token|secret|password|passwd|credential|authorization|auth|signature|sig|jwt|bearer|session)(_|$)/.test(normalizedKey);
    if (sensitiveQueryParameters.has(normalizedKey) || containsCredential) {
      throw new RestDataSourceError('Do not put credentials or tokens in endpoint URLs.', 422);
    }
  }

  return endpoint;
}

const resolvePublicIpv4 = async (hostname) => {
  const records = await dnsLookup(hostname, { all: true, family: 4, verbatim: true });
  const addresses = [...new Set(records.map((record) => record.address))];
  if (addresses.length === 0 || addresses.some((address) => !isPublicIpv4Address(address))) {
    throw new RestDataSourceError('The endpoint does not resolve exclusively to public IPv4 addresses.', 422);
  }
  return addresses;
};

const requestJsonOverHttps = (endpoint, address) => new Promise((resolve, reject) => {
  let settled = false;
  const fail = (error) => {
    if (settled) return;
    settled = true;
    reject(error);
  };

  const request = https.request({
    hostname: endpoint.hostname,
    port: 443,
    method: 'GET',
    path: `${endpoint.pathname}${endpoint.search}`,
    headers: {
      accept: 'application/json',
      'accept-encoding': 'identity',
      'user-agent': 'Voxel-REST-Widget/0.1',
    },
    lookup: createPinnedIpv4Lookup(address),
  }, (response) => {
    const declaredLength = Number(response.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      response.destroy();
      request.destroy();
      fail(new RestDataSourceError('The JSON response exceeds the 512 KB limit.', 413));
      return;
    }

    const chunks = [];
    let responseLength = 0;
    response.on('data', (chunk) => {
      responseLength += chunk.length;
      if (responseLength > MAX_RESPONSE_BYTES) {
        response.destroy();
        request.destroy();
        fail(new RestDataSourceError('The JSON response exceeds the 512 KB limit.', 413));
        return;
      }
      chunks.push(chunk);
    });
    response.on('end', () => {
      if (settled) return;
      settled = true;
      resolve({
        statusCode: response.statusCode || 0,
        contentType: response.headers['content-type'] || '',
        body: Buffer.concat(chunks),
      });
    });
    const contentEncoding = String(response.headers['content-encoding'] || '').toLowerCase();
    if (contentEncoding && contentEncoding !== 'identity') {
      response.destroy();
      request.destroy();
      fail(new RestDataSourceError('Compressed endpoint responses are not supported.', 502));
      return;
    }
    response.on('error', (error) => fail(error));
  });

  const absoluteTimeout = setTimeout(() => {
    request.destroy(new RestDataSourceError('The endpoint request timed out.', 504));
  }, REQUEST_TIMEOUT_MS);
  request.once('close', () => clearTimeout(absoluteTimeout));
  request.setTimeout(REQUEST_TIMEOUT_MS, () => {
    request.destroy(new RestDataSourceError('The endpoint request timed out.', 504));
  });
  request.on('error', (error) => fail(error));
  request.end();
});

export class RestDataSourceClient {
  constructor({ resolveAddresses = resolvePublicIpv4, requestImpl = requestJsonOverHttps, now = Date.now } = {}) {
    this.resolveAddresses = resolveAddresses;
    this.requestImpl = requestImpl;
    this.now = now;
    this.cache = new Map();
    this.pending = new Map();
  }

  async fetchJson(value) {
    const endpoint = validateRestEndpoint(value);
    const cacheKey = endpoint.href;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > this.now()) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.value;
    }
    if (cached) this.cache.delete(cacheKey);
    if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);

    const operation = this.fetchValidatedJson(endpoint);
    this.pending.set(cacheKey, operation);
    try {
      const result = await operation;
      this.cache.set(cacheKey, { value: result, expiresAt: this.now() + CACHE_TTL_MS });
      while (this.cache.size > MAX_CACHE_ENTRIES) this.cache.delete(this.cache.keys().next().value);
      return result;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  async fetchValidatedJson(endpoint) {
    let addresses;
    try {
      addresses = await this.resolveAddresses(endpoint.hostname);
    } catch (error) {
      if (error instanceof RestDataSourceError) throw error;
      throw new RestDataSourceError('The endpoint DNS lookup failed.', 502);
    }
    if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((address) => !isPublicIpv4Address(address))) {
      throw new RestDataSourceError('The endpoint does not resolve exclusively to public IPv4 addresses.', 422);
    }

    let response;
    try {
      response = await this.requestImpl(endpoint, addresses[0]);
    } catch (error) {
      if (error instanceof RestDataSourceError) throw error;
      throw new RestDataSourceError('The external endpoint could not be reached.', 502);
    }
    if (response.statusCode >= 300 && response.statusCode < 400) {
      throw new RestDataSourceError('Endpoint redirects are not allowed.', 502);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new RestDataSourceError('The external endpoint returned an error.', 502);
    }
    if (Buffer.byteLength(response.body) > MAX_RESPONSE_BYTES) {
      throw new RestDataSourceError('The JSON response exceeds the 512 KB limit.', 413);
    }
    const contentType = String(response.contentType).split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json' && !/^application\/[a-z0-9.+-]+\+json$/.test(contentType)) {
      throw new RestDataSourceError('The endpoint must return an application/json response.', 502);
    }

    try {
      return JSON.parse(Buffer.isBuffer(response.body) ? response.body.toString('utf8') : response.body);
    } catch {
      throw new RestDataSourceError('The endpoint returned invalid JSON.', 502);
    }
  }
}

const defaultRestDataSourceClient = new RestDataSourceClient();

export const fetchPublicRestJson = (value) => defaultRestDataSourceClient.fetchJson(value);
