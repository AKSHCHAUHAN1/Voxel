const definitionList = [
  {
    type: 'metric', category: 'Analytics', title: 'Metric Node', description: 'Show a key number with its unit.', icon: 'activity', defaultSize: 'medium',
    defaults: { title: 'Monthly Goal', content: '5400', unit: '$', size: 'medium', color: 'indigo' },
    fields: [
      { key: 'content', label: 'Value', type: 'text', maxLength: 2000, isValue: true },
      { key: 'unit', label: 'Unit', type: 'text', maxLength: 24, placeholder: 'e.g. $, %, /s' },
    ],
  },
  {
    type: 'display', category: 'Analytics', title: 'Display Card', description: 'Highlight a KPI and a short supporting note.', icon: 'zap', defaultSize: 'medium',
    defaults: { title: 'Active Projects', content: '24', description: 'Across all teams', size: 'medium', color: 'amber' },
    fields: [
      { key: 'content', label: 'Value', type: 'text', maxLength: 2000, isValue: true },
      { key: 'description', label: 'Supporting text', type: 'text', maxLength: 280, placeholder: 'A short explanation' },
    ],
  },
  {
    type: 'logic', category: 'Analytics', title: 'Formula Node', description: 'Calculate a value from two connected widgets.', icon: 'cpu', defaultSize: 'medium',
    defaults: { title: 'Calculated Cost', content: '0', logicA: '', logicB: '', logicOp: '*', size: 'medium', color: 'violet' },
    fields: [
      { key: 'logicA', label: 'Input source A', type: 'node-select' },
      { key: 'logicOp', label: 'Operator', type: 'select', options: [{ value: '+', label: 'Add (+)' }, { value: '-', label: 'Subtract (−)' }, { value: '*', label: 'Multiply (×)' }, { value: '/', label: 'Divide (÷)' }] },
      { key: 'logicB', label: 'Input source B', type: 'node-select' },
    ],
  },
  {
    type: 'chart', category: 'Charts', title: 'Trend Chart', description: 'Plot a sequence of comma-separated values.', icon: 'chart', defaultSize: 'medium',
    defaults: { title: 'Traffic Trend', content: '10,25,18,30,45,28,60', size: 'medium', color: 'cyan' },
    fields: [{ key: 'content', label: 'Sparkline data (CSV)', type: 'text', maxLength: 12000, placeholder: '10, 20, 15, 30', help: 'Comma-separated values', isValue: true }],
  },
  {
    type: 'progress', category: 'Analytics', title: 'Goal Progress', description: 'Track a value against its target.', icon: 'progress', defaultSize: 'medium',
    defaults: { title: 'Progress Target', content: '65', target: 100, size: 'medium', color: 'emerald' },
    fields: [
      { key: 'content', label: 'Current value', type: 'number-text', maxLength: 80, isValue: true },
      { key: 'target', label: 'Target goal', type: 'number', min: 1, max: 1000000000 },
    ],
  },
  {
    type: 'status', category: 'Analytics', title: 'Health Status', description: 'Show a service state or operational message.', icon: 'status', defaultSize: 'small',
    defaults: { title: 'System Health', content: 'Operational', statusColor: 'success', size: 'small', color: 'emerald' },
    fields: [
      { key: 'content', label: 'Message', type: 'text', maxLength: 280, isValue: true },
      { key: 'statusColor', label: 'State', type: 'select', options: [{ value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'error', label: 'Error' }] },
    ],
  },
  {
    type: 'note', category: 'Text', title: 'Annotation Note', description: 'Add context and documentation to the canvas.', icon: 'note', defaultSize: 'wide',
    defaults: { title: 'Untitled Note', content: 'Start writing useful context for your team.', size: 'wide', color: 'slate' },
    fields: [{ key: 'content', label: 'Note content', type: 'textarea', maxLength: 20000, isValue: true }],
  },
  {
    type: 'table', category: 'Data', title: 'Data Table', description: 'Present records in a simple table.', icon: 'table', defaultSize: 'wide',
    defaults: { title: 'Data Grid', columns: 'Item,Qty,Status', rows: 'Widget A,12,Done\nWidget B,4,Pending\nWidget C,19,Active', size: 'wide', color: 'slate' },
    fields: [
      { key: 'columns', label: 'Columns', type: 'text', maxLength: 1000, placeholder: 'Name,Owner,Status' },
      { key: 'rows', label: 'Rows', type: 'textarea', maxLength: 24000, help: 'Comma-separated values, one row per line.' },
    ],
  },
  {
    type: 'timer', category: 'Productivity', title: 'Sprint Timer', description: 'Run a countdown or stopwatch on the canvas.', icon: 'timer', defaultSize: 'medium',
    defaults: { title: 'Sprint Timer', duration: 300, timerMode: 'countdown', timerState: 'idle', size: 'medium', color: 'amber' },
    fields: [
      { key: 'duration', label: 'Duration (seconds)', type: 'number', min: 1, max: 86400 },
      { key: 'timerMode', label: 'Timer mode', type: 'select', options: [{ value: 'countdown', label: 'Countdown' }, { value: 'stopwatch', label: 'Stopwatch' }] },
    ],
  },
  {
    type: 'code', category: 'Developer', title: 'Code Snippet', description: 'Keep a formatted code sample beside your work.', icon: 'code', defaultSize: 'wide',
    defaults: { title: 'Utility Snippet', code: 'function hello() {\n  console.log("Hello, Voxel!");\n}', language: 'javascript', size: 'wide', color: 'slate' },
    fields: [
      { key: 'language', label: 'Language', type: 'select', options: ['javascript', 'html', 'css', 'python', 'json'].map((value) => ({ value, label: value.toUpperCase() })) },
      { key: 'code', label: 'Code', type: 'textarea', maxLength: 50000, monospace: true },
    ],
  },
  {
    type: 'link', category: 'Navigation', title: 'Reference Link', description: 'Keep a useful external reference close at hand.', icon: 'link', defaultSize: 'medium',
    defaults: { title: 'Reference Link', url: 'https://github.com', description: 'Check out code templates and tools.', size: 'medium', color: 'cyan' },
    fields: [
      { key: 'url', label: 'Link URL', type: 'url', maxLength: 2048 },
      { key: 'description', label: 'Link description', type: 'text', maxLength: 280 },
    ],
  },
  {
    type: 'image', category: 'Media', title: 'Image Media', description: 'Place an image reference on the canvas.', icon: 'image', defaultSize: 'medium',
    defaults: { title: 'Image Showcase', imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60', objectFit: 'cover', size: 'medium', color: 'slate' },
    fields: [
      { key: 'imageUrl', label: 'Image URL', type: 'url', maxLength: 4096 },
      { key: 'objectFit', label: 'Image layout', type: 'select', options: [{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }, { value: 'fill', label: 'Fill' }] },
    ],
  },
  {
    type: 'embed', category: 'Media', title: 'Media Embed', description: 'Embed trusted HTTP or HTTPS content.', icon: 'embed', defaultSize: 'wide',
    defaults: { title: 'Figma Embed', embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', size: 'wide', color: 'slate' },
    fields: [{ key: 'embedUrl', label: 'Embed URL', type: 'url', maxLength: 4096 }],
  },
  {
    type: 'divider', category: 'Layout', title: 'Section Divider', description: 'Separate related areas on the canvas.', icon: 'divider', defaultSize: 'wide',
    defaults: { title: 'Section Divider', dividerStyle: 'solid', size: 'wide', color: 'slate' },
    fields: [{ key: 'dividerStyle', label: 'Divider style', type: 'select', options: [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }] }],
  },
];

const definitions = new Map(definitionList.map((definition) => [definition.type, Object.freeze({ ...definition, defaults: Object.freeze(definition.defaults), fields: Object.freeze(definition.fields.map((field) => Object.freeze(field))) })]));

export const listWidgetDefinitions = () => [...definitions.values()];
export const getWidgetDefinition = (type) => definitions.get(type) ?? null;

export function validateWidgetConfiguration(type, node) {
  const definition = getWidgetDefinition(type);
  if (!definition) return { success: false, error: `Widget type “${type}” is not registered.` };
  if (node.title != null && (typeof node.title !== 'string' || node.title.length > 160)) {
    return { success: false, error: 'Widget titles must be 160 characters or fewer.' };
  }

  for (const field of definition.fields) {
    const value = node[field.key];
    if (value == null) continue;
    if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < field.min || value > field.max) {
        return { success: false, error: `${field.label} must be between ${field.min} and ${field.max}.` };
      }
      continue;
    }
    if (typeof value !== 'string' || value.length > field.maxLength) {
      return { success: false, error: `${field.label} must be ${field.maxLength} characters or fewer.` };
    }
    if (field.type === 'select' && field.options && !field.options.some((option) => option.value === value)) {
      return { success: false, error: `Choose a valid ${field.label.toLowerCase()}.` };
    }
  }
  return { success: true, data: node };
}
