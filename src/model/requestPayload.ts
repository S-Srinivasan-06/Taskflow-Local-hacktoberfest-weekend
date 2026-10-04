import type { CompletionRequest } from './llamaClient.ts';

export function llamaPayload(request: CompletionRequest) {
  return {
    model: 'taskflow-local', messages: request.messages.map(message => ({ role: message.role,
      content: message.image ? [{ type: 'text', text: message.content }, { type: 'image_url', image_url: { url: message.image } }] : message.content })),
    response_format: request.response_format, chat_template_kwargs: request.chat_template_kwargs,
    temperature: request.temperature, max_tokens: request.max_tokens, stream: false,
  };
}

export function ollamaPayload(request: CompletionRequest, model: string) {
  return {
    model, messages: request.messages.map(message => ({ role: message.role, content: message.content,
      ...(message.image ? { images: [message.image.substring(message.image.indexOf(',') + 1)] } : {}) })),
    format: request.response_format.json_schema.schema, think: false, stream: false,
    options: { temperature: request.temperature, num_predict: request.max_tokens, num_ctx: 4096 },
    keep_alive: '30m',
  };
}
