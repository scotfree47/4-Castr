// src/lib/ai/github-models.ts
/**
 * GitHub Models API Client
 * Unified interface for all AI model interactions
 */

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ModelConfig {
  model: string
  temperature?: number
  max_tokens?: number
  top_p?: number
}

interface ChatCompletionResponse {
  id: string
  choices: Array<{
    message: ChatMessage
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
  }
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

class GitHubModelsClient {
  private token: string
  private endpoint: string

  constructor() {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      throw new Error("GITHUB_TOKEN not configured")
    }
    this.token = token
    this.endpoint = process.env.GITHUB_MODELS_ENDPOINT || "https://models.inference.ai.azure.com"
  }

  /**
   * Chat completion request
   */
  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.max_tokens ?? 4000,
        top_p: config.top_p ?? 1.0,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub Models API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  /**
   * Generate embeddings
   */
  async embeddings(input: string | string[], model: string): Promise<EmbeddingResponse> {
    const response = await fetch(`${this.endpoint}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model,
        input,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub Models API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  /**
   * Streaming chat (for real-time responses)
   */
  async *chatStream(messages: ChatMessage[], config: ModelConfig): AsyncGenerator<string> {
    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.max_tokens ?? 4000,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Stream error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6)
          if (data === "[DONE]") return

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices[0]?.delta?.content
            if (content) yield content
          } catch (e) {
            // Skip malformed chunks
          }
        }
      }
    }
  }
}

// Lazy singleton - client only created when first used
let clientInstance: GitHubModelsClient | null = null

function getClient(): GitHubModelsClient {
  if (!clientInstance) {
    clientInstance = new GitHubModelsClient()
  }
  return clientInstance
}

// Export a proxy object that lazily creates the client
export const githubModels = {
  chat: (...args: Parameters<GitHubModelsClient["chat"]>) => getClient().chat(...args),
  embeddings: (...args: Parameters<GitHubModelsClient["embeddings"]>) =>
    getClient().embeddings(...args),
  chatStream: (...args: Parameters<GitHubModelsClient["chatStream"]>) =>
    getClient().chatStream(...args),
}
