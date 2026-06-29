// Generate embeddings using Anthropic's claude for text similarity
// We use a simple approach: ask Claude to summarize key concepts,
// then use OpenAI text-embedding-3-small via direct API call.
// If no OpenAI key, we use a deterministic mock embedding for dev.

export async function generateEmbedding(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY

  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    })
    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? mockEmbedding(text)
  }

  // Dev fallback: deterministic pseudo-embedding (1536 dims)
  return mockEmbedding(text)
}

function mockEmbedding(text: string): number[] {
  const dims = 1536
  const embedding = new Array<number>(dims).fill(0)
  for (let i = 0; i < text.length; i++) {
    embedding[i % dims] = (embedding[i % dims] ?? 0) + text.charCodeAt(i) / 1000
  }
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1
  return embedding.map((v) => v / magnitude)
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openaiKey = process.env.OPENAI_API_KEY

  if (openaiKey && texts.length > 0) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts.map((t) => t.slice(0, 8000)),
      }),
    })
    const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> }
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding)
  }

  return texts.map((t) => mockEmbedding(t))
}
