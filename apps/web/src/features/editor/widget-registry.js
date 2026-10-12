import { useSyncExternalStore } from 'react';

const supportedRenderers = new Set([
  'metric',
  'display',
  'logic',
  'chart',
  'progress',
  'status',
  'note',
  'table',
  'timer',
  'code',
  'link',
  'image',
  'embed',
  'divider',
]);
const supportedFieldTypes = new Set([
  'text',
  'textarea',
  'url',
  'number',
  'number-text',
  'select',
  'node-select',
]);
const validSizes = new Set(['small', 'medium', 'large', 'wide']);
const rendererContracts = {
  metric: { fields: ['content'], defaults: ['content'] },
  display: { fields: ['content'], defaults: ['content'] },
  logic: {
    fields: ['logicA', 'logicB', 'logicOp'],
    defaults: ['content', 'logicA', 'logicB', 'logicOp'],
  },
  chart: { fields: ['content'], defaults: ['content'] },
  progress: { fields: ['content', 'target'], defaults: ['content', 'target'] },
  status: { fields: ['content', 'statusColor'], defaults: ['content', 'statusColor'] },
  note: { fields: ['content'], defaults: ['content'] },
  table: { fields: ['columns', 'rows'], defaults: ['columns', 'rows'] },
  timer: { fields: ['duration'], defaults: ['duration', 'timerMode'] },
  code: { fields: ['code'], defaults: ['code', 'language'] },
  link: { fields: ['url'], defaults: ['url'] },
  image: { fields: ['imageUrl'], defaults: ['imageUrl'] },
  embed: { fields: ['embedUrl'], defaults: ['embedUrl'] },
  divider: { fields: ['dividerStyle'], defaults: ['dividerStyle'] },
};
const definitions = new Map();
const listeners = new Set();
let snapshot = Object.freeze([]);

const definitionList = [
  {
    type: 'metric',
    category: 'Analytics',
    title: 'Metric Node',
    description: 'Show a key number with its unit.',
    icon: 'activity',
    defaultSize: 'medium',
    defaults: {
      title: 'Monthly Goal',
      content: '5400',
      unit: '$',
      size: 'medium',
      color: 'indigo',
    },
    fields: [
      { key: 'content', label: 'Value', type: 'text', maxLength: 2000, isValue: true },
      { key: 'unit', label: 'Unit', type: 'text', maxLength: 24, placeholder: 'e.g. $, %, /s' },
    ],
  },
  {
    type: 'display',
    category: 'Analytics',
    title: 'Display Card',
    description: 'Highlight a KPI and a short supporting note.',
    icon: 'zap',
    defaultSize: 'medium',
    defaults: {
      title: 'Active Projects',
      content: '24',
      description: 'Across all teams',
      size: 'medium',
      color: 'amber',
    },
    fields: [
      { key: 'content', label: 'Value', type: 'text', maxLength: 2000, isValue: true },
      {
        key: 'description',
        label: 'Supporting text',
        type: 'text',
        maxLength: 280,
        placeholder: 'A short explanation',
      },
    ],
  },
  {
    type: 'logic',
    category: 'Analytics',
    title: 'Formula Node',
    description: 'Calculate a value from two connected widgets.',
    icon: 'cpu',
    defaultSize: 'medium',
    defaults: {
      title: 'Calculated Cost',
      content: '0',
      logicA: '',
      logicB: '',
      logicOp: '*',
      size: 'medium',
      color: 'violet',
    },
    fields: [
      { key: 'logicA', label: 'Input source A', type: 'node-select' },
      {
        key: 'logicOp',
        label: 'Operator',
        type: 'select',
        options: [
          { value: '+', label: 'Add (+)' },
          { value: '-', label: 'Subtract (−)' },
          { value: '*', label: 'Multiply (×)' },
          { value: '/', label: 'Divide (÷)' },
        ],
      },
      { key: 'logicB', label: 'Input source B', type: 'node-select' },
    ],
  },
  {
    type: 'chart',
    category: 'Charts',
    title: 'Trend Chart',
    description: 'Plot a sequence of comma-separated values.',
    icon: 'chart',
    defaultSize: 'medium',
    defaults: {
      title: 'Traffic Trend',
      content: '10,25,18,30,45,28,60',
      size: 'medium',
      color: 'cyan',
    },
    fields: [
      {
        key: 'content',
        label: 'Sparkline data (CSV)',
        type: 'text',
        maxLength: 12000,
        placeholder: '10, 20, 15, 30',
        help: 'Comma-separated values',
        isValue: true,
      },
    ],
  },
  {
    type: 'progress',
    category: 'Analytics',
    title: 'Goal Progress',
    description: 'Track a value against its target.',
    icon: 'progress',
    defaultSize: 'medium',
    defaults: {
      title: 'Progress Target',
      content: '65',
      target: 100,
      size: 'medium',
      color: 'emerald',
    },
    fields: [
      { key: 'content', label: 'Current value', type: 'number-text', maxLength: 80, isValue: true },
      { key: 'target', label: 'Target goal', type: 'number', min: 1, max: 1000000000 },
    ],
  },
  {
    type: 'status',
    category: 'Analytics',
    title: 'Health Status',
    description: 'Show a service state or operational message.',
    icon: 'status',
    defaultSize: 'small',
    defaults: {
      title: 'System Health',
      content: 'Operational',
      statusColor: 'success',
      size: 'small',
      color: 'emerald',
    },
    fields: [
      { key: 'content', label: 'Message', type: 'text', maxLength: 280, isValue: true },
      {
        key: 'statusColor',
        label: 'State',
        type: 'select',
        options: [
          { value: 'success', label: 'Success' },
          { value: 'warning', label: 'Warning' },
          { value: 'error', label: 'Error' },
        ],
      },
    ],
  },
  {
    type: 'note',
    category: 'Text',
    title: 'Annotation Note',
    description: 'Add context and documentation to the canvas.',
    icon: 'note',
    defaultSize: 'wide',
    defaults: {
      title: 'Untitled Note',
      content: 'Start writing useful context for your team.',
      size: 'wide',
      color: 'slate',
    },
    fields: [
      { key: 'content', label: 'Note content', type: 'textarea', maxLength: 20000, isValue: true },
    ],
  },
  {
    type: 'table',
    category: 'Data',
    title: 'Data Table',
    description: 'Present records in a simple table.',
    icon: 'table',
    defaultSize: 'wide',
    defaults: {
      title: 'Data Grid',
      columns: 'Item,Qty,Status',
      rows: 'Widget A,12,Done\nWidget B,4,Pending\nWidget C,19,Active',
      size: 'wide',
      color: 'slate',
    },
    fields: [
      {
        key: 'columns',
        label: 'Columns',
        type: 'text',
        maxLength: 1000,
        placeholder: 'Name,Owner,Status',
      },
      {
        key: 'rows',
        label: 'Rows',
        type: 'textarea',
        maxLength: 24000,
        help: 'Comma-separated values, one row per line.',
      },
    ],
  },
  {
    type: 'timer',
    category: 'Productivity',
    title: 'Sprint Timer',
    description: 'Run a countdown or stopwatch on the canvas.',
    icon: 'timer',
    defaultSize: 'medium',
    defaults: {
      title: 'Sprint Timer',
      duration: 300,
      timerMode: 'countdown',
      timerState: 'idle',
      size: 'medium',
      color: 'amber',
    },
    fields: [
      { key: 'duration', label: 'Duration (seconds)', type: 'number', min: 1, max: 86400 },
      {
        key: 'timerMode',
        label: 'Timer mode',
        type: 'select',
        options: [
          { value: 'countdown', label: 'Countdown' },
          { value: 'stopwatch', label: 'Stopwatch' },
        ],
      },
    ],
  },
  {
    type: 'code',
    category: 'Developer',
    title: 'Code Snippet',
    description: 'Keep a formatted code sample beside your work.',
    icon: 'code',
    defaultSize: 'wide',
    defaults: {
      title: 'Utility Snippet',
      code: 'function hello() {\n  console.log("Hello, Voxel!");\n}',
      language: 'javascript',
      size: 'wide',
      color: 'slate',
    },
    fields: [
      {
        key: 'language',
        label: 'Language',
        type: 'select',
        options: ['javascript', 'html', 'css', 'python', 'json'].map((value) => ({
          value,
          label: value.toUpperCase(),
        })),
      },
      { key: 'code', label: 'Code', type: 'textarea', maxLength: 50000, monospace: true },
    ],
  },
  {
    type: 'link',
    category: 'Navigation',
    title: 'Reference Link',
    description: 'Keep a useful external reference close at hand.',
    icon: 'link',
    defaultSize: 'medium',
    defaults: {
      title: 'Reference Link',
      url: 'https://github.com',
      description: 'Check out code templates and tools.',
      size: 'medium',
      color: 'cyan',
    },
    fields: [
      { key: 'url', label: 'Link URL', type: 'url', maxLength: 2048 },
      { key: 'description', label: 'Link description', type: 'text', maxLength: 280 },
    ],
  },
  {
    type: 'image',
    category: 'Media',
    title: 'Image Media',
    description: 'Place an image reference on the canvas.',
    icon: 'image',
    defaultSize: 'medium',
    defaults: {
      title: 'Image Showcase',
      imageUrl:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      objectFit: 'cover',
      size: 'medium',
      color: 'slate',
    },
    fields: [
      { key: 'imageUrl', label: 'Image URL', type: 'url', maxLength: 4096 },
      {
        key: 'objectFit',
        label: 'Image layout',
        type: 'select',
        options: [
          { value: 'cover', label: 'Cover' },
          { value: 'contain', label: 'Contain' },
          { value: 'fill', label: 'Fill' },
        ],
      },
    ],
  },
  {
    type: 'embed',
    category: 'Media',
    title: 'Media Embed',
    description: 'Embed trusted HTTP or HTTPS content.',
    icon: 'embed',
    defaultSize: 'wide',
    defaults: {
      title: 'Figma Embed',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      size: 'wide',
      color: 'slate',
    },
    fields: [{ key: 'embedUrl', label: 'Embed URL', type: 'url', maxLength: 4096 }],
  },
  {
    type: 'divider',
    category: 'Layout',
    title: 'Section Divider',
    description: 'Separate related areas on the canvas.',
    icon: 'divider',
    defaultSize: 'wide',
    defaults: { title: 'Section Divider', dividerStyle: 'solid', size: 'wide', color: 'slate' },
    fields: [
      {
        key: 'dividerStyle',
        label: 'Divider style',
        type: 'select',
        options: [
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
          { value: 'dotted', label: 'Dotted' },
        ],
      },
    ],
  },
];

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function cloneJson(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || seen.has(value)) {
    throw new TypeError('Widget schemas must contain only acyclic JSON data.');
  }
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('Widget schemas must contain only plain JSON objects.');
  }

  seen.add(value);
  let clone;
  if (Array.isArray(value)) {
    clone = value.map((item) => cloneJson(item, seen));
  } else {
    clone = {};
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        throw new TypeError('Widget schemas cannot contain prototype keys.');
      }
      clone[key] = cloneJson(item, seen);
    }
  }
  seen.delete(value);
  return clone;
}

function normalizeDefinition(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    throw new TypeError('Widget definitions must be objects.');
  }
  const type = definition.type;
  if (
    typeof type !== 'string' ||
    !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(type) ||
    type.length > 120
  ) {
    throw new TypeError('Widget type must be a lowercase namespaced identifier.');
  }
  for (const key of ['title', 'category', 'description', 'icon']) {
    if (
      typeof definition[key] !== 'string' ||
      !definition[key].trim() ||
      definition[key].length > 200
    ) {
      throw new TypeError(`Widget ${key} must be a non-empty string of at most 200 characters.`);
    }
  }
  if (!supportedRenderers.has(definition.renderer)) {
    throw new TypeError('Widget renderer must use a supported Voxel renderer.');
  }
  if (!validSizes.has(definition.defaultSize))
    throw new TypeError('Widget defaultSize is invalid.');
  if (
    !definition.defaults ||
    typeof definition.defaults !== 'object' ||
    Array.isArray(definition.defaults)
  ) {
    throw new TypeError('Widget defaults must be a JSON object.');
  }
  if (!Array.isArray(definition.fields) || definition.fields.length > 40) {
    throw new TypeError('Widget fields must be an array of at most 40 fields.');
  }

  const seenFields = new Set();
  for (const field of definition.fields) {
    if (!field || typeof field !== 'object' || Array.isArray(field))
      throw new TypeError('Widget fields must be objects.');
    if (
      typeof field.key !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(field.key) ||
      seenFields.has(field.key)
    ) {
      throw new TypeError('Widget field keys must be unique safe identifiers.');
    }
    seenFields.add(field.key);
    if (typeof field.label !== 'string' || !field.label.trim() || field.label.length > 120) {
      throw new TypeError('Widget field labels must be non-empty and at most 120 characters.');
    }
    if (!supportedFieldTypes.has(field.type))
      throw new TypeError(`Unsupported widget field type: ${field.type}`);
    if (field.required !== undefined && typeof field.required !== 'boolean')
      throw new TypeError('Widget field required must be a boolean.');
    if (field.type === 'number') {
      if (!Number.isFinite(field.min) || !Number.isFinite(field.max) || field.min > field.max) {
        throw new TypeError('Number fields require finite minimum and maximum values.');
      }
    } else if (field.type === 'select') {
      if (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100) {
        throw new TypeError('Select fields require between 1 and 100 options.');
      }
      const values = new Set();
      for (const option of field.options) {
        if (
          !option ||
          typeof option.value !== 'string' ||
          option.value.length > 160 ||
          typeof option.label !== 'string' ||
          !option.label.trim() ||
          option.label.length > 160 ||
          values.has(option.value)
        ) {
          throw new TypeError('Select options must have unique string values and string labels.');
        }
        values.add(option.value);
      }
    } else if (field.type !== 'node-select') {
      if (!Number.isInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > 50000) {
        throw new TypeError('Text fields require a maxLength between 1 and 50000.');
      }
    }
  }

  const normalized = {
    type,
    title: definition.title.trim(),
    category: definition.category.trim(),
    description: definition.description.trim(),
    icon: definition.icon,
    renderer: definition.renderer,
    defaultSize: definition.defaultSize,
    defaults: cloneJson(definition.defaults),
    fields: cloneJson(definition.fields),
  };
  const rendererContract = rendererContracts[normalized.renderer];
  const fieldKeys = new Set(normalized.fields.map((field) => field.key));
  for (const key of rendererContract.fields) {
    if (!fieldKeys.has(key)) {
      throw new TypeError(`The ${normalized.renderer} renderer requires a ${key} field.`);
    }
  }
  for (const key of rendererContract.defaults) {
    if (!Object.hasOwn(normalized.defaults, key)) {
      throw new TypeError(`The ${normalized.renderer} renderer requires a ${key} default.`);
    }
  }
  if (normalized.defaults.size != null && !validSizes.has(normalized.defaults.size)) {
    throw new TypeError('Widget defaults.size must be a supported size.');
  }
  const defaultsValidation = validateDefinitionConfiguration(normalized, normalized.defaults);
  if (!defaultsValidation.success) {
    throw new TypeError(`Widget defaults are invalid: ${defaultsValidation.error}`);
  }
  return freezeDeep(normalized);
}

function publishSnapshot() {
  snapshot = Object.freeze(Array.from(definitions.values()));
  listeners.forEach((listener) => listener());
}

export function registerWidgetDefinition(definition) {
  const normalized = normalizeDefinition(definition);
  if (definitions.has(normalized.type))
    throw new Error(`Widget type “${normalized.type}” is already registered.`);
  definitions.set(normalized.type, normalized);
  publishSnapshot();

  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    if (definitions.get(normalized.type) === normalized) {
      definitions.delete(normalized.type);
      publishSnapshot();
    }
  };
}

export function listWidgetDefinitions() {
  return snapshot;
}

export function getWidgetDefinition(type) {
  return definitions.get(type) ?? null;
}

export function useWidgetDefinitions() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listWidgetDefinitions,
    listWidgetDefinitions,
  );
}

for (const definition of definitionList) {
  registerWidgetDefinition({ ...definition, renderer: definition.type });
}

export function validateWidgetConfiguration(type, node) {
  const definition = getWidgetDefinition(type);
  if (!definition) return { success: false, error: `Widget type “${type}” is not registered.` };
  return validateDefinitionConfiguration(definition, node);
}

function validateDefinitionConfiguration(definition, node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { success: false, error: 'Widget configuration must be an object.' };
  }
  if (node.title != null && (typeof node.title !== 'string' || node.title.length > 160)) {
    return { success: false, error: 'Widget titles must be 160 characters or fewer.' };
  }

  for (const field of definition.fields) {
    const value = node[field.key];
    if (value == null) {
      if (field.required) return { success: false, error: `${field.label} is required.` };
      continue;
    }
    if (field.type === 'number') {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < field.min ||
        value > field.max
      ) {
        return {
          success: false,
          error: `${field.label} must be between ${field.min} and ${field.max}.`,
        };
      }
      continue;
    }
    if (field.type === 'select') {
      if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) {
        return { success: false, error: `Choose a valid ${field.label.toLowerCase()}.` };
      }
      continue;
    }
    if (typeof value !== 'string') return { success: false, error: `${field.label} must be text.` };
    if (field.type === 'node-select' && value.length > 160) {
      return { success: false, error: `${field.label} must reference a valid widget.` };
    }
    if (field.maxLength && value.length > field.maxLength) {
      return {
        success: false,
        error: `${field.label} must be ${field.maxLength} characters or fewer.`,
      };
    }
    if (field.type === 'url' && value) {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol))
          throw new Error('Unsupported URL protocol.');
      } catch {
        return { success: false, error: `${field.label} must be a valid HTTP or HTTPS URL.` };
      }
    }
  }
  return { success: true, data: node };
}
