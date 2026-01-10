"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check if user has a valid session from the reset link
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsValidSession(!!session)
    }
    checkSession()
  }, [supabase.auth])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
        <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#2d5a27] mx-auto" />
            <p className="mt-4 text-[#6b5344]">Verifying your reset link...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Invalid or expired session
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
        <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-serif text-[#3d2914]">Invalid or Expired Link</CardTitle>
            <CardDescription className="text-[#6b5344]">
              This password reset link is invalid or has expired. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white">
              <Link href="/auth/forgot-password">Request New Link</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
        <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-[#2d5a27]/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-[#2d5a27]" />
            </div>
            <CardTitle className="text-2xl font-serif text-[#3d2914]">Password Updated</CardTitle>
            <CardDescription className="text-[#6b5344]">
              Your password has been successfully updated. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => router.push("/tee-times")}
              className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white"
            >
              Continue to Tee Times
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
      <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif text-[#3d2914]">Set New Password</CardTitle>
          <CardDescription className="text-[#6b5344]">Enter your new password below</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdatePassword}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-100 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#3d2914]">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#c4a882] focus:border-[#2d5a27] focus:ring-[#2d5a27]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#3d2914]">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-[#c4a882] focus:border-[#2d5a27] focus:ring-[#2d5a27]"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
