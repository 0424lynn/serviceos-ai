import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, CORS_HEADERS } from '@/lib/auth'

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS_HEADERS }) }

const MOCK_REPLIES: Record<string, string> = {
  professional: `Dear Customer,

Thank you for reaching out to us. We appreciate you bringing this matter to our attention.

We have reviewed your inquiry and our technical team will be in contact with you within 24 business hours to address your concern and provide a resolution.

Please do not hesitate to contact us should you require any further assistance in the meantime.

Best regards,
Customer Support Team`,
  friendly: `Hi there!

Thanks so much for getting in touch — we really appreciate it! 😊

We've got your message and our team is already looking into it. We'll get back to you within 24 hours with a solution.

Feel free to reach out if you need anything else in the meantime!

Cheers,
The Support Team`,
  short: `Hi,

Thanks for your message. We're looking into this and will get back to you within 24 hours.

Best,
Support Team`,
  detailed: `Dear Valued Customer,

Thank you for contacting our support team. We have carefully reviewed the details of your inquiry and would like to provide you with a comprehensive response.

Our technical specialists have been notified of your case and will conduct a thorough investigation. Based on similar cases we have handled previously, we anticipate that this matter can be resolved efficiently.

In the meantime, we recommend the following steps:
1. Please ensure your unit is powered off and restarted
2. Check that all connections are secure
3. Document any error codes displayed

We will follow up with you within 24 business hours with a full update. Your case reference number is #[AUTO-GENERATED].

We sincerely apologize for any inconvenience this may have caused and appreciate your patience.

Yours faithfully,
Senior Customer Support Team`,
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await request.json() as {
      original_email: string
      tone: 'professional' | 'friendly' | 'short' | 'detailed'
    }

    const { original_email, tone = 'professional' } = body

    if (!original_email?.trim()) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email content is required' } }, { status: 422, headers: CORS_HEADERS })
    }

    const admin = createAdminClient()

    // Get workspace
    const { data: memberData } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!memberData?.workspace_id) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Workspace not found' } }, { status: 404 })
    }

    // Get app id
    const { data: app } = await admin
      .from('apps')
      .select('id')
      .eq('slug', 'email-assistant')
      .single()

    const startTime = Date.now()
    let reply: string
    let tokensInput = 0
    let tokensOutput = 0
    let costUsd = 0

    const apiKey = process.env.ANTHROPIC_API_KEY

    if (apiKey) {
      // Real Anthropic API call
      const isThread = original_email.includes('--- Previous message ---')
      const prompt = isThread
        ? `You are a professional customer service representative.
The following is an email thread. Read ALL sections to fully understand the context before replying.
The FIRST section is the latest message. Sections labeled "--- Previous message ---" contain background information you must consider.
Write a ${tone} reply that addresses the full context of the conversation. Do not include a subject line. Only write the email body.
Email thread:
${original_email}`
        : `You are a professional customer service representative.
Read the entire email carefully, including any forwarded content below the main message.
Write a ${tone} reply that addresses all relevant information in the email. Do not include a subject line. Only write the email body.
Customer email:
${original_email}`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json() as {
        content: Array<{ text: string }>
        usage: { input_tokens: number; output_tokens: number }
      }

      reply = data.content[0]?.text ?? ''
      tokensInput = data.usage?.input_tokens ?? 0
      tokensOutput = data.usage?.output_tokens ?? 0
      costUsd = (tokensInput * 0.003 + tokensOutput * 0.015) / 1000
    } else {
      // Mock mode — realistic delay
      await new Promise((r) => setTimeout(r, 800))
      reply = MOCK_REPLIES[tone] ?? MOCK_REPLIES.professional ?? ''
      tokensInput = 120
      tokensOutput = 180
      costUsd = 0
    }

    const duration = Date.now() - startTime

    // Save session
    if (app?.id) {
      await admin.from('app_sessions').insert({
        workspace_id: memberData.workspace_id,
        app_id: app.id,
        user_id: user.id,
        input: { original_email, tone },
        output: { reply, tone_used: tone },
        status: 'completed',
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: costUsd,
        duration_ms: duration,
      })

      await admin.from('usage_logs').insert({
        workspace_id: memberData.workspace_id,
        user_id: user.id,
        source_type: 'app',
        app_id: app.id,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        tokens_total: tokensInput + tokensOutput,
        cost_usd: costUsd,
        duration_ms: duration,
      })
    }

    return NextResponse.json({
      success: true,
      data: { reply, tone_used: tone, mock: !apiKey },
      error: null,
      meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() },
    }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[email-assistant]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500, headers: CORS_HEADERS })
  }
}
