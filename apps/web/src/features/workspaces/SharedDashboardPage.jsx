import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Edit3, Loader2, LockKeyhole, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { workspaceService } from './workspace-service';
import { getWidgetDefinition, registerWidgetDefinition, useWidgetDefinitions } from '@/features/editor/widget-registry';
import { resolveSharedDashboardValues } from './shared-dashboard-values';

const nodeWidth = (size) => ({ small: 220, medium: 280, large: 340, wide: 440 }[size] || 280);
const typeLabel = (type = 'widget') => type.charAt(0).toUpperCase() + type.slice(1);
const accentClasses = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
};
const progressClasses = { emerald: 'bg-emerald-500', rose: 'bg-rose-500', amber: 'bg-amber-500', cyan: 'bg-cyan-500', violet: 'bg-violet-500' };

function displayValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function safeImageUrl(value) {
  if (typeof value === 'string' && /^data:image\/(?:png|jpeg|gif|webp|avif);base64,/i.test(value)) return value;
  if (typeof value === 'string' && value.startsWith('blob:')) return value;
  return safeExternalUrl(value);
}

function SharedNodeEditor({ node, renderer, nodes, onUpdate }) {
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100';
  const textField = (key, label, { multiline = false, maxLength = 4000, placeholder = '' } = {}) => (
    <label key={key} className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
      {multiline ? (
        <textarea value={node[key] ?? ''} maxLength={maxLength} onChange={(event) => onUpdate(node.id, { [key]: event.target.value })} className={`${inputClass} min-h-20 resize-y font-normal normal-case tracking-normal`} placeholder={placeholder} />
      ) : (
        <input value={node[key] ?? ''} maxLength={maxLength} onChange={(event) => onUpdate(node.id, { [key]: event.target.value })} className={`${inputClass} font-normal normal-case tracking-normal`} placeholder={placeholder} />
      )}
    </label>
  );

  const numberField = (key, label, min, max) => (
    <label key={key} className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
      <input type="number" value={node[key] ?? ''} min={min} max={max} onChange={(event) => onUpdate(node.id, { [key]: Number(event.target.value) || min })} className={`${inputClass} font-normal normal-case tracking-normal`} />
    </label>
  );

  const selectField = (key, label, options) => (
    <label key={key} className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
      <select value={node[key] ?? ''} onChange={(event) => onUpdate(node.id, { [key]: event.target.value })} className={inputClass}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );

  if (renderer === 'table') {
    return <div className="space-y-3">{textField('columns', 'Columns', { maxLength: 1000, placeholder: 'Name,Owner,Status' })}{textField('rows', 'Rows', { multiline: true, maxLength: 24000, placeholder: 'One comma-separated row per line' })}</div>;
  }
  if (renderer === 'metric') {
    return <div className="space-y-3">{textField('content', 'Value', { maxLength: 2000 })}{textField('unit', 'Unit', { maxLength: 24, placeholder: '$, %, /s' })}</div>;
  }
  if (renderer === 'display') {
    return <div className="space-y-3">{textField('content', 'Value', { maxLength: 2000 })}{textField('description', 'Supporting text', { maxLength: 280 })}</div>;
  }
  if (renderer === 'progress') {
    return <div className="space-y-3">{textField('content', 'Current value', { maxLength: 80 })}{numberField('target', 'Target', 1, 1_000_000_000)}</div>;
  }
  if (renderer === 'status') {
    return <div className="space-y-3">{textField('content', 'Status message', { maxLength: 280 })}{selectField('statusColor', 'State', [{ value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'error', label: 'Error' }])}</div>;
  }
  if (renderer === 'note' || renderer === 'chart') {
    return <div className="space-y-3">{textField('content', renderer === 'chart' ? 'Comma-separated values' : 'Note', { multiline: true, maxLength: renderer === 'chart' ? 12000 : 20000 })}</div>;
  }
  if (renderer === 'link') {
    return <div className="space-y-3">{textField('url', 'Link URL', { maxLength: 2048, placeholder: 'https://…' })}{textField('description', 'Description', { maxLength: 280 })}</div>;
  }
  if (renderer === 'image') return <div className="space-y-3">{textField('imageUrl', 'Image URL', { maxLength: 2048, placeholder: 'https://…' })}</div>;
  if (renderer === 'embed') return <div className="space-y-3">{textField('embedUrl', 'Embed URL', { maxLength: 2048, placeholder: 'https://…' })}</div>;
  if (renderer === 'code') return <div className="space-y-3">{textField('code', 'Code', { multiline: true, maxLength: 20000 })}{textField('language', 'Language', { maxLength: 40 })}</div>;
  if (renderer === 'timer') {
    return <div className="space-y-3">{numberField('duration', 'Duration (seconds)', 1, 86400)}{selectField('timerMode', 'Timer mode', [{ value: 'countdown', label: 'Countdown' }, { value: 'stopwatch', label: 'Stopwatch' }])}</div>;
  }
  if (renderer === 'divider') {
    return <div className="space-y-3">{selectField('dividerStyle', 'Line style', ['solid', 'dashed', 'dotted', 'double'].map((value) => ({ value, label: value })))}</div>;
  }
  if (renderer === 'logic') {
    const availableNodes = nodes.filter((candidate) => candidate.id !== node.id && getWidgetDefinition(candidate.type)?.renderer !== 'note');
    const nodeOptions = [{ value: '', label: 'Choose a widget' }, ...availableNodes.map((candidate) => ({ value: candidate.id, label: `${candidate.title || candidate.type} · ${candidate.type}` }))];
    return <div className="space-y-3">{selectField('logicA', 'Input source A', nodeOptions)}{selectField('logicOp', 'Operator', [{ value: '+', label: 'Add (+)' }, { value: '-', label: 'Subtract (−)' }, { value: '*', label: 'Multiply (×)' }, { value: '/', label: 'Divide (÷)' }])}{selectField('logicB', 'Input source B', nodeOptions)}</div>;
  }
  return <div className="space-y-3">{textField('content', 'Widget content', { multiline: true, maxLength: 20000 })}</div>;
}

function SharedNode({ node, nodes, editing, onUpdate, resolvedValue }) {
  const definition = getWidgetDefinition(node.type);
  const renderer = definition?.renderer || node.type;
  const widgetLabel = definition?.title || typeLabel(node.type);
  const externalSourceUnavailable = node.valueSource === 'workspace-file' || node.valueSource === 'rest-api';
  const linkedValueUnavailable = (node.valueSource === 'connections' || renderer === 'logic') && resolvedValue == null;
  const content = displayValue(externalSourceUnavailable ? '' : resolvedValue ?? node.content);
  const numericProgress = Number.parseFloat(content);
  const isProgress = renderer === 'progress' && Number.isFinite(numericProgress);
  const progressTarget = Number.isFinite(Number(node.target)) && Number(node.target) > 0 ? Number(node.target) : 100;
  const progressPercent = isProgress ? Math.max(0, Math.min(100, (numericProgress / progressTarget) * 100)) : 0;
  const timerDuration = Number.isFinite(Number(node.duration)) && Number(node.duration) > 0 ? Math.floor(Number(node.duration)) : 300;
  const timerHours = Math.floor(timerDuration / 3600);
  const timerMinutes = Math.floor((timerDuration % 3600) / 60);
  const timerSeconds = timerDuration % 60;
  const timerDisplay = `${timerHours ? `${String(timerHours).padStart(2, '0')}:` : ''}${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}`;
  const accent = ['emerald', 'rose', 'amber', 'cyan'].includes(node.color) ? node.color : 'violet';
  const chartValues = content.split(',').map((value) => Number.parseFloat(value.trim())).filter(Number.isFinite);
  const chartMin = Math.min(...chartValues, 0);
  const chartMax = Math.max(...chartValues, 1);
  const chartRange = chartMax - chartMin || 1;
  const chartPoints = chartValues.map((value, index) => `${(index / Math.max(1, chartValues.length - 1)) * 240},${64 - ((value - chartMin) / chartRange) * 64}`).join(' ');
  const columns = (node.columns || '').split(',').map((value) => value.trim()).filter(Boolean);
  const rows = (node.rows || '').split('\n').filter(Boolean).map((row) => row.split(',').map((value) => value.trim()));
  let body;

  if (externalSourceUnavailable && editing) {
    const sourceNotice = node.valueSource === 'workspace-file'
      ? 'This share link does not include workspace file contents.'
      : 'This share link does not query or expose external REST responses.';
    body = <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-500/5"><p className="text-xs leading-5 text-amber-900 dark:text-amber-100">{sourceNotice} Switch to a manual value to show content here.</p><button type="button" onClick={() => onUpdate(node.id, { valueSource: 'manual', dataSourceFileId: '', dataSourceUrl: '', dataSourceField: '' })} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-slate-900 dark:text-amber-100">Switch to a manual value</button></div>;
  } else if (externalSourceUnavailable) {
    const sourceNotice = node.valueSource === 'workspace-file'
      ? 'This widget uses a private workspace file. Its contents are not included in this share.'
      : 'This widget uses an external REST source. Its response is not included in this share.';
    body = <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/5 dark:text-amber-100">{sourceNotice}</div>;
  } else if (linkedValueUnavailable && editing) {
    body = <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-500/5"><p className="text-xs leading-5 text-amber-900 dark:text-amber-100">A connected value depends on data that is not available through this share.</p>{node.valueSource === 'connections' && <button type="button" onClick={() => onUpdate(node.id, { valueSource: 'manual' })} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-slate-900 dark:text-amber-100">Switch to a manual value</button>}{renderer === 'logic' && <SharedNodeEditor node={node} nodes={nodes} renderer={renderer} onUpdate={onUpdate} />}</div>;
  } else if (linkedValueUnavailable) {
    body = <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/5 dark:text-amber-100">A connected value depends on data that is not available through this share.</div>;
  } else if (editing && node.valueSource === 'connections') {
    body = <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-400/20 dark:bg-violet-500/5"><p className="text-xs leading-5 text-violet-900 dark:text-violet-100">Calculated from connected widgets · current value: <b>{content}</b></p><button type="button" onClick={() => onUpdate(node.id, { valueSource: 'manual' })} className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 dark:border-violet-400/20 dark:bg-slate-900 dark:text-violet-100">Switch to a manual value</button></div>;
  } else if (editing) {
    body = <SharedNodeEditor node={node} nodes={nodes} renderer={renderer} onUpdate={onUpdate} />;
  } else if (renderer === 'divider') {
    body = <div className="mt-5 border-t border-slate-200 dark:border-white/10" style={{ borderTopStyle: ['solid', 'dashed', 'dotted', 'double'].includes(node.dividerStyle) ? node.dividerStyle : 'solid' }} />;
  } else if (isProgress) {
    body = <div><div className="mb-2 flex items-baseline gap-1 font-mono"><span className="text-3xl font-black">{numericProgress}</span><span className="text-xs text-slate-500">/ {progressTarget}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full transition-all ${progressClasses[accent]}`} style={{ width: `${progressPercent}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">{progressPercent.toFixed(1)}% complete</p></div>;
  } else if (renderer === 'metric') {
    body = <div className="text-3xl font-black tracking-tight">{node.unit}{content}</div>;
  } else if (renderer === 'display') {
    body = <div><div className="text-3xl font-black tracking-tight">{content}</div><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{node.description || 'KPI summary'}</p></div>;
  } else if (renderer === 'status') {
    const statusColor = node.statusColor === 'success' ? 'bg-emerald-500' : node.statusColor === 'warning' ? 'bg-amber-500' : 'bg-rose-500';
    body = <div className="flex items-center gap-2 text-sm font-bold"><span className={`size-2.5 rounded-full ${statusColor}`} />{content || 'Status'}</div>;
  } else if (renderer === 'timer') {
    body = <div><p className="font-mono text-3xl font-black tracking-tight">{timerDisplay}</p><p className="mt-1 text-[10px] text-slate-500">{node.timerMode === 'stopwatch' ? 'Stopwatch' : 'Countdown'} · Timer controls are available in the workspace editor.</p></div>;
  } else if (renderer === 'chart') {
    body = chartValues.length > 1 ? <svg viewBox="0 0 240 70" className="h-16 w-full"><polyline points={chartPoints} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : <p className="text-sm text-slate-500">{content || 'No chart values'}</p>;
  } else if (renderer === 'image') {
    body = safeImageUrl(node.imageUrl) ? <img src={safeImageUrl(node.imageUrl)} alt={node.title || 'Dashboard image'} referrerPolicy="no-referrer" className="h-36 w-full rounded-lg object-cover" /> : <p className="text-xs text-slate-500">Image unavailable</p>;
  } else if (renderer === 'embed') {
    body = safeExternalUrl(node.embedUrl) ? <iframe src={safeExternalUrl(node.embedUrl)} title={node.title || 'Embedded content'} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" className="h-36 w-full rounded-lg border-0" /> : <p className="text-xs text-slate-500">Embedded content unavailable</p>;
  } else if (renderer === 'link') {
    const href = safeExternalUrl(node.url);
    body = href ? <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-slate-200 p-3 text-sm font-semibold text-violet-600 dark:border-white/10">{node.url}<p className="mt-1 text-xs font-normal text-slate-500">{node.description}</p></a> : <p className="text-sm text-slate-500">{content}</p>;
  } else if (renderer === 'code') {
    body = <pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"><code>{node.code || content}</code></pre>;
  } else if (renderer === 'table') {
    body = <div className="overflow-auto rounded-lg border border-slate-200 dark:border-white/10"><table className="w-full text-left text-xs"><thead><tr>{columns.map((column, index) => <th key={`${column}-${index}`} className="border-b border-slate-200 px-2 py-2 dark:border-white/10">{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={`${rowIndex}-${columnIndex}`} className="border-b border-slate-100 px-2 py-1.5 dark:border-white/5">{value}</td>)}</tr>)}</tbody></table></div>;
  } else {
    body = <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{content}</div>;
  }

  return (
    <article className="absolute overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-4 text-slate-900 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-100" style={{ left: Math.max(24, Number(node.x) || 0), top: Math.max(24, Number(node.y) || 0), width: nodeWidth(node.size), minHeight: renderer === 'divider' ? 72 : 150 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        {editing ? (
          <input value={node.title || ''} onChange={(event) => onUpdate(node.id, { title: event.target.value })} className="min-w-0 flex-1 border-b border-violet-300 bg-transparent pb-1 text-sm font-bold outline-none focus:border-violet-600" aria-label="Widget title" />
        ) : <h2 className="truncate text-sm font-bold">{node.title || widgetLabel}</h2>}
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${accentClasses[accent]}`}>{widgetLabel}</span>
      </div>
      {body}
    </article>
  );
}

export default function SharedDashboardPage() {
  useWidgetDefinitions();
  const { token } = useParams();
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ['shared-dashboard', token], queryFn: () => workspaceService.sharedDashboard(token), retry: false });
  const [scene, setScene] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unregister = [];
    for (const plugin of dashboard.data?.plugins || []) {
      for (const widget of plugin.widgets || []) {
        if (getWidgetDefinition(widget.type)) continue;
        try {
          unregister.push(registerWidgetDefinition(widget));
        } catch (error) {
          console.error('A shared widget definition could not be loaded.', error);
        }
      }
    }
    return () => unregister.reverse().forEach((remove) => remove());
  }, [dashboard.data?.plugins]);

  useEffect(() => {
    if (dashboard.data) setScene(structuredClone(dashboard.data.scene || { schemaVersion: 2, nodes: [] }));
  }, [dashboard.data]);

  const save = useMutation({
    mutationFn: (nextScene) => workspaceService.updateSharedDashboard(token, { scene: nextScene, version: dashboard.data.version }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['shared-dashboard', token], (previous) => ({ ...previous, ...updated, permission: previous.permission }));
      await queryClient.invalidateQueries({ queryKey: ['shared-dashboard', token] });
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    },
  });

  const updateNode = (nodeId, patch) => setScene((previous) => ({
    ...previous,
    nodes: previous.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node),
  }));

  const visibleNodes = useMemo(() => (scene?.nodes || []).filter((node) => !node.hidden), [scene?.nodes]);
  const boardDimensions = useMemo(() => {
    const nodes = visibleNodes;
    return {
      width: Math.max(window.innerWidth, ...nodes.map((node) => (Number(node.x) || 0) + nodeWidth(node.size) + 48)),
      height: Math.max(window.innerHeight - 88, ...nodes.map((node) => (Number(node.y) || 0) + 240)),
    };
  }, [visibleNodes]);
  const sharedValues = useMemo(
    () => resolveSharedDashboardValues(scene?.nodes || [], scene?.connections || [], (node) => getWidgetDefinition(node.type)?.renderer || node.type),
    [scene],
  );

  if (dashboard.isPending) return <main className="grid min-h-screen place-items-center bg-slate-50 dark:bg-[#070a13]"><Loader2 className="animate-spin text-violet-500" /></main>;
  if (dashboard.isError) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-[#070a13]"><section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900"><LockKeyhole className="mx-auto text-slate-400"/><h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">This share link is unavailable</h1><p className="mt-2 text-sm text-slate-500">It may have expired, been revoked, or the dashboard may have been archived.</p><Link to="/" className="mt-6 inline-block text-sm font-bold text-violet-600">Go to Voxel</Link></section></main>;

  const canEdit = dashboard.data.permission === 'EDIT';
  return (
    <main className="min-h-screen overflow-auto bg-slate-50 text-slate-900 dark:bg-[#070a13] dark:text-slate-100">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 font-black text-white">V</div><div className="min-w-0"><div className="truncate text-sm font-extrabold">{dashboard.data.name}</div><div className="text-[10px] text-slate-500">Shared with you · {canEdit ? 'Can edit' : 'View only'}</div></div></div>
        {canEdit && <div className="flex items-center gap-2">{editing ? <><button type="button" onClick={() => { setEditing(false); setScene(structuredClone(dashboard.data.scene)); }} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500">Cancel</button><button type="button" disabled={save.isPending} onClick={() => save.mutate(scene)} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{save.isPending ? 'Saving…' : 'Save changes'}</button></> : <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold dark:border-white/10"><Edit3 size={14}/> Edit dashboard</button>}</div>}
      </header>
      {save.isError && <div role="alert" className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 sm:mx-8">{save.error.message} Reload the page before making further changes.</div>}
      {saved && <div role="status" className="fixed right-5 top-20 z-30 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-lg"><Check size={14}/> Changes saved</div>}
      <section className="min-h-[calc(100vh-4rem)] overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(139,92,246,.17)_1px,transparent_0)] [background-size:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(139,92,246,.18)_1px,transparent_0)]" style={{ backgroundColor: 'rgba(248,250,252,.82)' }}>
        {visibleNodes.length > 0 ? <div className="relative" style={{ width: boardDimensions.width, height: boardDimensions.height }}>{visibleNodes.map((node) => <SharedNode key={node.id} node={node} nodes={scene.nodes} editing={editing} onUpdate={updateNode} resolvedValue={sharedValues.get(node.id)} />)}</div> : <div className="grid min-h-[calc(100vh-4rem)] place-items-center"><div className="text-center"><h1 className="text-lg font-bold">{scene?.nodes?.length ? 'This canvas has no visible widgets' : 'This canvas is empty'}</h1><p className="mt-1 text-sm text-slate-500">{scene?.nodes?.length ? 'The owner has hidden all of its widgets.' : 'The owner has not added any widgets yet.'}</p></div></div>}
      </section>
      <footer className="border-t border-slate-200 bg-white px-5 py-4 text-center text-[10px] text-slate-500 dark:border-white/10 dark:bg-slate-950">Shared securely with Voxel · <Link to="/" className="font-bold text-violet-600">Create your own workspace</Link></footer>
    </main>
  );
}
