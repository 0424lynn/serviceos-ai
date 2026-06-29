'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles, RefreshCw } from 'lucide-react'

interface TicketOutput {
  issue_summary: string
  model: string
  serial_number: string
  problem_category: string
  suggested_next_step: string
  required_photos: string[]
  technician_notes: string
  mock?: boolean
}

const FIELDS: { key: keyof Omit<TicketOutput, 'required_photos' | 'mock'>; label: string }[] = [
  { key: 'issue_summary',      label: 'Issue summary' },
  { key: 'model',              label: 'Model' },
  { key: 'serial_number',      label: 'Serial number' },
  { key: 'problem_category',   label: 'Problem category' },
  { key: 'suggested_next_step',label: 'Suggested next step' },
  { key: 'technician_notes',   label: 'Technician notes' },
]

export default function TicketAssistantPage() {
  const [description, setDescription] = useState('')
  const [output, setOutput]           = useState<TicketOutput | null>(null)
  const [loading, setLoading]         = useState(false)
  const [copied, setCopied]           = useState(false)
  const [error, setError]             = useState('')

  async function generate() {
    if (!description.trim()) return
    setLoading(true)
    setError('')
    setOutput(null)

    try {
      const res = await fetch('/api/v1/apps/ticket-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_description: description }),
      })
      const json = await res.json() as { success: boolean; data?: TicketOutput; error?: { message: string } }
      if (!json.success || !json.data) { setError(json.error?.message ?? 'Something went wrong'); return }
      setOutput(json.data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyTicket() {
    if (!output) return
    const text = FIELDS.map(({ key, label }) => `${label}: ${output[key]}`).join('\n') +
      `\nRequired photos: ${output.required_photos.join(', ')}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Ticket Assistant</h1>
        <p className="text-sm text-gray-400 mt-1">Describe the customer problem — AI extracts all ticket fields automatically</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Customer problem</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the customer's issue here… e.g. 'Customer called about their AC unit Model CW-300 serial 99123 making loud noise and not cooling since yesterday.'"
              rows={10}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors text-gray-800 placeholder-gray-300"
            />
          </div>
          <Button
            onClick={generate}
            disabled={loading || !description.trim()}
            className="w-full text-white gap-2"
            style={{ background: loading || !description.trim() ? '#a5a0d8' : '#534AB7' }}
          >
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />Extracting…</> : <><Sparkles className="w-4 h-4" />Generate ticket</>}
          </Button>
          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Extracted ticket</label>
            {output?.mock && (
              <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
                Mock mode
              </span>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-50 min-h-[240px]">
            {output ? (
              <>
                {FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex gap-3 px-4 py-3">
                    <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm text-gray-800 flex-1">{output[key]}</span>
                  </div>
                ))}
                <div className="flex gap-3 px-4 py-3">
                  <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">Required photos</span>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {output.required_photos.map((p, i) => (
                      <span key={i} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md">{p}</span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-300">
                Ticket fields will appear here
              </div>
            )}
          </div>

          <Button onClick={copyTicket} disabled={!output} variant="outline" className="w-full gap-2">
            {copied ? <><Check className="w-4 h-4 text-green-500" /><span className="text-green-600">Copied!</span></> : <><Copy className="w-4 h-4" />Copy ticket</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
