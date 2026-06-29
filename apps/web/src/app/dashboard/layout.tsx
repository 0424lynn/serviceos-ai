import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch workspace for this user
  const admin = createAdminClient()
  const { data: member } = await admin
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const ws = member?.workspaces as unknown as { name: string } | null
  const workspaceName = ws?.name ?? 'My Workspace'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar workspaceName={workspaceName} userEmail={user.email ?? ''} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
