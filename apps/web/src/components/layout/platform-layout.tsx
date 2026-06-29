import { redirect } from 'next/navigation'
import { getWorkspaceForUser } from '@/lib/workspace'
import { Sidebar } from './sidebar'

export async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const data = await getWorkspaceForUser()
  if (!data) redirect('/login')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar workspaceName={data.workspace.name} userEmail={data.user.email ?? ''} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  )
}
