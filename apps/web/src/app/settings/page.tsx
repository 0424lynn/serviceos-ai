import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getWorkspaceForUser } from '@/lib/workspace'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const context = await getWorkspaceForUser()
  if (!context) redirect('/login')

  const { user, workspace } = context
  const admin = createAdminClient()

  const [{ data: memberData }, { data: profile }] = await Promise.all([
    admin.from('workspace_members').select('roles(name)').eq('user_id', user.id).eq('workspace_id', workspace.id).single(),
    admin.from('users').select('name, email').eq('id', user.id).single(),
  ])

  const role = memberData?.roles as unknown as { name: string } | null

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your workspace and account preferences</p>
      </div>

      <SettingsForm
        workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
        profile={{ name: profile?.name ?? '', email: user.email ?? '' }}
        role={role?.name ?? 'member'}
      />
    </div>
  )
}
