'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Loader2 } from 'lucide-react'

type Tone = 'professional' | 'friendly' | 'short' | 'detailed'

const TONES: { value: Tone; label: string; desc: string }[] = [
  { value: 'professional', label: 'Professional', desc: 'Formal and business-appropriate' },
  { value: 'friendly',     label: 'Friendly',     desc: 'Warm and approachable' },
  { value: 'short',        label: 'Short',        desc: 'Brief and to the point' },
  { value: 'detailed',     label: 'Detailed',     desc: 'Thorough with full context' },
]

interface Props {
  workspace: { id: string; name: string; slug: string }
  profile: { name: string; email: string }
  role: string
}

export function SettingsForm({ workspace, profile, role }: Props) {
  const [wsName, setWsName]       = useState(workspace.name)
  const [userName, setUserName]   = useState(profile.name)
  const [defaultTone, setDefaultTone] = useState<Tone>('professional')
  const [saving, setSaving]       = useState<'workspace' | 'profile' | null>(null)
  const [saved, setSaved]         = useState<'workspace' | 'profile' | null>(null)

  const isOwnerOrAdmin = role === 'owner' || role === 'admin'

  async function saveWorkspace() {
    if (!wsName.trim() || !isOwnerOrAdmin) return
    setSaving('workspace')
    const res = await fetch(`/api/v1/workspaces/${workspace.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: wsName.trim() }),
    })
    setSaving(null)
    if (res.ok) {
      setSaved('workspace')
      setTimeout(() => setSaved(null), 2000)
    }
  }

  async function saveProfile() {
    if (!userName.trim()) return
    setSaving('profile')
    const res = await fetch('/api/v1/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: userName.trim() }),
    })
    setSaving(null)
    if (res.ok) {
      setSaved('profile')
      setTimeout(() => setSaved(null), 2000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Workspace */}
      <section className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        <div className="px-5 py-4">
          <h2 className="text-sm font-medium text-gray-900">Workspace</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Company name</Label>
            <div className="flex gap-2">
              <Input
                id="ws-name"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                disabled={!isOwnerOrAdmin || saving === 'workspace'}
                placeholder="Your company name"
              />
              <Button
                onClick={saveWorkspace}
                disabled={!isOwnerOrAdmin || saving === 'workspace' || wsName === workspace.name}
                className="text-white shrink-0"
                style={{ background: '#534AB7' }}
              >
                {saving === 'workspace' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved === 'workspace' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
            {!isOwnerOrAdmin && (
              <p className="text-xs text-gray-400">Only owners and admins can change the workspace name.</p>
            )}
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-500">Plan</span>
            <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full font-medium">
              Free
            </span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-500">Your role</span>
            <span className="text-sm text-gray-700 font-medium capitalize">{role}</span>
          </div>
        </div>
      </section>

      {/* Profile */}
      <section className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        <div className="px-5 py-4">
          <h2 className="text-sm font-medium text-gray-900">Profile</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-name">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="user-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={saving === 'profile'}
                placeholder="Your name"
              />
              <Button
                onClick={saveProfile}
                disabled={saving === 'profile' || userName === profile.name}
                className="text-white shrink-0"
                style={{ background: '#534AB7' }}
              >
                {saving === 'profile' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved === 'profile' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm text-gray-700">{profile.email}</span>
          </div>
        </div>
      </section>

      {/* AI Preferences */}
      <section className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        <div className="px-5 py-4">
          <h2 className="text-sm font-medium text-gray-900">AI preferences</h2>
        </div>
        <div className="px-5 py-4">
          <Label className="mb-3 block">Default email reply tone</Label>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => setDefaultTone(value)}
                className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                  defaultTone === value
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}
              >
                <p className={`text-sm font-medium ${defaultTone === value ? 'text-purple-700' : 'text-gray-700'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-300 mt-3">Tone preference is saved locally per session.</p>
        </div>
      </section>
    </div>
  )
}
