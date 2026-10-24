import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  parseWorkspaceDataFile,
  tableFromWorkspaceData,
  valueAtPath,
  valueFromWorkspaceData,
} from './workspace-data-source';

describe('workspace file data sources', () => {
  it('parses quoted CSV values and normalizes duplicate headers', () => {
    const source = parseWorkspaceDataFile(
      '\uFEFFName,Name,Notes\r\nAda,42,"line one, line two"\r\n',
      { name: 'team.csv', contentType: 'text/csv' },
    );

    expect(source).toMatchObject({
      kind: 'csv',
      columns: ['Name', 'Name (2)', 'Notes'],
      rows: [{ Name: 'Ada', 'Name (2)': '42', Notes: 'line one, line two' }],
      truncated: false,
    });
  });

  it('rejects malformed CSV and JSON instead of rendering partial content', () => {
    expect(() => parseCsv('Name,Value\n"unfinished,4')).toThrow(/unterminated/);
    expect(() => parseWorkspaceDataFile('{bad json', { name: 'data.json' })).toThrow(/could not be parsed/);
  });

  it('resolves JSON paths and maps record arrays into table rows', () => {
    const source = parseWorkspaceDataFile(
      JSON.stringify({ metrics: [{ label: 'North', total: 18 }, { label: 'South', total: 24 }] }),
      { name: 'report.json', contentType: 'application/json' },
    );

    expect(valueAtPath(source.value, 'metrics[1].total')).toBe(24);
    expect(tableFromWorkspaceData(source, 'metrics')).toEqual({
      columns: ['label', 'total'],
      rows: [{ label: 'North', total: '18' }, { label: 'South', total: '24' }],
      truncated: false,
    });
    expect(valueFromWorkspaceData(source, { type: 'metric', dataSourceField: 'metrics[0].total' })).toBe('18');
    expect(valueFromWorkspaceData(source, { type: 'chart', dataSourceField: 'metrics.total' })).toBe('');
    expect(valueAtPath(source.value, 'constructor')).toBeUndefined();
  });

  it('provides numeric chart values and table rows from CSV columns', () => {
    const source = parseCsv('Month,Revenue\nJan,12\nFeb,18\n');

    expect(valueFromWorkspaceData(source, { type: 'metric', dataSourceField: 'Revenue' })).toBe('12');
    expect(valueFromWorkspaceData(source, { type: 'chart', dataSourceField: 'Revenue' })).toBe('12,18');
    expect(tableFromWorkspaceData(source)).toMatchObject({
      columns: ['Month', 'Revenue'],
      rows: [{ Month: 'Jan', Revenue: '12' }, { Month: 'Feb', Revenue: '18' }],
    });
  });

  it('does not turn empty CSV chart cells into zeroes', () => {
    const source = parseCsv('Month,Revenue\nJan,\nFeb,18\nMar,not reported\n');

    expect(valueFromWorkspaceData(source, { type: 'chart', dataSourceField: 'Revenue' })).toBe('18');
  });

  it('marks JSON record tables truncated only when rows are actually omitted', () => {
    const exactLimit = tableFromWorkspaceData({ kind: 'json', value: Array.from({ length: 1000 }, (_value, index) => ({ id: index })) });
    const overLimit = tableFromWorkspaceData({ kind: 'json', value: Array.from({ length: 1001 }, (_value, index) => ({ id: index })) });

    expect(exactLimit).toMatchObject({ truncated: false, rows: expect.any(Array) });
    expect(exactLimit.rows).toHaveLength(1000);
    expect(overLimit).toMatchObject({ truncated: true, rows: expect.any(Array) });
    expect(overLimit.rows).toHaveLength(1000);
  });
});
