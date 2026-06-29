import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

    const body = await req.json() as { name?: string }
    if (!body.name?.trim()) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } }, { status: 422 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('users')
      .update({ name: body.name.trim() })
      .eq('id', user.id)

    if (error) return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })

    return NextResponse.json({ success: true, data: { name: body.name.trim() }, error: null, meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() } })
  } catch (err) {
    console.error('[user-patch]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
