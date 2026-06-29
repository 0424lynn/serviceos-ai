'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Trash2, Send, Bot, User, Loader2, File } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Document {
  id: string
  file_name: string
  file_type: string
  file_size_bytes: number
  status: string
  created_at: string
  metadata: { chunk_count?: number } | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ file_name: string; excerpt: string }>
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgeBasePage() {
  const [docs, setDocs]           = useState<Document[]>([])
  const [docsLoaded, setDocsLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [messages, setMessages]   = useState<Message[]>([])
  const [question, setQuestion]   = useState('')
  const [asking, setAsking]       = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadDocs = useCallback(async () => {
    const res = await fetch('/api/v1/documents')
    const json = await res.json() as { success: boolean; data?: Document[] }
    if (json.success && json.data) {
      setDocs(json.data)
      setDocsLoaded(true)
    }
  }, [])

  // Load docs on mount
  useState(() => { void loadDocs() })

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadError('')
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/v1/documents/upload', { method: 'POST', body: form })
    const json = await res.json() as { success: boolean; error?: { message: string } }
    if (!json.success) {
      setUploadError(json.error?.message ?? 'Upload failed')
    } else {
      await loadDocs()
    }
    setUploading(false)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void uploadFile(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void uploadFile(file)
  }

  async function deleteDoc(id: string) {
    await fetch(`/api/v1/documents/${id}`, { method: 'DELETE' })
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }

  async function askQuestion() {
    if (!question.trim() || asking) return
    const q = question.trim()
    setQuestion('')
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setAsking(true)

    const res = await fetch('/api/v1/apps/knowledge-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    })
    const json = await res.json() as {
      success: boolean
      data?: { answer: string; sources: Array<{ file_name: string; excerpt: string }> }
      error?: { message: string }
    }

    const answer = json.success && json.data
      ? json.data.answer
      : json.error?.message ?? 'Something went wrong'
    const sources = json.data?.sources ?? []

    setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources }])
    setAsking(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel — Documents */}
      <div className="w-72 border-r border-gray-100 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Knowledge Base</h2>
          <p className="text-xs text-gray-400 mt-0.5">Upload docs, then ask AI questions</p>
        </div>

        {/* Upload zone */}
        <div className="p-3">
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-1.5">
                <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                <p className="text-xs text-gray-500">Processing…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="w-5 h-5 text-gray-300" />
                <p className="text-xs text-gray-500">Drop file or click to upload</p>
                <p className="text-[11px] text-gray-300">PDF · Word · TXT · Max 20MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" onChange={onFileChange} className="hidden" />
          {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {!docsLoaded ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-300">No documents yet</p>
            </div>
          ) : (
            docs.map((doc) => (
              <div key={doc.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 group">
                <File className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{doc.file_name}</p>
                  <p className="text-[11px] text-gray-400">
                    {formatBytes(doc.file_size_bytes ?? 0)}
                    {doc.metadata?.chunk_count ? ` · ${doc.metadata.chunk_count} chunks` : ''}
                  </p>
                  {doc.status !== 'ready' && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      {doc.status}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => void deleteDoc(doc.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel — Chat */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-400">Ask anything about your documents</p>
              <p className="text-xs text-gray-300 mt-1">Upload documents on the left, then ask questions here</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#534AB7' }}>
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-lg ${msg.role === 'user' ? 'order-first' : ''}`}>
                <div className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white rounded-tr-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                }`}
                style={msg.role === 'user' ? { background: '#534AB7' } : {}}>
                  {msg.content}
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.sources.slice(0, 3).map((src, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-[11px] text-gray-400">
                        <File className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span className="font-medium text-gray-500">{src.file_name}</span>
                        <span className="truncate">{src.excerpt.slice(0, 80)}…</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                </div>
              )}
            </div>
          ))}

          {asking && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#534AB7' }}>
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-xl rounded-tl-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-4 bg-white">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void askQuestion() } }}
              placeholder="Ask a question about your documents…"
              className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-colors"
            />
            <Button
              onClick={() => void askQuestion()}
              disabled={!question.trim() || asking}
              className="text-white px-4 rounded-xl"
              style={{ background: !question.trim() || asking ? '#a5a0d8' : '#534AB7' }}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
