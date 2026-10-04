export interface CompletionRequest {
  messages: { role: 'system' | 'user'; content: string }[];
  response_format: { type: 'json_schema'; json_schema: { name: 'taskflow_action'; strict: true; schema: Record<string, unknown> } };
  chat_template_kwargs: { enable_thinking: false };
  temperature: 0;
  max_tokens: 256;
}

export interface LlamaClient { complete(request: CompletionRequest): Promise<string> }

// The real transport is supplied by the desktop lifecycle. Tests supply fixture JSON.
export function createLlamaClient(transport: (request: CompletionRequest) => Promise<string>): LlamaClient {
  return { complete: transport };
}
