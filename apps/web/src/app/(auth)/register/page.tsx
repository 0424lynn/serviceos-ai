'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface FormState {
  name: string
  email: string
  password: string
  confirmPassword: string
  workspaceName: string
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  workspaceName?: string
  general?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    workspaceName: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  function validate(): boolean {
    const next: FormErrors = {}

    if (!form.name.trim()) next.name = 'Name is required'
    if (!form.email.trim()) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Enter a valid email address'
    if (!form.password) next.password = 'Password is required'
    else if (form.password.length < 8)
      next.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword)
      next.confirmPassword = 'Passwords do not match'
    if (!form.workspaceName.trim())
      next.workspaceName = 'Company name is required'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setErrors({})

    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { name: form.name.trim() },
        },
      })

      if (authError) {
        setErrors({ general: authError.message })
        return
      }

      if (!authData.user) {
        setErrors({ general: 'Registration failed. Please try again.' })
        return
      }

      // 2. Create workspace + member via API route
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.user.id,
          name: form.name.trim(),
          email: form.email.trim(),
          workspaceName: form.workspaceName.trim(),
        }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: { message?: string } }
        setErrors({ general: body.error?.message ?? 'Setup failed. Please try again.' })
        return
      }

      router.push('/dashboard')
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  function update(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Start your free trial. No credit card required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {errors.general && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {errors.general}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Chris Lee"
              autoComplete="name"
              value={form.name}
              onChange={update('name')}
              disabled={loading}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="chris@company.com"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              disabled={loading}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p id="email-error" className="text-xs text-red-600">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspaceName">Company name</Label>
            <Input
              id="workspaceName"
              type="text"
              placeholder="Acme Service Co"
              autoComplete="organization"
              value={form.workspaceName}
              onChange={update('workspaceName')}
              disabled={loading}
              aria-describedby={errors.workspaceName ? 'workspace-error' : undefined}
            />
            {errors.workspaceName && (
              <p id="workspace-error" className="text-xs text-red-600">{errors.workspaceName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              disabled={loading}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && (
              <p id="password-error" className="text-xs text-red-600">{errors.password}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              disabled={loading}
              aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
            />
            {errors.confirmPassword && (
              <p id="confirm-error" className="text-xs text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full text-white"
            style={{ background: 'var(--brand)' }}
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create free account'}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium" style={{ color: 'var(--brand)' }}>
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
