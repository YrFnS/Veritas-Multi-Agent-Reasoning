
import { Schema } from "@google/genai";
import { AgentConfig, IReasoningCore } from "../types";

export interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class OpenRouterCore implements IReasoningCore {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generateJSON(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: Schema,
    useTools: boolean = false, // Added for signature parity
    configOverrides: Partial<AgentConfig> = {},
    signal?: AbortSignal
  ): Promise<{ data: any; sources?: any[] }> {
    const MAX_RETRIES = 2;
    let attempt = 0;
    let lastError: any;

    while (attempt <= MAX_RETRIES) {
      if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Veritas Truth Engine",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt + "\n\nCRITICAL: You MUST output valid JSON only." }
            ],
            response_format: { type: "json_object" },
            temperature: configOverrides.temperature ?? 0.1,
          }),
          signal
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `OpenRouter Error: ${response.status}`);
        }

        const result: OpenRouterResponse = await response.json();
        const text = result.choices[0].message.content;

        if (!text) throw new Error("Empty response from OpenRouter");

        return {
          data: this.cleanAndParseJSON(text),
          sources: [] // OpenRouter grounding is more complex
        };

      } catch (error: any) {
        if (error.name === "AbortError" || error.message === "ABORT_SEQUENCE_RECEIVED") throw new Error("ABORT_SEQUENCE_RECEIVED");
        
        lastError = error;
        attempt++;
        if (attempt <= MAX_RETRIES) {
          console.warn(`OpenRouterCore: Execution failed (Attempt ${attempt}/${MAX_RETRIES}). Retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    throw lastError;
  }

  private cleanAndParseJSON(text: string): any {
    try {
      // 1. First attempt: Direct parse (fastest)
      return JSON.parse(text);
    } catch (e) {
      // 2. Second attempt: Remove markdown code blocks
      try {
        const cleanText = text.replace(/```json\n?|```\n?/g, "").trim();
        return JSON.parse(cleanText);
      } catch (e2) {
        // 3. Third attempt: Robust extraction of the first JSON object
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
             return JSON.parse(jsonMatch[0]);
          }
          throw new Error("No JSON object found in response");
        } catch (e3) {
            // 4. Fourth attempt: Healing
           const healed = this.attemptHealJSON(text);
           if (healed) return healed;
           throw new Error(`JSON Parse Error. Raw text: ${text}`);
        }
      }
    }
  }

  private attemptHealJSON(text: string): any {
    let healed = text.trim();
    if (healed.endsWith(',')) healed = healed.slice(0, -1);
    if (healed.endsWith('":')) healed += ' []';

    const stack: string[] = [];
    for (let i = 0; i < healed.length; i++) {
        const char = healed[i];
        if (char === '{') stack.push('}');
        else if (char === '[') stack.push(']');
        else if (char === '}' && stack[stack.length - 1] === '}') stack.pop();
        else if (char === ']' && stack[stack.length - 1] === ']') stack.pop();
    }
    while (stack.length > 0) healed += stack.pop();

    try {
        return JSON.parse(healed);
    } catch (e) {
        return null;
    }
  }
}
