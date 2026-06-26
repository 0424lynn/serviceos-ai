import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      userId: string
      name: string
      email: string
      workspaceName: string
    }

    const { userId, name, email, workspaceName } = body

    if (!userId || !name || !email || !workspaceName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 422 },
      )
    }

    const supabase = await createClient()

    // 1. Upsert the user profile row (Supabase trigger doesn't auto-create it)
    const { error: userError } = await supabase
      .from('users')
      .upsert({ id: userId, email, name }, { onConflict: 'id' })

    if (userError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: userError.message } },
        { status: 500 },
      )
    }

    // 2. Get the free plan id
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('id')
      .eq('name', 'free')
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Free plan not found' } },
        { status: 500 },
      )
    }

    // 3. Create workspace with a unique slug
    const baseSlug = slugify(workspaceName)
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        slug: uniqueSlug,
        plan_id: plan.id,
        created_by: userId,
        industry: 'field_service',
      })
      .select('id')
      .single()

    if (wsError || !workspace) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: wsError?.message ?? 'Workspace creation failed' } },
        { status: 500 },
      )
    }

    // 4. Get the owner system role
    const { data: ownerRole, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .eq('is_system', true)
      .is('workspace_id', null)
      .single()

    if (roleError || !ownerRole) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Owner role not found' } },
        { status: 500 },
      )
    }

    // 5. Add user as workspace owner
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role_id: ownerRole.id,
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: memberError.message } },
        { status: 500 },
      )
    }

    // 6. Enable all builtin apps for this workspace
    const { data: builtinApps } = await supabase
      .from('apps')
      .select('id')
      .eq('is_builtin', true)
      .eq('is_active', true)

    if (builtinApps && builtinApps.length > 0) {
      await supabase.from('workspace_apps').insert(
        builtinApps.map((app) => ({
          workspace_id: workspace.id,
          app_id: app.id,
          enabled_by: userId,
          is_enabled: true,
        })),
      )
    }

    // 7. Write audit log
    await supabase.from('audit_logs').insert({
      workspace_id: workspace.id,
      user_id: userId,
      action: 'user.register',
      resource_type: 'workspace',
      resource_id: workspace.id,
      metadata: { workspace_name: workspaceName, plan: 'free' },
    })

    return NextResponse.json(
      {
        success: true,
        data: { workspace_id: workspace.id, workspace_slug: uniqueSlug },
        error: null,
        meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() },
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[register] unexpected error:', err)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
      { status: 500 },
    )
  }
}
