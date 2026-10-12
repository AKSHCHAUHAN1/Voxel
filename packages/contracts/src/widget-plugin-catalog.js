const freezeDeep = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
};

export const widgetPluginCatalog = freezeDeep([
  {
    id: 'voxel.operations-toolkit',
    name: 'Operations Toolkit',
    version: '1.0.0',
    author: 'Voxel',
    category: 'Operations',
    description: 'Add a ready-to-configure service health card for operational dashboards.',
    permissions: [],
    widgets: [
      {
        type: 'voxel.operations.service-health',
        category: 'Operations',
        title: 'Service Health',
        description: 'Show the current health of a service or environment.',
        icon: 'status',
        renderer: 'status',
        defaultSize: 'medium',
        defaults: {
          title: 'API Service',
          content: 'Operational',
          statusColor: 'success',
          size: 'medium',
          color: 'emerald',
        },
        fields: [
          { key: 'content', label: 'Health message', type: 'text', maxLength: 280, isValue: true },
          {
            key: 'statusColor',
            label: 'Health state',
            type: 'select',
            options: [
              { value: 'success', label: 'Healthy' },
              { value: 'warning', label: 'Degraded' },
              { value: 'error', label: 'Unavailable' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'voxel.delivery-metrics',
    name: 'Delivery Metrics',
    version: '1.0.0',
    author: 'Voxel',
    category: 'Analytics',
    description: 'Add a release progress card with a target and current delivery value.',
    permissions: [],
    widgets: [
      {
        type: 'voxel.delivery.release-progress',
        category: 'Analytics',
        title: 'Release Progress',
        description: 'Compare shipped work against a release target.',
        icon: 'progress',
        renderer: 'progress',
        defaultSize: 'medium',
        defaults: {
          title: 'Release 1.0',
          content: '18',
          target: 24,
          size: 'medium',
          color: 'emerald',
        },
        fields: [
          {
            key: 'content',
            label: 'Completed items',
            type: 'number-text',
            maxLength: 80,
            isValue: true,
          },
          { key: 'target', label: 'Release target', type: 'number', min: 1, max: 1000000000 },
        ],
      },
    ],
  },
]);

const widgetPluginsByType = new Map(
  widgetPluginCatalog.flatMap((plugin) => plugin.widgets.map((widget) => [widget.type, plugin])),
);

export const getWidgetPluginForType = (type) => widgetPluginsByType.get(type) ?? null;

export const validatePluginWidgetConfiguration = (widget, node) => {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return 'Widget configuration must be an object.';
  }
  if (node.title != null && (typeof node.title !== 'string' || node.title.length > 160)) {
    return 'Widget titles must be 160 characters or fewer.';
  }
  for (const field of widget.fields) {
    const value = node[field.key];
    if (value == null) {
      if (field.required) return `${field.label} is required.`;
      continue;
    }
    if (field.type === 'number') {
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        return `${field.label} must be between ${field.min} and ${field.max}.`;
      }
      continue;
    }
    if (field.type === 'select') {
      if (typeof value !== 'string' || !field.options.some((option) => option.value === value)) {
        return `Choose a valid ${field.label.toLowerCase()}.`;
      }
      continue;
    }
    if (typeof value !== 'string') return `${field.label} must be text.`;
    if (field.type === 'node-select' && value.length > 160) {
      return `${field.label} must reference a valid widget.`;
    }
    if (field.maxLength && value.length > field.maxLength) {
      return `${field.label} must be ${field.maxLength} characters or fewer.`;
    }
    if (field.type === 'url' && value) {
      try {
        const url = new globalThis.URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid URL protocol.');
      } catch {
        return `${field.label} must be a valid HTTP or HTTPS URL.`;
      }
    }
  }
  return null;
};
