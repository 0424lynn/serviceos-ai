import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding } from '@/lib/ai/embeddings'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

    const body = await request.json() as { question: string; top_k?: number }
    if (!body.question?.trim()) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Question is required' } }, { status: 422 })

    const admin = createAdminClient()
    const { data: memberData } = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
    if (!memberData?.workspace_id) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, { status: 404 })

    const workspaceId = memberData.workspace_id
    const topK = body.top_k ?? 5

    // Check if any documents exist
    const { count } = await admin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'ready')

    if (!count || count === 0) {
      return NextResponse.json({
        success: true,
        data: { answer: 'No documents found in your knowledge base. Please upload some documents first.', sources: [], mock: false },
        error: null,
        meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() },
      })
    }

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(body.question)

    // Vector similarity search using pgvector
    const { data: chunks, error: searchError } = await admin.rpc('match_document_chunks', {
      query_embedding: JSON.stringify(questionEmbedding),
      match_workspace_id: workspaceId,
      match_count: topK,
    })

    if (searchError) {
      console.error('[knowledge-base] vector search error:', searchError)
      // Fallback: get recent chunks if vector search fails
    }

    const relevantChunks = (chunks as Array<{ content: string; document_id: string; chunk_index: number }> | null) ?? []

    // Get document names for sources
    const docIds = [...new Set(relevantChunks.map((c) => c.document_id))]
    const { data: docs } = await admin
      .from('documents')
      .select('id, file_name')
      .in('id', docIds.length > 0 ? docIds : ['00000000-0000-0000-0000-000000000000'])

    const docMap = new Map((docs ?? []).map((d) => [d.id, d.file_name]))

    const startTime = Date.now()
    let answer = ''

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey && relevantChunks.length > 0) {
      const context = relevantChunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
      const prompt = `You are a helpful assistant for a service company. Answer the question based ONLY on the provided context.
If the answer is not in the context, say "I couldn't find information about this in the uploaded documents."
Be concise and professional.

Context from company documents:
${context}

Question: ${body.question}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content: Array<{ text: string }> }
      answer = data.content[0]?.text ?? 'Could not generate an answer.'
    } else if (relevantChunks.length > 0) {
      answer = `Based on your documents, here is the most relevant excerpt:\n\n"${relevantChunks[0]?.content ?? ''}"\n\n(Add an Anthropic API key for full AI-powered answers.)`
    } else {
      answer = "I couldn't find relevant information in your documents for this question."
    }

    const duration = Date.now() - startTime

    const sources = relevantChunks.map((c) => ({
      document_id: c.document_id,
      file_name: docMap.get(c.document_id) ?? 'Unknown',
      page: null,
      excerpt: c.content.slice(0, 200) + (c.content.length > 200 ? '…' : ''),
    }))

    // Save session
    const { data: app } = await admin.from('apps').select('id').eq('slug', 'knowledge-base').single()
    if (app?.id) {
      await admin.from('app_sessions').insert({
        workspace_id: workspaceId, app_id: app.id, user_id: user.id,
        input: { question: body.question },
        output: { answer, sources },
        status: 'completed', duration_ms: duration,
      })
    }

    return NextResponse.json({
      success: true,
      data: { answer, sources },
      error: null,
      meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() },
    })
  } catch (err) {
    console.error('[knowledge-base]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
