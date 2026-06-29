'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Database,
  Mail,
  ClipboardList,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard',         label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/knowledge-base',    label: 'Knowledge Base',   icon: Database },
  { href: '/email-assistant',   label: 'Email Assistant',  icon: Mail },
  { href: '/ticket-assistant',  label: 'Ticket Assistant', icon: ClipboardList },
  { href: '/report-generator',  label: 'Report Generator', icon: FileText },
]

interface SidebarProps {
  workspaceName: string
  userEmail: string
}

export function Sidebar({ workspaceName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-white border-r border-gray-100 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: '#534AB7' }}
        >
          S
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate">ServiceOS.ai</span>
      </div>

      {/* Workspace selector */}
      <div className="px-3 py-2 border-b border-gray-100">
        <button className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left hover:bg-gray-50 transition-colors">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{workspaceName}</p>
            <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-purple-50 text-purple-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-purple-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
            pathname === '/settings'
              ? 'bg-purple-50 text-purple-700 font-medium'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          <Settings className="w-4 h-4 text-gray-400 flex-shrink-0" />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4 text-gray-400 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
