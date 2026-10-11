import { describe, expect, it } from 'vitest';
import { getWidgetDefinition, listWidgetDefinitions, validateWidgetConfiguration } from './widget-registry';

describe('widget registry', () => {
  it('keeps every built-in widget type unique and its defaults valid', () => {
    const definitions = listWidgetDefinitions();
    expect(new Set(definitions.map((definition) => definition.type)).size).toBe(definitions.length);
    expect(definitions.map((definition) => definition.type)).toContain('display');
    for (const definition of definitions) {
      expect(validateWidgetConfiguration(definition.type, definition.defaults)).toMatchObject({ success: true });
    }
  });

  it('provides display card configuration through the registry', () => {
    expect(getWidgetDefinition('display')).toMatchObject({
      category: 'Analytics',
      defaults: { title: 'Active Projects', content: '24' },
      fields: [
        { key: 'content', label: 'Value', isValue: true },
        { key: 'description', label: 'Supporting text' },
      ],
    });
  });

  it('rejects values outside a widget field schema', () => {
    expect(validateWidgetConfiguration('timer', { duration: 0 })).toMatchObject({ success: false });
    expect(validateWidgetConfiguration('status', { statusColor: 'unknown' })).toMatchObject({ success: false });
  });
});
