import { describe, expect, it } from 'vitest';
import {
  getWidgetDefinition,
  listWidgetDefinitions,
  registerWidgetDefinition,
  validateWidgetConfiguration,
} from './widget-registry';

const dynamicDefinition = {
  type: 'acme.temperature',
  category: 'Operations',
  title: 'Temperature',
  description: 'Show a room temperature reading.',
  icon: 'activity',
  renderer: 'metric',
  defaultSize: 'medium',
  defaults: { title: 'Room temperature', content: '21', unit: '°C', size: 'medium' },
  fields: [
    { key: 'content', label: 'Value', type: 'number-text', maxLength: 16, isValue: true },
    { key: 'unit', label: 'Unit', type: 'text', maxLength: 12 },
  ],
};

describe('widget registry', () => {
  it('keeps every built-in widget type unique and its defaults valid', () => {
    const definitions = listWidgetDefinitions();
    expect(new Set(definitions.map((definition) => definition.type)).size).toBe(definitions.length);
    expect(definitions.map((definition) => definition.type)).toContain('display');
    for (const definition of definitions) {
      expect(validateWidgetConfiguration(definition.type, definition.defaults)).toMatchObject({
        success: true,
      });
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
    expect(validateWidgetConfiguration('status', { statusColor: 'unknown' })).toMatchObject({
      success: false,
    });
  });

  it('registers and removes declarative widget definitions reactively', () => {
    const previousSnapshot = listWidgetDefinitions();
    const unregister = registerWidgetDefinition(dynamicDefinition);

    expect(listWidgetDefinitions()).not.toBe(previousSnapshot);
    expect(getWidgetDefinition('acme.temperature')).toMatchObject({ renderer: 'metric' });
    expect(
      validateWidgetConfiguration('acme.temperature', { content: '22.5', unit: '°C' }),
    ).toMatchObject({ success: true });

    unregister();
    expect(getWidgetDefinition('acme.temperature')).toBeNull();
    expect(listWidgetDefinitions()).not.toContain(
      expect.objectContaining({ type: 'acme.temperature' }),
    );
  });

  it('rejects duplicate IDs, unsafe renderers, and invalid field schemas', () => {
    const unregisterTemperature = registerWidgetDefinition(dynamicDefinition);
    const unregister = registerWidgetDefinition({ ...dynamicDefinition, type: 'acme.pressure' });
    try {
      expect(() =>
        registerWidgetDefinition({ ...dynamicDefinition, type: 'acme.pressure' }),
      ).toThrow(/already registered/);
      expect(() =>
        registerWidgetDefinition({
          ...dynamicDefinition,
          type: 'acme.unsupported',
          renderer: 'script',
        }),
      ).toThrow(/renderer/);
      expect(() =>
        registerWidgetDefinition({
          ...dynamicDefinition,
          type: 'acme.invalid',
          fields: [{ key: '__proto__', label: 'Invalid', type: 'text', maxLength: 20 }],
        }),
      ).toThrow(/field keys/);
    } finally {
      unregister();
      unregisterTemperature();
    }
  });
});
