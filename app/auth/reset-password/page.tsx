"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  useEffect(() => {
    // Verify the reset token on page load
    const verifyToken = async () => {
      if (!token) {
        setVerifying(false)
        return
      }

      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${token}`)
        const data = await res.json()

        if (data.valid) {
          setTokenValid(true)
          setUserEmail(data.email)
        } else {
          setError(data.error || "Invalid or expired reset link")
        }
      } catch (err) {
        setError("Failed to verify reset link")
      } finally {
        setVerifying(false)
      }
    }

    verifyToken()
  }, [token])

  const handleResetPassword = async (e: React.FormEvent) => {
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

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to reset password")
        setLoading(false)
        return
      }

      // Store the auth token if provided
      if (data.token) {
        localStorage.setItem("auth_token", data.token)
      }

      setSuccess(true)
      setLoading(false)
    } catch (err) {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  // Loading state while verifying token
  if (verifying) {
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

  // Invalid or missing token
  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
        <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-serif text-[#3d2914]">Invalid or Expired Link</CardTitle>
            <CardDescription className="text-[#6b5344]">
              {error || "This password reset link is invalid or has expired. Please request a new one."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button asChild className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white">
              <Link href="/auth/forgot-password">Request New Link</Link>
            </Button>
            <Link href="/auth/login" className="text-sm text-center text-[#2d5a27] hover:underline">
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
        <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-[#2d5a27]/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-[#2d5a27]" />
            </div>
            <CardTitle className="text-2xl font-serif text-[#3d2914]">Password Updated!</CardTitle>
            <CardDescription className="text-[#6b5344]">
              Your password has been successfully reset. You&apos;re now signed in and ready to find your next tee time.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => router.push("/tee-times")}
              className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white"
            >
              Find Tee Times
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Reset password form
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
      <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif text-[#3d2914]">Set New Password</CardTitle>
          <CardDescription className="text-[#6b5344]">
            {userEmail && (
              <>
                Creating new password for <strong>{userEmail}</strong>
              </>
            )}
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
              <Label htmlFor="password" className="text-[#3d2914]">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-[#c4a882] focus:border-[#2d5a27] focus:ring-[#2d5a27] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5344] hover:text-[#3d2914]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#3d2914]">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-[#c4a882] focus:border-[#2d5a27] focus:ring-[#2d5a27]"
              />
            </div>

            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  <div className={`h-1 flex-1 rounded ${password.length >= 6 ? "bg-[#2d5a27]" : "bg-gray-200"}`} />
                  <div className={`h-1 flex-1 rounded ${password.length >= 8 ? "bg-[#2d5a27]" : "bg-gray-200"}`} />
                  <div className={`h-1 flex-1 rounded ${password.length >= 12 ? "bg-[#2d5a27]" : "bg-gray-200"}`} />
                </div>
                <p className="text-xs text-[#6b5344]">
                  {password.length < 6 ? "Too short" : password.length < 8 ? "Good" : password.length < 12 ? "Strong" : "Very strong"}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
            <Link href="/auth/login" className="text-sm text-center text-[#2d5a27] hover:underline">
              Back to Sign In
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
