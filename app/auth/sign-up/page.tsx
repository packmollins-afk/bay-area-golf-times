"use client"

import type React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, ArrowLeft, Mail } from "lucide-react"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const getErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes("User already registered")) {
      return "An account with this email already exists. Try signing in instead."
    }
    if (errorMessage.includes("Password should be")) {
      return "Password must be at least 6 characters long."
    }
    if (errorMessage.includes("Invalid email")) {
      return "Please enter a valid email address."
    }
    if (errorMessage.includes("rate limit")) {
      return "Too many signup attempts. Please wait a few minutes and try again."
    }
    return errorMessage
  }

  const handleSignUp = async (e: React.FormEvent) => {
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/tee-times`,
      },
    })

    if (error) {
      setError(getErrorMessage(error.message))
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
            <div className="mx-auto w-16 h-16 bg-[#2d5a27]/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-[#2d5a27]" />
            </div>
            <CardTitle className="text-2xl font-serif text-[#3d2914]">Check Your Inbox</CardTitle>
            <CardDescription className="text-[#6b5344] space-y-2">
              <p>We sent a confirmation email to:</p>
              <p className="font-medium text-[#3d2914]">{email}</p>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-[#f4f1e8] rounded-lg p-4 space-y-2">
              <p className="text-sm text-[#6b5344]">
                <strong className="text-[#3d2914]">Next steps:</strong>
              </p>
              <ol className="text-sm text-[#6b5344] list-decimal list-inside space-y-1">
                <li>Open the email from Bay Area Golf Times</li>
                <li>Click the confirmation link</li>
                <li>Start booking tee times!</li>
              </ol>
            </div>
            <p className="text-xs text-[#6b5344] text-center">
              Didn&apos;t receive the email? Check your spam folder or{" "}
              <button
                onClick={() => {
                  setSuccess(false)
                  setEmail("")
                  setPassword("")
                  setConfirmPassword("")
                }}
                className="text-[#2d5a27] hover:underline font-medium"
              >
                try again
              </button>
            </p>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => router.push("/auth/login")}
              variant="outline"
              className="w-full border-[#c4a882] text-[#3d2914] hover:bg-[#f4f1e8]"
            >
              Back to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1e8] px-4">
      <Link
        href="/tee-times"
        className="absolute top-4 left-4 flex items-center gap-2 text-[#3d2914] hover:text-[#2d5a27] transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="hidden sm:inline">Back to Tee Times</span>
      </Link>

      <Card className="w-full max-w-md border-[#c4a882] bg-[#fffef9]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif text-[#3d2914]">Create Account</CardTitle>
          <CardDescription className="text-[#6b5344]">
            Sign up to save your favorite courses and track bookings
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#3d2914]">
                Password
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
                Confirm Password
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
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
            <p className="text-sm text-center text-[#6b5344]">
              Already have an account?{" "}
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
