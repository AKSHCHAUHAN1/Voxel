import { describe, expect, it, vi } from 'vitest';
import {
  createPinnedIpv4Lookup,
  isPublicIpv4Address,
  RestDataSourceClient,
  RestDataSourceError,
  validateRestEndpoint,
} from './rest-data-source.js';

const endpoint = 'https://api.example.com/v1/metrics?region=west';
const jsonResponse = (value, overrides = {}) => ({
  statusCode: 200,
  contentType: 'application/json; charset=utf-8',
  body: Buffer.from(JSON.stringify(value)),
  ...overrides,
});

describe('REST data source security and pipeline', () => {
  it('accepts public HTTPS URLs and rejects local, credentialed, tokenized, or non-HTTPS targets', () => {
    expect(validateRestEndpoint(endpoint).hostname).toBe('api.example.com');

    for (const value of [
      'http://api.example.com/data',
      'https://user:pass@api.example.com/data',
      'https://api.example.com:8443/data',
      'https://127.0.0.1/data',
      'https://metadata.google.internal/data',
      'https://api.example.com/data?access_token=secret',
      'https://api.example.com/data?X-Amz-Signature=secret',
    ]) {
      expect(() => validateRestEndpoint(value)).toThrow(RestDataSourceError);
    }
  });

  it('blocks non-public IPv4 ranges, including metadata, private, reserved, and documentation addresses', () => {
    expect(isPublicIpv4Address('93.184.216.34')).toBe(true);
    for (const address of ['10.0.0.1', '100.100.100.200', '127.0.0.1', '169.254.169.254', '192.168.1.1', '198.51.100.20', '224.0.0.1']) {
      expect(isPublicIpv4Address(address)).toBe(false);
    }
  });

  it('pins both normal and all-address DNS callbacks to the validated IPv4 address', () => {
    const lookup = createPinnedIpv4Lookup('93.184.216.34');
    const callback = vi.fn();

    lookup('api.example.com', {}, callback);
    expect(callback).toHaveBeenLastCalledWith(null, '93.184.216.34', 4);

    lookup('api.example.com', { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: '93.184.216.34', family: 4 }]);
  });

  it('pins requests to validated public DNS results, normalizes JSON, and caches successful values briefly', async () => {
    const resolveAddresses = vi.fn().mockResolvedValue(['93.184.216.34']);
    const requestImpl = vi.fn().mockResolvedValue(jsonResponse({ metrics: [{ value: 12 }] }));
    const client = new RestDataSourceClient({ resolveAddresses, requestImpl });

    const first = await client.fetchJson(endpoint);
    const second = await client.fetchJson(endpoint);

    expect(first).toEqual({ metrics: [{ value: 12 }] });
    expect(second).toBe(first);
    expect(resolveAddresses).toHaveBeenCalledOnce();
    expect(requestImpl).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: 'api.example.com' }),
      '93.184.216.34',
      { method: 'GET' },
    );
  });

  it('sends bounded GraphQL queries by POST and caches by endpoint, query, and variables', async () => {
    const resolveAddresses = vi.fn().mockResolvedValue(['93.184.216.34']);
    const requestImpl = vi.fn().mockResolvedValue(jsonResponse(
      { data: { teams: [{ name: 'Voxel' }] } },
      { contentType: 'application/graphql-response+json; charset=utf-8' },
    ));
    const client = new RestDataSourceClient({ resolveAddresses, requestImpl });
    const query = 'query Teams($limit: Int!) { teams(limit: $limit) { name } }';
    const variables = { limit: 5 };

    const first = await client.fetchGraphql(endpoint, query, variables);
    const second = await client.fetchGraphql(endpoint, query, variables);

    expect(first).toEqual({ data: { teams: [{ name: 'Voxel' }] } });
    expect(second).toBe(first);
    expect(requestImpl).toHaveBeenCalledOnce();
    expect(requestImpl.mock.calls[0][2]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ query, variables }),
      accept: 'application/graphql-response+json, application/json',
    });
  });

  it('rejects GraphQL requests without a bounded query and object variables', async () => {
    const client = new RestDataSourceClient({
      resolveAddresses: async () => ['93.184.216.34'],
      requestImpl: vi.fn(),
    });

    await expect(client.fetchGraphql(endpoint, '', {})).rejects.toThrow(/GraphQL query/);
    await expect(client.fetchGraphql(endpoint, 'query { value }', [])).rejects.toThrow(/variables must be a JSON object/);
    await expect(client.fetchGraphql(endpoint, 'x'.repeat(20_001), {})).rejects.toThrow(/GraphQL query/);
    await expect(client.fetchGraphql(endpoint, 'query { value }', { value: 'x'.repeat(33_000) })).rejects.toThrow(/32 KB limit/);
  });

  it('rejects mixed public and private DNS answers before opening a connection', async () => {
    const requestImpl = vi.fn();
    const client = new RestDataSourceClient({
      resolveAddresses: async () => ['93.184.216.34', '10.0.0.8'],
      requestImpl,
    });

    await expect(client.fetchJson(endpoint)).rejects.toThrow(/public IPv4/);
    expect(requestImpl).not.toHaveBeenCalled();
  });

  it('rejects redirects, oversized responses, non-JSON responses, and invalid JSON', async () => {
    const responses = [
      jsonResponse({}, { statusCode: 302 }),
      jsonResponse({}, { body: Buffer.alloc(512 * 1024 + 1) }),
      jsonResponse({}, { contentType: 'text/html' }),
      jsonResponse({}, { body: Buffer.from('{broken') }),
    ];

    for (const response of responses) {
      const client = new RestDataSourceClient({
        resolveAddresses: async () => ['93.184.216.34'],
        requestImpl: async () => response,
      });
      await expect(client.fetchJson(endpoint)).rejects.toBeInstanceOf(RestDataSourceError);
    }
  });
});
