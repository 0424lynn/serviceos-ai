export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Database, Mail, ClipboardList, FileText } from 'lucide-react'

const QUICK_APPS = [
  {
    href: '/knowledge-base',
    label: 'Knowledge Base',
    description: 'Ask AI from your documents',
    icon: Database,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    href: '/email-assistant',
    label: 'Email Assistant',
    description: 'Generate professional replies',
    icon: Mail,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    href: '/ticket-assistant',
    label: 'Ticket Assistant',
    description: 'Extract structured ticket fields',
    icon: ClipboardList,
    color: 'bg-teal-50 text-teal-600',
  },
  {
    href: '/report-generator',
    label: 'Report Generator',
    description: 'Create service reports instantly',
    icon: FileText,
    color: 'bg-orange-50 text-orange-600',
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch stats in parallel
  const [
    { count: docCount },
    { count: sessionCount },
    { data: recentSessions },
    { data: member },
  ] = await Promise.all([
    admin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', await getWorkspaceId(admin, user.id)),
    admin
      .from('app_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', await getWorkspaceId(admin, user.id)),
    admin
      .from('app_sessions')
      .select('id, created_at, app_id, apps(name, icon), input')
      .eq('workspace_id', await getWorkspaceId(admin, user.id))
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single(),
  ])

  let workspaceName = 'your workspace'
  if (member?.workspace_id) {
    const { data: ws } = await admin
      .from('workspaces')
      .select('name')
      .eq('id', member.workspace_id)
      .single()
    if (ws?.name) workspaceName = ws.name
  }

  const firstName = user.email?.split('@')[0] ?? 'there'

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Good morning, {firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{workspaceName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Documents</p>
          <p className="text-3xl font-semibold text-gray-900">{docCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">uploaded to knowledge base</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">AI sessions</p>
          <p className="text-3xl font-semibold text-gray-900">{sessionCount ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">total this month</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Time saved</p>
          <p className="text-3xl font-semibold text-gray-900">
            {Math.round((sessionCount ?? 0) * 8)}
            <span className="text-lg font-normal text-gray-400 ml-1">min</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">estimated</p>
        </div>
      </div>

      {/* Quick access */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Quick access</h2>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_APPS.map(({ href, label, description, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all group"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-purple-700 transition-colors">
                {label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Recent activity</h2>
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          {recentSessions && recentSessions.length > 0 ? (
            recentSessions.map((session) => {
              const app = session.apps as unknown as { name: string; icon: string | null } | null
              return (
                <div key={session.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                  <p className="text-sm text-gray-600 flex-1 truncate">
                    {app?.name ?? 'AI session'}
                  </p>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(session.created_at).toLocaleDateString()}
                  </p>
                </div>
              )
            })
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No activity yet.</p>
              <p className="text-xs text-gray-300 mt-1">Use an app above to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to avoid repeating workspace lookup
async function getWorkspaceId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string> {
  const { data } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .single()
  return data?.workspace_id ?? ''
}
