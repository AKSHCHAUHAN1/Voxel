const MAX_DATA_ROWS = 1000;

const uniqueHeaders = (values) => {
  const seen = new Map();
  return values.map((value, index) => {
    const base = String(value || '').trim() || `Column ${index + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
};

export function parseCsv(text) {
  const records = [];
  let row = [];
  let value = '';
  let quoted = false;
  let truncated = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === ',') {
      row.push(value);
      value = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      value = '';
      if (row.some((cell) => cell.length > 0)) records.push(row);
      row = [];
      if (records.length > MAX_DATA_ROWS + 1) {
        truncated = true;
        break;
      }
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('CSV file contains an unterminated quoted value.');
  if (row.length > 0 || value.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.length > 0)) records.push(row);
  }
  if (records.length < 2) throw new Error('CSV files must include a header row and at least one data row.');

  const columns = uniqueHeaders(records[0].map((header, index) => (
    index === 0 ? header.replace(/^\uFEFF/, '') : header
  )));
  const rows = records.slice(1, MAX_DATA_ROWS + 1).map((record) =>
    Object.fromEntries(columns.map((column, index) => [column, record[index] ?? ''])),
  );
  return { kind: 'csv', columns, rows, truncated: truncated || records.length > MAX_DATA_ROWS + 1 };
}

export function parseWorkspaceDataFile(text, file) {
  const isJson = file?.contentType === 'application/json' || /\.json$/i.test(file?.name || '');
  if (!isJson) return parseCsv(text);
  try {
    return { kind: 'json', value: JSON.parse(text) };
  } catch {
    throw new Error('JSON file could not be parsed.');
  }
}

export function valueAtPath(value, path) {
  if (!path) return value;
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  return segments.reduce((current, segment) => current == null ? undefined : current[segment], value);
}

const jsonRecords = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['records', 'items', 'rows', 'data']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [];
};

export function tableFromWorkspaceData(source, path = '') {
  if (!source) return { columns: [], rows: [], truncated: false };
  if (source.kind === 'csv') return { columns: source.columns, rows: source.rows, truncated: source.truncated };

  const target = valueAtPath(source.value, path);
  const records = jsonRecords(target === undefined ? source.value : target).slice(0, MAX_DATA_ROWS);
  const first = records[0];
  if (!first) return { columns: [], rows: [], truncated: false };

  if (Array.isArray(first)) {
    const columns = uniqueHeaders(first.map((_value, index) => `Column ${index + 1}`));
    return {
      columns,
      rows: records.map((record) => Object.fromEntries(columns.map((column, index) => [column, String(record[index] ?? '')]))),
      truncated: records.length === MAX_DATA_ROWS,
    };
  }
  if (typeof first !== 'object') {
    return { columns: ['Value'], rows: records.map((value) => ({ Value: String(value ?? '') })), truncated: records.length === MAX_DATA_ROWS };
  }

  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))].slice(0, 100);
  return {
    columns,
    rows: records.map((record) => Object.fromEntries(columns.map((column) => [column, String(record[column] ?? '')]))),
    truncated: records.length === MAX_DATA_ROWS,
  };
}

const displayString = (value) => {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join(',');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export function valueFromWorkspaceData(source, node) {
  if (!source) return undefined;
  const field = String(node.dataSourceField || '').trim();
  if (source.kind === 'csv') {
    if (node.type === 'table') return undefined;
    const key = field || source.columns.find((column) => source.rows.some((row) => Number.isFinite(Number(row[column])))) || source.columns[0];
    if (node.type === 'chart') {
      return source.rows.map((row) => Number(row[key])).filter(Number.isFinite).join(',');
    }
    return source.rows[0]?.[key];
  }

  const root = source.value;
  if (node.type === 'table') return undefined;
  if (node.type === 'chart') {
    const candidate = field ? valueAtPath(root, field) : root?.values ?? root?.data ?? root;
    const values = Array.isArray(candidate)
      ? candidate
      : candidate && typeof candidate === 'object'
        ? Object.values(candidate)
        : [];
    return values.map(Number).filter(Number.isFinite).join(',');
  }
  const candidate = field ? valueAtPath(root, field) : root?.value ?? root?.data?.value ?? root;
  return displayString(candidate);
}
