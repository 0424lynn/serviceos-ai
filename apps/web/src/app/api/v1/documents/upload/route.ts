import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseDocument, chunkText } from '@/lib/documents/parser'
import { generateEmbeddings } from '@/lib/ai/embeddings'

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No file provided' } }, { status: 422 })

    const fileType = ALLOWED_TYPES[file.type]
    if (!fileType) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Unsupported file type. Use PDF, Word, or TXT.' } }, { status: 422 })
    if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File too large. Max 20 MB.' } }, { status: 422 })

    const admin = createAdminClient()
    const { data: memberData } = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
    if (!memberData?.workspace_id) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, { status: 404 })

    const workspaceId = memberData.workspace_id

    // 1. Upload file to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const storagePath = `${workspaceId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      return NextResponse.json({ success: false, error: { code: 'STORAGE_ERROR', message: uploadError.message } }, { status: 500 })
    }

    const { data: { publicUrl } } = admin.storage.from('documents').getPublicUrl(storagePath)

    // 2. Create document record
    const { data: doc, error: docError } = await admin
      .from('documents')
      .insert({
        workspace_id: workspaceId,
        uploaded_by: user.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: fileType,
        file_size_bytes: file.size,
        status: 'processing',
      })
      .select('id')
      .single()

    if (docError || !doc) {
      return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to save document' } }, { status: 500 })
    }

    // 3. Parse document text
    let parsed
    try {
      parsed = await parseDocument(buffer, fileType)
    } catch {
      await admin.from('documents').update({ status: 'error' }).eq('id', doc.id)
      return NextResponse.json({ success: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse document' } }, { status: 500 })
    }

    // 4. Chunk text
    const chunks = chunkText(parsed.text)
    if (chunks.length === 0) {
      await admin.from('documents').update({ status: 'ready' }).eq('id', doc.id)
      return NextResponse.json({ success: true, data: { document_id: doc.id, chunks: 0 }, error: null, meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() } })
    }

    // 5. Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks)

    // 6. Save chunks with embeddings
    const chunkRows = chunks.map((content, i) => ({
      document_id: doc.id,
      workspace_id: workspaceId,
      content,
      embedding: JSON.stringify(embeddings[i] ?? []),
      chunk_index: i,
      page_number: null,
    }))

    const { error: chunkError } = await admin.from('document_chunks').insert(chunkRows)
    if (chunkError) {
      await admin.from('documents').update({ status: 'error' }).eq('id', doc.id)
      return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: 'Failed to save chunks' } }, { status: 500 })
    }

    // 7. Mark document as ready
    await admin.from('documents').update({ status: 'ready', metadata: { page_count: parsed.pageCount, chunk_count: chunks.length } }).eq('id', doc.id)

    // Audit log
    await admin.from('audit_logs').insert({ workspace_id: workspaceId, user_id: user.id, action: 'document.uploaded', resource_type: 'document', resource_id: doc.id, metadata: { file_name: file.name, file_type: fileType, chunks: chunks.length } })

    return NextResponse.json({
      success: true,
      data: { document_id: doc.id, file_name: file.name, chunks: chunks.length, status: 'ready' },
      error: null,
      meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() },
    }, { status: 201 })

  } catch (err) {
    console.error('[document-upload]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
