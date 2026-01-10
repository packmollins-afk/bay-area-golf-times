"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2, ArrowLeft } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
        ? `${process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL}/auth/update-password`
        : `${window.location.origin}/auth/update-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
        <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-[#2d5a27]/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-[#2d5a27]" />
            </div>
            <CardTitle className="text-2xl font-serif text-[#3d2914]">Check Your Email</CardTitle>
            <CardDescription className="text-[#6b5344]">
              We&apos;ve sent a password reset link to <strong>{email}</strong>. Click the link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button
              onClick={() => setSuccess(false)}
              variant="outline"
              className="w-full border-[#c4a882] text-[#3d2914] hover:bg-[#f4f1e8]"
            >
              Try a different email
            </Button>
            <Link href="/auth/login" className="text-sm text-center text-[#2d5a27] hover:underline">
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
      <Link
        href="/auth/login"
        className="absolute top-4 left-4 flex items-center gap-2 text-[#3d2914] hover:text-[#2d5a27] transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="hidden sm:inline">Back to Sign In</span>
      </Link>

      <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif text-[#3d2914]">Reset Password</CardTitle>
          <CardDescription className="text-[#6b5344]">
            Enter your email and we&apos;ll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleResetPassword}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-100 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#3d2914]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[#c4a882] focus:border-[#2d5a27] focus:ring-[#2d5a27]"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
            <p className="text-sm text-center text-[#6b5344]">
              Remember your password?{" "}
              <Link href="/auth/login" className="text-[#2d5a27] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
