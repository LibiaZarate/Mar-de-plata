// Cliente único para llamadas a modelos vía OpenRouter.
// Si OPENROUTER_API_KEY no está definida, las funciones del Verificador
// y Agente Madre entran en "modo demo" — ver isDemoMode().

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function isDemoMode(): boolean {
  return !process.env.OPENROUTER_API_KEY;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatCompletion = {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
};

type CallOpts = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  tools?: Tool[];
};

export async function chat(opts: CallOpts): Promise<ChatCompletion> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY no está definida.");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
  }

  const r = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://mardeplata.local",
      "X-Title": "Mar de Plata · Sirena",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`OpenRouter ${r.status}: ${text.slice(0, 400)}`);
  }
  return (await r.json()) as ChatCompletion;
}

// Modelos oficiales del brief
export const MODELS = {
  verificador: "anthropic/claude-haiku-4.5",
  agente: "anthropic/claude-opus-4.6-fast",
} as const;
