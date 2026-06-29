import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

    const { id } = await params
    const body = await req.json() as { name?: string }
    if (!body.name?.trim()) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } }, { status: 422 })

    const admin = createAdminClient()

    // Check role
    const { data: member } = await admin
      .from('workspace_members')
      .select('roles(name)')
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .single()

    const role = member?.roles as unknown as { name: string } | null
    if (!role || !['owner', 'admin'].includes(role.name)) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })
    }

    const { error } = await admin
      .from('workspaces')
      .update({ name: body.name.trim() })
      .eq('id', id)

    if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

    await admin.from('audit_logs').insert({ workspace_id: id, user_id: user.id, action: 'workspace.updated', resource_type: 'workspace', resource_id: id, metadata: { name: body.name.trim() } })

    return NextResponse.json({ success: true, data: { id, name: body.name.trim() }, error: null, meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() } })
  } catch (err) {
    console.error('[workspace-patch]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
