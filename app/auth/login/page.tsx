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
import { AlertCircle, Loader2, ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const getErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes("Invalid login credentials")) {
      return "Incorrect email or password. Please try again."
    }
    if (errorMessage.includes("Email not confirmed")) {
      return "Please check your email and click the confirmation link to activate your account."
    }
    if (errorMessage.includes("Too many requests")) {
      return "Too many login attempts. Please wait a few minutes and try again."
    }
    return errorMessage
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(getErrorMessage(error.message))
      setLoading(false)
    } else {
      router.push("/tee-times")
      router.refresh()
    }
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
          <CardTitle className="text-2xl font-serif text-[#3d2914]">Welcome Back</CardTitle>
          <CardDescription className="text-[#6b5344]">Sign in to access your favorites and bookings</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-100 rounded-md">
                <AlertCircle className="h-4 w-4" />
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[#3d2914]">
                  Password
                </Label>
                <Link href="/auth/forgot-password" className="text-sm text-[#2d5a27] hover:underline">
                  Forgot password?
                </Link>
              </div>
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
            <p className="text-sm text-center text-[#6b5344]">
              Don&apos;t have an account?{" "}
              <Link href="/auth/sign-up" className="text-[#2d5a27] hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
