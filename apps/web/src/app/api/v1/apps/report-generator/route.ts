import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MOCK_REPORT = {
  problem_found: 'Unit not producing cold air. Customer reported issue started yesterday afternoon.',
  diagnosis: 'Refrigerant level found to be critically low. Possible slow leak at service valve connection.',
  repair_performed: 'Recharged unit with 600g R410A refrigerant. Tightened service valve connections. Cleaned air filter and condenser coils.',
  parts_used: 'R410A refrigerant — 600g',
  final_status: 'Unit tested and operating normally. Temperature reaching set point within 15 minutes. Returned to customer service.',
  full_report: `SERVICE REPORT

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

PROBLEM FOUND
Unit not producing cold air. Customer reported issue started yesterday afternoon.

DIAGNOSIS
Refrigerant level found to be critically low. Possible slow leak at service valve connection.

REPAIR PERFORMED
Recharged unit with 600g R410A refrigerant. Tightened service valve connections. Cleaned air filter and condenser coils.

PARTS USED
- R410A refrigerant — 600g

FINAL STATUS
Unit tested and operating normally. Temperature reaching set point within 15 minutes. Returned to customer service.

Technician Signature: _______________________
Date: _______________________`,
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })

    const body = await request.json() as { repair_notes: string; language?: string }
    if (!body.repair_notes?.trim()) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Repair notes are required' } }, { status: 422 })
    }

    const admin = createAdminClient()
    const { data: memberData } = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id).single()
    if (!memberData?.workspace_id) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, { status: 404 })

    const { data: app } = await admin.from('apps').select('id').eq('slug', 'report-generator').single()

    const startTime = Date.now()
    let output = MOCK_REPORT
    let tokensInput = 0, tokensOutput = 0, costUsd = 0

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const prompt = `You are a professional service report writer.
Convert the following technician repair notes into a professional English service report.
Return ONLY a valid JSON object with these exact fields:
- problem_found: what was wrong
- diagnosis: technical cause identified
- repair_performed: what was done to fix it
- parts_used: parts/materials used (or "None")
- final_status: current status after repair
- full_report: complete formatted report as a multi-line string

Today's date: ${today}
Repair notes (may be in any language):
${body.repair_notes}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json() as { content: Array<{ text: string }>; usage: { input_tokens: number; output_tokens: number } }
      const text = data.content[0]?.text ?? '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      output = jsonMatch ? JSON.parse(jsonMatch[0]) as typeof MOCK_REPORT : MOCK_REPORT
      tokensInput = data.usage?.input_tokens ?? 0
      tokensOutput = data.usage?.output_tokens ?? 0
      costUsd = (tokensInput * 0.003 + tokensOutput * 0.015) / 1000
    } else {
      await new Promise((r) => setTimeout(r, 900))
    }

    const duration = Date.now() - startTime

    if (app?.id) {
      await admin.from('app_sessions').insert({
        workspace_id: memberData.workspace_id, app_id: app.id, user_id: user.id,
        input: { repair_notes: body.repair_notes },
        output, status: 'completed',
        tokens_input: tokensInput, tokens_output: tokensOutput, cost_usd: costUsd, duration_ms: duration,
      })
      await admin.from('usage_logs').insert({
        workspace_id: memberData.workspace_id, user_id: user.id, source_type: 'app', app_id: app.id,
        tokens_input: tokensInput, tokens_output: tokensOutput, tokens_total: tokensInput + tokensOutput,
        cost_usd: costUsd, duration_ms: duration,
      })
    }

    return NextResponse.json({ success: true, data: { ...output, mock: !apiKey }, error: null, meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() } })
  } catch (err) {
    console.error('[report-generator]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
