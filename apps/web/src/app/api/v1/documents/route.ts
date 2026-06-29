import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

    const admin = createAdminClient()
    const { data: memberData } = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
    if (!memberData?.workspace_id) return NextResponse.json({ success: false, data: [], error: null, meta: {} })

    const { data: documents } = await admin
      .from('documents')
      .select('id, file_name, file_type, file_size_bytes, status, metadata, created_at')
      .eq('workspace_id', memberData.workspace_id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ success: true, data: documents ?? [], error: null, meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() } })
  } catch (err) {
    console.error('[documents]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
