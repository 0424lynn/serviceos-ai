import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { refresh_token: string }
    const { refresh_token } = body

    if (!refresh_token) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'refresh_token required' } }, { status: 422, headers: CORS_HEADERS })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': anonKey! },
      body: JSON.stringify({ refresh_token }),
    })

    const data = await res.json() as {
      access_token?: string
      refresh_token?: string
      error?: string
      error_description?: string
    }

    if (!res.ok || !data.access_token) {
      return NextResponse.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: data.error_description ?? 'Session expired' }
      }, { status: 401, headers: CORS_HEADERS })
    }

    return NextResponse.json({
      success: true,
      data: { session: { access_token: data.access_token, refresh_token: data.refresh_token } },
      error: null,
    }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[refresh]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500, headers: CORS_HEADERS })
  }
}
