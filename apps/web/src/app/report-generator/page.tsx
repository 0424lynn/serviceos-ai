'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Sparkles, RefreshCw, Download } from 'lucide-react'

interface ReportOutput {
  problem_found: string
  diagnosis: string
  repair_performed: string
  parts_used: string
  final_status: string
  full_report: string
  mock?: boolean
}

const SECTION_FIELDS: { key: keyof Omit<ReportOutput, 'full_report' | 'mock'>; label: string }[] = [
  { key: 'problem_found',     label: 'Problem found' },
  { key: 'diagnosis',         label: 'Diagnosis' },
  { key: 'repair_performed',  label: 'Repair performed' },
  { key: 'parts_used',        label: 'Parts used' },
  { key: 'final_status',      label: 'Final status' },
]

export default function ReportGeneratorPage() {
  const [notes, setNotes]     = useState('')
  const [output, setOutput]   = useState<ReportOutput | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [error, setError]     = useState('')
  const [view, setView]       = useState<'structured' | 'full'>('structured')

  async function generate() {
    if (!notes.trim()) return
    setLoading(true)
    setError('')
    setOutput(null)

    try {
      const res = await fetch('/api/v1/apps/report-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repair_notes: notes }),
      })
      const json = await res.json() as { success: boolean; data?: ReportOutput; error?: { message: string } }
      if (!json.success || !json.data) { setError(json.error?.message ?? 'Something went wrong'); return }
      setOutput(json.data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyReport() {
    if (!output) return
    await navigator.clipboard.writeText(output.full_report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadReport() {
    if (!output) return
    const blob = new Blob([output.full_report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `service-report-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Report Generator</h1>
        <p className="text-sm text-gray-400 mt-1">Enter repair notes in any language — AI generates a professional English service report</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Repair notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter repair notes in any language… e.g. '客户反映机器不制冷。检查后发现冷媒不足，补充R410A冷媒600g，清洗过滤网，测试正常后交付。'"
              rows={10}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors text-gray-800 placeholder-gray-300"
            />
          </div>
          <Button
            onClick={generate}
            disabled={loading || !notes.trim()}
            className="w-full text-white gap-2"
            style={{ background: loading || !notes.trim() ? '#a5a0d8' : '#534AB7' }}
          >
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</> : <><Sparkles className="w-4 h-4" />Generate report</>}
          </Button>
          {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Service report</label>
              {output?.mock && (
                <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">Mock mode</span>
              )}
            </div>
            {output && (
              <div className="flex gap-1">
                <button onClick={() => setView('structured')} className={`text-xs px-2 py-1 rounded ${view === 'structured' ? 'bg-purple-50 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}>Structured</button>
                <button onClick={() => setView('full')} className={`text-xs px-2 py-1 rounded ${view === 'full' ? 'bg-purple-50 text-purple-700' : 'text-gray-400 hover:text-gray-600'}`}>Full report</button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 min-h-[240px]">
            {output ? (
              view === 'structured' ? (
                <div className="divide-y divide-gray-50">
                  {SECTION_FIELDS.map(({ key, label }) => (
                    <div key={key} className="px-4 py-3">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-sm text-gray-800">{output[key]}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-sm text-gray-800 px-4 py-3 whitespace-pre-wrap font-sans leading-relaxed">
                  {output.full_report}
                </pre>
              )
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-gray-300">
                Report will appear here
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={copyReport} disabled={!output} variant="outline" className="flex-1 gap-2">
              {copied ? <><Check className="w-4 h-4 text-green-500" /><span className="text-green-600">Copied!</span></> : <><Copy className="w-4 h-4" />Copy</>}
            </Button>
            <Button onClick={downloadReport} disabled={!output} variant="outline" className="flex-1 gap-2">
              <Download className="w-4 h-4" />Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
