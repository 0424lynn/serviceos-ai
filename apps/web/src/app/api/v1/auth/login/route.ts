import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email: string; password: string }
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password required' } }, { status: 422 })
    }

    // Use Supabase REST API to sign in
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey!,
      },
      body: JSON.stringify({ email, password }),
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
        error: { code: 'UNAUTHORIZED', message: data.error_description ?? 'Invalid login credentials' }
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        }
      },
      error: null,
      meta: { request_id: crypto.randomUUID(), timestamp: new Date().toISOString() },
    })
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, { status: 500 })
  }
}
