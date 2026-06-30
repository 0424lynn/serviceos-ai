import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, CORS_HEADERS } from '@/lib/auth'

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS_HEADERS }) }

const MOCK_TICKET = {
  issue_summary: 'Unit not cooling — possible refrigerant leak or compressor fault',
  model: 'CW-300',
  serial_number: '99123',
  problem_category: 'Mechanical / Cooling failure',
  suggested_next_step: 'Dispatch technician for on-site inspection within 24 hours',
  required_photos: ['Unit exterior', 'Control panel display', 'Error code screen'],
  technician_notes: 'Check compressor, refrigerant levels, and fan motor. Bring R410A kit.',
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401, headers: CORS_HEADERS })

    const body = await request.json() as { customer_description: string }
    if (!body.customer_description?.trim()) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Description is required' } }, { status: 422, headers: CORS_HEADERS })
    }

    const admin = createAdminClient()
    const { data: memberData } = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
    if (!memberData?.workspace_id) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, { status: 404, headers: CORS_HEADERS })

    const { data: app } = await admin.from('apps').select('id').eq('slug', 'ticket-assistant').single()

    const startTime = Date.now()
    let output = MOCK_TICKET
    let tokensInput = 0, tokensOutput = 0, costUsd = 0

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      const isThread = body.customer_description.includes('--- Previous message ---')
      const prompt = `Extract structured ticket information from the following${isThread ? ' email thread. Use the full thread for context but focus on the latest issue described' : ' customer description'}.
Return ONLY a valid JSON object with these exact fields:
- issue_summary: one sentence summary of the latest issue
- model: equipment model number (or "Not specified")
- serial_number: serial number (or "Not specified")
- problem_category: category like "Electrical", "Mechanical", "Software", etc.
- suggested_next_step: recommended action
- required_photos: array of 2-3 photo descriptions needed
- technician_notes: brief technical notes for the technician

${isThread ? 'Email thread' : 'Customer description'}:
${body.customer_description}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content: Array<{ text: string }>; usage: { input_tokens: number; output_tokens: number } }
      const text = data.content[0]?.text ?? '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      output = jsonMatch ? JSON.parse(jsonMatch[0]) as typeof MOCK_TICKET : MOCK_TICKET
      tokensInput = data.usage?.input_tokens ?? 0
      tokensOutput = data.usage?.output_tokens ?? 0
      costUsd = (tokensInput * 0.003 + tokensOutput * 0.015) / 1000
    } else {
      await new Promise((r) => setTimeout(r, 700))
    }

    const duration = Date.now() - startTime

    if (app?.id) {
      await admin.from('app_sessions').insert({
        workspace_id: memberData.workspace_id, app_id: app.id, user_id: user.id,
        input: { customer_description: body.customer_description },
        output, status: 'completed',
        tokens_input: tokensInput, tokens_output: tokensOutput, cost_usd: costUsd, duration_ms: duration,
      })
      await admin.from('usage_logs').insert({
        workspace_id: memberData.workspace_id, user_id: user.id, source_type: 'app', app_id: app.id,
        tokens_input: tokensInput, tokens_output: tokensOutput, tokens_total: tokensInput + tokensOutput,
        cost_usd: costUsd, duration_ms: duration,
      })
    }

    return NextResponse.json({ success: true, data: { ...output, mock: !apiKey }, error: null, meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() } }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[ticket-assistant]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500, headers: CORS_HEADERS })
  }
}
