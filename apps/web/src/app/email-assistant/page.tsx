'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles, RefreshCw } from 'lucide-react'

type Tone = 'professional' | 'friendly' | 'short' | 'detailed'

const TONES: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly',     label: 'Friendly' },
  { value: 'short',        label: 'Short' },
  { value: 'detailed',     label: 'Detailed' },
]

export default function EmailAssistantPage() {
  const [email, setEmail]     = useState('')
  const [tone, setTone]       = useState<Tone>('professional')
  const [reply, setReply]     = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [error, setError]     = useState('')
  const [isMock, setIsMock]   = useState(false)

  async function generate() {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setReply('')

    try {
      const res = await fetch('/api/v1/apps/email-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original_email: email, tone }),
      })

      const json = await res.json() as {
        success: boolean
        data?: { reply: string; mock: boolean }
        error?: { message: string }
      }

      if (!json.success || !json.data) {
        setError(json.error?.message ?? 'Something went wrong')
        return
      }

      setReply(json.data.reply)
      setIsMock(json.data.mock)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyReply() {
    if (!reply) return
    await navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Email Assistant</h1>
        <p className="text-sm text-gray-400 mt-1">
          Paste a customer email and get a professional reply instantly
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left — Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Customer email
            </label>
            <textarea
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Paste the customer's email here…"
              rows={10}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors text-gray-800 placeholder-gray-300"
            />
          </div>

          {/* Tone selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Reply tone
            </label>
            <div className="flex gap-2 flex-wrap">
              {TONES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTone(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    tone === value
                      ? 'bg-purple-50 border-purple-300 text-purple-700 font-medium'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={generate}
            disabled={loading || !email.trim()}
            className="w-full text-white gap-2"
            style={{ background: loading || !email.trim() ? '#a5a0d8' : '#534AB7' }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate reply
              </>
            )}
          </Button>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Right — Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              AI generated reply
            </label>
            {isMock && (
              <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                Mock mode — add API key for real AI
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Your AI-generated reply will appear here…"
              rows={10}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors text-gray-800 placeholder-gray-300"
            />
          </div>

          <Button
            onClick={copyReply}
            disabled={!reply}
            variant="outline"
            className="w-full gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy reply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
