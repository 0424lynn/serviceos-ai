import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberData } = await admin
    .from('workspace_members')
    .select('workspace_id, roles(name)')
    .eq('user_id', user.id)
    .single()

  let workspace = { id: '', name: '', slug: '' }
  if (memberData?.workspace_id) {
    const { data: ws } = await admin
      .from('workspaces')
      .select('id, name, slug, settings')
      .eq('id', memberData.workspace_id)
      .single()
    if (ws) workspace = ws
  }

  const { data: profile } = await admin
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .single()

  const role = memberData?.roles as unknown as { name: string } | null

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your workspace and account preferences</p>
      </div>

      <SettingsForm
        workspace={workspace}
        profile={{ name: profile?.name ?? '', email: user.email ?? '' }}
        role={role?.name ?? 'member'}
      />
    </div>
  )
}
