// src/lib/ai/agents.ts
/**
 * AI Architecture Review Board
 * Specialized agents for code review, architecture, and analysis
 */

import { githubModels } from './github-models';

interface AgentResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

/**
 * GPT-4o-mini: Lead Architect
 * Makes high-level architecture decisions
 */
export async function architect(prompt: string): Promise<AgentResponse> {
  const response = await githubModels.chat(
    [
      {
        role: 'system',
        content: `You are a senior Next.js architect specializing in App Router, 
Server Components, and modern React patterns. Make clear, opinionated 
architecture decisions. Consider:
- Server vs Client component boundaries
- Data fetching patterns (RSC, Server Actions, Route Handlers)
- Edge runtime vs Node runtime
- Performance and bundle size
- Type safety and developer experience

Be concise but thorough. Provide specific code patterns when relevant.`,
      },
      { role: 'user', content: prompt },
    ],
    {
      model: process.env.MODEL_ARCHITECT || 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 4000,
    }
  );

  return {
    content: response.choices[0].message.content,
    usage: response.usage,
  };
}

/**
 * o3-mini: Skeptical Reviewer
 * Finds edge cases, async issues, runtime problems
 */
export async function reviewer(
  code: string,
  context: string
): Promise<AgentResponse> {
  const response = await githubModels.chat(
    [
      {
        role: 'system',
        content: `You are a skeptical code reviewer who stress-tests assumptions.
Focus on finding:
- Async/await mistakes and race conditions
- Data fetching anti-patterns in Next.js
- Edge runtime incompatibilities
- Type safety gaps
- Performance bottlenecks
- Missing error handling

Be critical but constructive. Provide specific fixes.`,
      },
      {
        role: 'user',
        content: `Context: ${context}\n\nCode to review:\n\`\`\`\n${code}\n\`\`\``,
      },
    ],
    {
      model: process.env.MODEL_REVIEWER || 'o3-mini',
      temperature: 0.2,
      max_tokens: 3000,
    }
  );

  return {
    content: response.choices[0].message.content,
    usage: response.usage,
  };
}

/**
 * Codestral-25.01: Code Author
 * Writes and refactors TypeScript/Next.js code
 */
export async function coder(
  instruction: string,
  existingCode?: string
): Promise<AgentResponse> {
  const messages = [
    {
      role: 'system' as const,
      content: `You are an expert TypeScript/Next.js developer. Write clean, 
type-safe, production-ready code following Next.js 15 best practices:
- Use Server Components by default
- Client Components only when needed ('use client')
- Proper error boundaries and loading states
- Type-safe API routes with Zod validation
- Optimized imports and tree-shaking

Always include comments explaining non-obvious decisions.`,
    },
  ];

  if (existingCode) {
    messages.push({
      role: 'user' as const,
      content: `Refactor this code:\n\`\`\`typescript\n${existingCode}\n\`\`\`\n\nInstruction: ${instruction}`,
    });
  } else {
    messages.push({
      role: 'user' as const,
      content: instruction,
    });
  }

  const response = await githubModels.chat(messages, {
    model: process.env.MODEL_CODER || 'Codestral-25.01',
    temperature: 0.1,
    max_tokens: 8000,
  });

  return {
    content: response.choices[0].message.content,
    usage: response.usage,
  };
}

/**
 * Llama-3.3-70B: Repo-Scale Analyst
 * Reads many files, analyzes architectural drift
 */
export async function analyst(
  files: Array<{ path: string; content: string }>,
  question: string
): Promise<AgentResponse> {
  const fileContext = files
    .map((f) => `// ${f.path}\n${f.content}`)
    .join('\n\n---\n\n');

  const response = await githubModels.chat(
    [
      {
        role: 'system',
        content: `You are a repository analyst who reads many files to understand
the full codebase. Identify:
- Architectural patterns and inconsistencies
- Repeated code that should be abstracted
- Missing abstractions or over-engineering
- Data flow and component relationships
- Breaking changes and migration paths

Provide high-level insights, not line-by-line review.`,
      },
      {
        role: 'user',
        content: `Repository files:\n\n${fileContext}\n\nQuestion: ${question}`,
      },
    ],
    {
      model: process.env.MODEL_ANALYST || 'Llama-3.3-70B-Instruct',
      temperature: 0.4,
      max_tokens: 6000,
    }
  );

  return {
    content: response.choices[0].message.content,
    usage: response.usage,
  };
}

/**
 * OpenAI Text Embedding 3: Memory Layer
 * Semantic search over codebase
 */
export async function embedCode(code: string): Promise<number[]> {
  const response = await githubModels.embeddings(code, 
    process.env.MODEL_EMBEDDINGS || 'text-embedding-3-small'
  );
  return response.data[0].embedding;
}

/**
 * Find similar code using cosine similarity
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
