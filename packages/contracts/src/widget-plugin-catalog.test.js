import { describe, expect, it } from 'vitest';
import {
  getWidgetPluginForType,
  validatePluginWidgetConfiguration,
  widgetPluginCatalog,
} from './widget-plugin-catalog.js';

describe('curated widget plugin catalog', () => {
  it('uses unique plugin and widget identifiers', () => {
    expect(new Set(widgetPluginCatalog.map((plugin) => plugin.id)).size).toBe(
      widgetPluginCatalog.length,
    );
    const widgetTypes = widgetPluginCatalog.flatMap((plugin) =>
      plugin.widgets.map((widget) => widget.type),
    );
    expect(new Set(widgetTypes).size).toBe(widgetTypes.length);
  });

  it('resolves widget types to their owning plugin', () => {
    expect(getWidgetPluginForType('voxel.operations.service-health')?.id).toBe(
      'voxel.operations-toolkit',
    );
    expect(getWidgetPluginForType('voxel.unknown.widget')).toBeNull();
  });

  it('ships valid default configurations for all catalog widgets', () => {
    for (const plugin of widgetPluginCatalog) {
      for (const widget of plugin.widgets) {
        expect(validatePluginWidgetConfiguration(widget, widget.defaults)).toBeNull();
      }
    }
  });

  it('rejects values that violate the installed widget schema', () => {
    const plugin = getWidgetPluginForType('voxel.delivery.release-progress');
    const widget = plugin.widgets[0];
    expect(validatePluginWidgetConfiguration(widget, { ...widget.defaults, target: 0 })).toMatch(
      /target/i,
    );
    expect(
      validatePluginWidgetConfiguration(widget, { ...widget.defaults, content: { value: 18 } }),
    ).toMatch(/text/i);
  });
});
