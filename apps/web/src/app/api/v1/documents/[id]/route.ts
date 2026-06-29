import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

    const { id } = await params
    const admin = createAdminClient()

    // Verify ownership
    const { data: doc } = await admin.from('documents').select('workspace_id, file_url').eq('id', id).single()
    if (!doc) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 })

    // Delete chunks first
    await admin.from('document_chunks').delete().eq('document_id', id)

    // Delete document record
    await admin.from('documents').delete().eq('id', id)

    return NextResponse.json({ success: true, data: { id }, error: null, meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() } })
  } catch (err) {
    console.error('[document-delete]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
