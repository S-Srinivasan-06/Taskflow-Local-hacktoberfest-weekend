import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@tauri-apps/api/core';
import { queryTasks } from '../db/taskRepository.ts';
import { createLlamaClient } from './llamaClient.ts';
import type { CompletionRequest } from './llamaClient.ts';
import { createModelService } from './modelService.ts';
import type { Interpretation, InterpretOptions } from './modelService.ts';
import { MODEL_FILENAME, MODEL_PORT } from './modelConfig.ts';

export type ModelStatus = 'missing' | 'stopped' | 'starting' | 'ready' | 'error';
let status: ModelStatus = 'stopped';
let failureMessage = '';
const listeners = new Set<() => void>();
const apiKey = crypto.randomUUID().replaceAll('-', '');

function setStatus(next: ModelStatus, message = '') {
  status = next;
  failureMessage = message;
  listeners.forEach(listener => listener());
}

export function getModelStatus() { return { status, failureMessage }; }
export function subscribeModelStatus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function refreshModelAvailability() {
  if (!isTauri()) return;
  try {
    const [installed, running] = await Promise.all([
      invoke<boolean>('model_exists', { filename: MODEL_FILENAME }),
      invoke<boolean>('model_running'),
    ]);
    setStatus(!installed ? 'missing' : running ? 'ready' : 'stopped');
  } catch {
    setStatus('error', 'Could not check the local model.');
  }
}

async function waitUntilReady() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (!await invoke<boolean>('model_running')) throw new Error('The local model stopped while starting.');
    try {
      const health = await fetch(`http://127.0.0.1:${MODEL_PORT}/health`, {
        headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(2000),
      });
      if (health.ok) return;
    } catch { /* The server may still be loading its local model. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The local model did not become ready in time.');
}

async function startRuntime() {
  setStatus('starting');
  try {
    if (!await invoke<boolean>('model_running')) {
      await invoke('start_local_model', { filename: MODEL_FILENAME, apiKey, port: MODEL_PORT });
    } else {
      await invoke('model_set_busy', { busy: true });
    }
    await waitUntilReady();
    setStatus('ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const installed = await invoke<boolean>('model_exists', { filename: MODEL_FILENAME }).catch(() => true);
    setStatus(installed ? 'error' : 'missing', installed ? 'Could not start the local model.' : 'Local model not found');
    throw new Error(message);
  }
}

async function complete(request: CompletionRequest): Promise<string> {
  const body = {
    model: 'taskflow-local', messages: request.messages,
    response_format: request.response_format,
    chat_template_kwargs: request.chat_template_kwargs,
    temperature: request.temperature, max_tokens: request.max_tokens, stream: false,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await startRuntime();
      const response = await fetch(`http://127.0.0.1:${MODEL_PORT}/v1/chat/completions`, {
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
        setStatus(running ? 'error' : 'stopped', 'The request could not be completed.');
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
  return modelService.interpretUserRequest(text, options);
}

export async function unloadModel() {
  await invoke('stop_model');
  setStatus('stopped');
}

export async function openModelsFolder() {
  await invoke('open_models_folder');
}
