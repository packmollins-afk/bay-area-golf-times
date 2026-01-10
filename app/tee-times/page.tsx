import { createClient } from "@/lib/supabase/server"
import { TeeTimesClient } from "@/components/tee-times-client"

export const metadata = {
  title: "Find Tee Times | Bay Area Golf Times",
  description: "Search and book tee times at Bay Area golf courses",
}

async function getRegions(): Promise<string[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/regions`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return ["San Francisco", "South Bay", "East Bay", "North Bay"]
    return res.json()
  } catch {
    return ["San Francisco", "South Bay", "East Bay", "North Bay"]
  }
}

async function getUserFavorites(userId: string | null): Promise<string[]> {
  if (!userId) return []
  try {
    const supabase = await createClient()
    const { data } = await supabase.from("favorites").select("course_slug").eq("user_id", userId)
    return data?.map((f) => f.course_slug) || []
  } catch {
    return []
  }
}

export default async function TeeTimesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [regions, favorites] = await Promise.all([getRegions(), getUserFavorites(user?.id || null)])

  return (
    <TeeTimesClient
      regions={regions}
      initialFavorites={favorites}
      user={user ? { id: user.id, email: user.email || "" } : null}
    />
  )
}
