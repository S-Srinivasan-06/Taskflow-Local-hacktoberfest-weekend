import { fetch as nativeFetch } from '@tauri-apps/plugin-http';

export async function localFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const address = new URL(url);
  if (!['http://127.0.0.1:39281', 'http://127.0.0.1:11434'].includes(address.origin)) {
    throw new Error('Only local model connections are allowed.');
  }
  // The existing browser fixture mocks HTTP; it is excluded from production.
  if (import.meta.env.DEV && location.pathname === '/tests/browser/desktop.html') return fetch(url, options);
  return nativeFetch(url, { ...options, maxRedirections: 0 });
}
