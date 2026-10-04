import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@tauri-apps/api/core';
import { queryTasks } from '../db/taskRepository.ts';
import { createLlamaClient } from './llamaClient.ts';
import type { CompletionRequest } from './llamaClient.ts';
import { createModelService } from './modelService.ts';
import type { Interpretation, InterpretOptions } from './modelService.ts';
import { MODEL_FILENAME, MODEL_PORT, MODEL_PROJECTOR_FILENAME } from './modelConfig.ts';
import { readPreference, writePreference } from '../state/preferences.ts';
import { localFetch } from './localHttp.ts';
import { llamaPayload, ollamaPayload } from './requestPayload.ts';

export interface ModelSelection { provider: 'gguf' | 'ollama'; model: string; projector: string | null }
const defaultSelection: ModelSelection = { provider: 'gguf', model: MODEL_FILENAME, projector: MODEL_PROJECTOR_FILENAME };
function savedSelection(): ModelSelection {
  try {
    const saved = JSON.parse(readPreference('model') ?? 'null');
    if ((saved?.provider === 'gguf' || saved?.provider === 'ollama') && typeof saved.model === 'string'
      && saved.model.length < 200 && /^[A-Za-z0-9._:/-]+$/.test(saved.model)
      && (saved.projector === null || typeof saved.projector === 'string')) return saved;
  } catch { /* Invalid preferences fall back to the tested model. */ }
  return { ...defaultSelection };
}
let selection = savedSelection();
let changingModel = false;
let loadedProjector: string | null = null;
const OLLAMA_URL = 'http://127.0.0.1:11434/api';

export type ModelStatus = 'missing' | 'stopped' | 'starting' | 'ready' | 'error';
let status: ModelStatus = 'stopped';
let failureMessage = '';
let vision = false;
let statusVersion = 0;
const listeners = new Set<() => void>();
const apiKey = crypto.randomUUID().replaceAll('-', '');

function setStatus(next: ModelStatus, message = '') {
  statusVersion++;
  status = next;
  failureMessage = message;
  listeners.forEach(listener => listener());
}

export function getModelStatus() { return { status, failureMessage, vision }; }
export function getModelSelection() { return { ...selection }; }
export function subscribeModelStatus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function refreshModelAvailability() {
  if (!isTauri() || modelService.busy) return;
  const checkedSelection = selection;
  const checkedVersion = statusVersion;
  const current = () => checkedSelection === selection && checkedVersion === statusVersion;
  try {
    if (checkedSelection.provider === 'ollama') {
      const model = await ollamaDetails(checkedSelection.model);
      if (!current()) return;
      vision = model.capabilities?.includes('vision') === true;
      setStatus('stopped');
      return;
    }
    const [installed, running] = await Promise.all([
      invoke<boolean>('model_exists', { filename: checkedSelection.model }),
      invoke<boolean>('model_running'),
    ]);
    const imageAvailable = checkedSelection.projector !== null && await invoke<boolean>('model_exists', { filename: checkedSelection.projector });
    if (!current()) return;
    vision = installed && imageAvailable;
    setStatus(!installed ? 'missing' : running ? 'ready' : 'stopped');
  } catch {
    if (!current()) return;
    vision = false;
    setStatus('error', checkedSelection.provider === 'ollama' ? 'Start Ollama and select a downloaded local model in Settings.' : 'Could not check the local model.');
  }
}

async function waitUntilReady() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (!await invoke<boolean>('model_running')) throw new Error('The local model stopped while starting.');
    try {
      const health = await localFetch(`http://127.0.0.1:${MODEL_PORT}/health`, {
        headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(2000),
      });
      if (health.ok) return;
    } catch { /* The server may still be loading its local model. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The local model did not become ready in time.');
}

async function startRuntime(image: boolean) {
  setStatus('starting');
  try {
    if (image && !selection.projector) throw new Error('Select an image projector in Settings.');
    // Claim an existing process before checking it, so idle cleanup cannot stop it between checks.
    await invoke('model_set_busy', { busy: true });
    if (image && loadedProjector !== selection.projector && await invoke<boolean>('model_running')) await invoke('stop_model');
    if (!await invoke<boolean>('model_running')) {
      const projector = image ? selection.projector : null;
      await invoke('start_local_model', { filename: selection.model, projector, apiKey, port: MODEL_PORT });
      loadedProjector = projector;
    }
    await waitUntilReady();
    setStatus('ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const installed = await invoke<boolean>('model_exists', { filename: selection.model }).catch(() => true);
    setStatus(installed ? 'error' : 'missing', installed ? message : 'Local model not found');
    throw new Error(message);
  }
}

async function complete(request: CompletionRequest): Promise<string> {
  const image = request.messages.some(message => Boolean(message.image));
  if (selection.provider === 'ollama') return completeOllama(request, image);
  const body = llamaPayload(request);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await startRuntime(image);
      const response = await localFetch(`http://127.0.0.1:${MODEL_PORT}/v1/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`Local model returned HTTP ${response.status}`);
      const result = await response.json();
      const message = result?.choices?.[0]?.message;
      if (!message || typeof message.content !== 'string' || message.reasoning != null || message.reasoning_content != null) {
        throw new Error('Local model returned an invalid response.');
      }
      if (!await invoke<boolean>('model_running')) {
        if (attempt === 0) { setStatus('stopped'); continue; }
        throw new Error('The local model stopped during the request.');
      }
      setStatus('ready');
      return message.content;
    } catch (error) {
      const running = await invoke<boolean>('model_running').catch(() => false);
      if (running || attempt > 0) {
        const message = error instanceof Error ? error.message : 'The request could not be completed.';
        setStatus(running ? 'error' : 'stopped', message);
        throw error;
      }
      setStatus('stopped');
    } finally {
      await invoke('model_set_busy', { busy: false }).catch(() => undefined);
    }
  }
  throw new Error('The local model could not complete the request.');
}

const modelService = createModelService({ client: createLlamaClient(complete), queryTasks });

export function interpretUserRequest(text: string, options: InterpretOptions): Promise<Interpretation> {
  if (changingModel) return Promise.resolve({ kind: 'error', message: 'Wait for the model change to finish.' });
  return modelService.interpretUserRequest(text, options);
}

export async function unloadModel() {
  if (modelService.busy || changingModel) throw new Error('Wait for the current request to finish.');
  changingModel = true;
  try {
    if (selection.provider === 'ollama') {
      const response = await localFetch(`${OLLAMA_URL}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selection.model, keep_alive: 0 }), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error('Could not unload the selected Ollama model.');
    }
    await invoke('stop_model');
    loadedProjector = null;
    setStatus('stopped');
  } finally { changingModel = false; }
}

export async function openModelsFolder() {
  await invoke('open_models_folder');
}

async function ollamaDetails(model: string): Promise<{ capabilities?: string[] }> {
  if (/(^|:)cloud($|[-:])/.test(model)) throw new Error('Select a downloaded local model.');
  const response = await localFetch(`${OLLAMA_URL}/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('The selected Ollama model is unavailable.');
  const result = await response.json();
  if (result.remote_host || result.remote_model) throw new Error('Cloud models are not supported.');
  return result;
}

async function completeOllama(request: CompletionRequest, image: boolean): Promise<string> {
  try {
    const details = await ollamaDetails(selection.model);
    if (image && !details.capabilities?.includes('vision')) throw new Error('Select an image-capable model in Settings.');
    setStatus('starting');
    const body = ollamaPayload(request, selection.model);
    body.keep_alive = import.meta.env.DEV ? '60s' : '30m';
    const response = await localFetch(`${OLLAMA_URL}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}. Try another downloaded model.`);
    const result = await response.json();
    if (typeof result.message?.content !== 'string' || result.message?.thinking) throw new Error('The model did not return a task action.');
    setStatus('ready');
    return result.message.content;
  } catch (error) {
    setStatus('error', error instanceof Error ? error.message : 'Could not connect to Ollama.');
    throw error;
  }
}

export async function listAvailableModels(): Promise<{ files: string[]; ollama: string[]; ollamaError: string }> {
  const files = await invoke<string[]>('list_models');
  try {
    const response = await localFetch(`${OLLAMA_URL}/tags`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error('Ollama did not list its models.');
    const result = await response.json();
    const ollama = (result.models ?? []).filter((model: { name: string; remote_host?: string; remote_model?: string }) =>
      typeof model.name === 'string' && !/(^|:)cloud($|[-:])/.test(model.name) && !model.remote_host && !model.remote_model)
      .map((model: { name: string }) => model.name).sort();
    return { files, ollama, ollamaError: '' };
  } catch { return { files, ollama: [], ollamaError: 'Ollama is not running or has no accessible local models.' }; }
}

export async function selectModel(next: ModelSelection) {
  if (modelService.busy || changingModel) throw new Error('Wait for the current request to finish.');
  changingModel = true;
  try {
    if (next.provider === 'ollama') await ollamaDetails(next.model);
    else if (!await invoke<boolean>('model_exists', { filename: next.model })) throw new Error('Model file not found in Models folder.');
    await invoke('stop_model');
    loadedProjector = null;
    selection = { ...next };
    writePreference('model', JSON.stringify(selection));
    await refreshModelAvailability();
  } finally { changingModel = false; }
}
