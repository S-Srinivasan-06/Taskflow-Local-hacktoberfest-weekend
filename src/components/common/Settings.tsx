import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getModelSelection, listAvailableModels, openModelsFolder, refreshModelAvailability, selectModel, subscribeModelStatus } from '../../model/desktopModel.ts';
import type { ModelSelection } from '../../model/desktopModel.ts';
import { THEMES, THEME_NAMES } from '../../state/preferences.ts';
import type { Theme } from '../../state/preferences.ts';

interface Props { theme: Theme; onTheme(theme: Theme): void; onClose(): void }

export function Settings({ theme, onTheme, onClose }: Props) {
  const [selected, setSelected] = useState(getModelSelection);
  const [catalog, setCatalog] = useState<{ files: string[]; ollama: string[]; ollamaError: string }>({ files: [], ollama: [], ollamaError: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationNotice, setNotificationNotice] = useState('');

  async function testNotification() {
    if (notificationBusy) return;
    setNotificationBusy(true);
    setNotificationNotice('');
    try {
      await invoke('test_notification');
      setNotificationNotice('Test sent. Check Windows notifications. If no banner appears, check Taskflow in Windows notification settings and Do Not Disturb.');
    } catch {
      setNotificationNotice('Could not send the test. Use the installed app and check Windows notification settings.');
    } finally { setNotificationBusy(false); }
  }

  async function refresh() {
    setBusy(true); setError('');
    try {
      setCatalog(await listAvailableModels());
      await refreshModelAvailability();
      setSelected(getModelSelection());
    }
    catch { setError('Could not list the Models folder.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  useEffect(() => subscribeModelStatus(() => setSelected(getModelSelection())), []);

  async function change(next: ModelSelection) {
    setBusy(true); setError('');
    try { await selectModel(next); setSelected(getModelSelection()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change the model.'); }
    finally { setBusy(false); }
  }

  const models = catalog.files.filter(file => !/mmproj|projector/i.test(file));
  const value = `${selected.provider}|${selected.model}`;
  const values = [...models.map(model => `gguf|${model}`), ...catalog.ollama.map(model => `ollama|${model}`)];
  return <section className="settings surface" aria-label="Settings">
    <div className="settings-heading"><h2>Settings</h2><button type="button" onClick={onClose}>Close</button></div>
    <fieldset className="theme-picker">
      <legend>Colour scheme</legend>
      <div className="theme-grid">{THEMES.map(name => <label className="theme-option" key={name}
        data-theme={name} data-selected={theme === name}>
        <input className="sr-only" type="radio" name="theme" value={name} checked={theme === name}
          onChange={() => onTheme(name)} />
        <span className="theme-swatches" aria-hidden="true"><span /><span /><span /></span>
        <span className="theme-name">{THEME_NAMES[name]}<span aria-hidden="true">{theme === name ? '✓' : ''}</span></span>
      </label>)}</div>
    </fieldset>
    <details className="settings-group">
    <summary>Local model</summary>
    <label htmlFor="local-model">Model</label>
    <select id="local-model" disabled={busy} value={value} onChange={event => {
      const [provider, ...parts] = event.target.value.split('|');
      void change({ provider: provider as ModelSelection['provider'], model: parts.join('|'), projector: null });
    }}>
      {!values.includes(value) ? <option value={value}>{selected.model} (not listed)</option> : null}
      <optgroup label="GGUF files in Models folder">{models.map(model => <option value={`gguf|${model}`} key={model}>{model}</option>)}</optgroup>
      <optgroup label="Downloaded Ollama models">{catalog.ollama.map(model => <option value={`ollama|${model}`} key={model}>{model}</option>)}</optgroup>
    </select>
    {selected.provider === 'gguf' ? <>
      <label htmlFor="image-projector">Image projector</label>
      <select id="image-projector" disabled={busy} value={selected.projector ?? ''}
        onChange={event => { void change({ ...selected, projector: event.target.value || null }); }}>
        <option value="">Text only</option>
        {selected.projector && !catalog.files.includes(selected.projector) ? <option value={selected.projector}>{selected.projector} (not found)</option> : null}
        {catalog.files.filter(file => file !== selected.model).map(file => <option key={file} value={file}>{file}</option>)}
      </select>
      <p className="muted settings-help">For images, choose the projector matching your GGUF model.</p>
    </> : catalog.ollamaError ? <p className="muted settings-help">{catalog.ollamaError}</p> : null}
    <div className="settings-actions"><button type="button" disabled={busy} onClick={() => { void refresh(); }}>{busy ? 'Checking…' : 'Refresh models'}</button>
      <button type="button" onClick={() => { void openModelsFolder().catch(() => setError('Could not open Models folder.')); }}>Open Models Folder</button></div>
    </details>
    {isTauri() ? <div className="settings-group notification-controls">
      <button type="button" disabled={notificationBusy} onClick={() => { void testNotification(); }}>
        {notificationBusy ? 'Sending…' : 'Test notification'}
      </button>
      {notificationNotice ? <p className="settings-help" role="status">{notificationNotice}</p> : null}
    </div> : null}
    {error ? <p className="error-text" role="alert">{error}</p> : null}
  </section>;
}
