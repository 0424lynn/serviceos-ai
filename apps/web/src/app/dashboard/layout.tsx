export const dynamic = 'force-dynamic'

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
  const { data: memberData } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  let workspaceName = 'My Workspace'
  if (memberData?.workspace_id) {
    const { data: ws } = await admin
      .from('workspaces')
      .select('name')
      .eq('id', memberData.workspace_id)
      .single()
    if (ws?.name) workspaceName = ws.name
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar workspaceName={workspaceName} userEmail={user.email ?? ''} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
