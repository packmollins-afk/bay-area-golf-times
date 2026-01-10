"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  MapPin,
  Users,
  Heart,
  ArrowUpDown,
  Filter,
  LogOut,
  User,
  X,
  ChevronDown,
  Star,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface TeeTime {
  id: number
  course_id: number
  course_name: string
  city: string
  region: string
  date: string
  time: string
  datetime: string
  holes: number
  players: number
  price: number
  original_price?: number
  has_cart: number
  booking_url: string
  avg_rating?: number
  course_slug?: string
}

interface TeeTimesClientProps {
  regions: string[]
  initialFavorites: string[]
  user: { id: string; email: string } | null
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":")
  const hour = Number.parseInt(hours)
  const ampm = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function getNextDays(count: number): { value: string; label: string }[] {
  const days = []
  for (let i = 0; i < count; i++) {
    const date = new Date()
    date.setDate(date.getDate() + i)
    const value = date.toISOString().split("T")[0]
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDate(value)
    days.push({ value, label })
  }
  return days
}

export function TeeTimesClient({ regions, initialFavorites, user }: TeeTimesClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  // Filter state
  const [selectedRegion, setSelectedRegion] = useState<string>(regions[0] || "San Francisco")
  const [selectedDate, setSelectedDate] = useState<string>(getNextDays(1)[0].value)
  const [minTime, setMinTime] = useState<string>("06:00")
  const [maxTime, setMaxTime] = useState<string>("18:00")
  const [maxPrice, setMaxPrice] = useState<number>(200)
  const [players, setPlayers] = useState<string>("any")
  const [holes, setHoles] = useState<string>("any")
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  // Sort state
  const [sortBy, setSortBy] = useState<string>("datetime")
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC")

  // Favorites state
  const [favorites, setFavorites] = useState<Set<string>>(new Set(initialFavorites))
  const [favoritesLoading, setFavoritesLoading] = useState<Set<string>>(new Set())

  // Mobile filter sheet
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && filterOpen) {
        setFilterOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filterOpen])

  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams({
      region: selectedRegion,
      date: selectedDate,
      min_time: minTime,
      max_time: maxTime,
      max_price: maxPrice.toString(),
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: "100",
    })
    if (players !== "any") params.set("players", players)
    if (holes !== "any") params.set("holes", holes)
    return `/api/tee-times?${params.toString()}`
  }, [selectedRegion, selectedDate, minTime, maxTime, maxPrice, players, holes, sortBy, sortOrder])

  const { data: teeTimes, error, isLoading } = useSWR<TeeTime[]>(buildApiUrl(), fetcher, { revalidateOnFocus: false })

  // Filter by favorites if needed
  const filteredTeeTimes =
    showFavoritesOnly && teeTimes
      ? teeTimes.filter((tt) => favorites.has(tt.course_slug || tt.course_name.toLowerCase().replace(/\s+/g, "-")))
      : teeTimes

  const toggleFavorite = async (courseSlug: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Create an account to save your favorite courses.",
        variant: "default",
      })
      router.push("/auth/login")
      return
    }

    setFavoritesLoading((prev) => new Set(prev).add(courseSlug))

    const newFavorites = new Set(favorites)
    const isFavorite = favorites.has(courseSlug)

    try {
      if (isFavorite) {
        newFavorites.delete(courseSlug)
        await supabase.from("favorites").delete().eq("user_id", user.id).eq("course_slug", courseSlug)
        toast({
          title: "Removed from favorites",
          description: "Course removed from your favorites.",
        })
      } else {
        newFavorites.add(courseSlug)
        await supabase.from("favorites").insert({ user_id: user.id, course_slug: courseSlug })
        toast({
          title: "Added to favorites",
          description: "Course saved to your favorites.",
        })
      }
      setFavorites(newFavorites)
    } catch (err) {
      console.error("Failed to toggle favorite:", err)
      toast({
        title: "Something went wrong",
        description: "Could not update favorites. Please try again.",
        variant: "destructive",
      })
    } finally {
      setFavoritesLoading((prev) => {
        const next = new Set(prev)
        next.delete(courseSlug)
        return next
      })
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    })
    router.push("/auth/login")
    router.refresh()
  }

  const days = getNextDays(7)

  const handleFilterChange = (setter: (value: any) => void, value: any) => {
    setter(value)
  }

  const FilterControls = () => (
    <div className="space-y-6">
      {/* Region */}
      <div className="space-y-2">
        <Label className="text-[#3d2914] font-medium">Region</Label>
        <Select value={selectedRegion} onValueChange={(v) => handleFilterChange(setSelectedRegion, v)}>
          <SelectTrigger className="border-[#c4a882] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label className="text-[#3d2914] font-medium">Date</Label>
        <Select value={selectedDate} onValueChange={(v) => handleFilterChange(setSelectedDate, v)}>
          <SelectTrigger className="border-[#c4a882] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days.map((day) => (
              <SelectItem key={day.value} value={day.value}>
                {day.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Time Range */}
      <div className="space-y-2">
        <Label className="text-[#3d2914] font-medium">Time Range</Label>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={minTime}
            onChange={(e) => handleFilterChange(setMinTime, e.target.value)}
            className="border-[#c4a882] bg-white flex-1"
          />
          <span className="text-[#6b5344]">to</span>
          <Input
            type="time"
            value={maxTime}
            onChange={(e) => handleFilterChange(setMaxTime, e.target.value)}
            className="border-[#c4a882] bg-white flex-1"
          />
        </div>
      </div>

      {/* Max Price */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[#3d2914] font-medium">Max Price</Label>
          <span className="text-sm font-medium text-[#2d5a27]">${maxPrice}</span>
        </div>
        <Slider
          value={[maxPrice]}
          onValueChange={(v) => handleFilterChange(setMaxPrice, v[0])}
          min={20}
          max={300}
          step={10}
          className="py-2"
        />
      </div>

      {/* Players */}
      <div className="space-y-2">
        <Label className="text-[#3d2914] font-medium">Players</Label>
        <Select value={players} onValueChange={(v) => handleFilterChange(setPlayers, v)}>
          <SelectTrigger className="border-[#c4a882] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="1">1+</SelectItem>
            <SelectItem value="2">2+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Holes */}
      <div className="space-y-2">
        <Label className="text-[#3d2914] font-medium">Holes</Label>
        <Select value={holes} onValueChange={(v) => handleFilterChange(setHoles, v)}>
          <SelectTrigger className="border-[#c4a882] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="9">9 holes</SelectItem>
            <SelectItem value="18">18 holes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Favorites only */}
      {user && (
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(setShowFavoritesOnly, !showFavoritesOnly)}
            className={
              showFavoritesOnly ? "bg-[#2d5a27] hover:bg-[#1a3d17] text-white" : "border-[#c4a882] text-[#3d2914]"
            }
          >
            <Heart className={`h-4 w-4 mr-1 ${showFavoritesOnly ? "fill-current" : ""}`} />
            Favorites only
          </Button>
        </div>
      )}

      <div className="lg:hidden pt-4 border-t border-[#c4a882]">
        <Button onClick={() => setFilterOpen(false)} className="w-full bg-[#2d5a27] hover:bg-[#1a3d17] text-white">
          Apply Filters
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f4f1e8]">
      {/* Header */}
      <header className="bg-[#2d5a27] text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-lg">⛳</span>
            </div>
            <span className="font-serif text-xl hidden sm:inline">Bay Area Golf Times</span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                    <User className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline max-w-[150px] truncate">{user.email}</span>
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="bg-[#fffef9] rounded-lg border border-[#c4a882] p-6 sticky top-24">
              <h2 className="font-serif text-xl text-[#3d2914] mb-6 flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </h2>
              <FilterControls />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile Filter Button */}
            <div className="lg:hidden mb-4">
              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full border-[#c4a882] text-[#3d2914] bg-white">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 bg-[#fffef9]">
                  <SheetHeader>
                    <SheetTitle className="font-serif text-[#3d2914]">Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterControls />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Results Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-serif text-2xl text-[#3d2914]">Tee Times in {selectedRegion}</h1>
                <p className="text-[#6b5344] text-sm mt-1">
                  {formatDate(selectedDate)} • {filteredTeeTimes?.length || 0} available
                </p>
              </div>

              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-36 border-[#c4a882] bg-white">
                    <ArrowUpDown className="h-4 w-4 mr-2 text-[#6b5344]" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="datetime">Time</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="course_name">Course</SelectItem>
                    <SelectItem value="avg_rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC")}
                  className="border-[#c4a882] bg-white"
                >
                  <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === "DESC" ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Active Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              {maxPrice < 200 && (
                <Badge variant="secondary" className="bg-[#2d5a27]/10 text-[#2d5a27]">
                  Under ${maxPrice}
                  <button onClick={() => setMaxPrice(200)} className="ml-1 hover:text-[#1a3d17]">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {players !== "any" && (
                <Badge variant="secondary" className="bg-[#2d5a27]/10 text-[#2d5a27]">
                  {players}+ players
                  <button onClick={() => setPlayers("any")} className="ml-1 hover:text-[#1a3d17]">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {holes !== "any" && (
                <Badge variant="secondary" className="bg-[#2d5a27]/10 text-[#2d5a27]">
                  {holes} holes
                  <button onClick={() => setHoles("any")} className="ml-1 hover:text-[#1a3d17]">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {showFavoritesOnly && (
                <Badge variant="secondary" className="bg-[#2d5a27]/10 text-[#2d5a27]">
                  Favorites only
                  <button onClick={() => setShowFavoritesOnly(false)} className="ml-1 hover:text-[#1a3d17]">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>

            {/* Results */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="border-[#c4a882] bg-[#fffef9]">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <Skeleton className="h-20 w-20 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card className="border-[#c4a882] bg-[#fffef9]">
                <CardContent className="p-8 text-center">
                  <p className="text-[#6b5344]">Unable to load tee times. Please try again.</p>
                </CardContent>
              </Card>
            ) : filteredTeeTimes?.length === 0 ? (
              <Card className="border-[#c4a882] bg-[#fffef9]">
                <CardContent className="p-8 text-center">
                  <p className="text-[#6b5344]">No tee times found matching your filters.</p>
                  <Button
                    variant="outline"
                    className="mt-4 border-[#c4a882] text-[#3d2914] bg-white"
                    onClick={() => {
                      setMaxPrice(200)
                      setPlayers("any")
                      setHoles("any")
                      setShowFavoritesOnly(false)
                    }}
                  >
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTeeTimes?.map((teeTime) => {
                  const courseSlug = teeTime.course_slug || teeTime.course_name.toLowerCase().replace(/\s+/g, "-")
                  const isFavorite = favorites.has(courseSlug)
                  const isFavoriteLoading = favoritesLoading.has(courseSlug)

                  return (
                    <Card
                      key={teeTime.id}
                      className="border-[#c4a882] bg-[#fffef9] hover:border-[#2d5a27] transition-colors"
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Time & Price */}
                          <div className="flex items-center gap-4 sm:w-32">
                            <div className="text-center">
                              <div className="text-xl font-semibold text-[#3d2914]">{formatTime(teeTime.time)}</div>
                              <div className="text-xs text-[#6b5344]">{teeTime.holes} holes</div>
                            </div>
                          </div>

                          {/* Course Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-medium text-[#3d2914] truncate">{teeTime.course_name}</h3>
                                <div className="flex items-center gap-3 text-sm text-[#6b5344] mt-1">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {teeTime.city}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {teeTime.players} spots
                                  </span>
                                  {teeTime.avg_rating && (
                                    <span className="flex items-center gap-1">
                                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                      {teeTime.avg_rating.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => toggleFavorite(courseSlug)}
                                disabled={isFavoriteLoading}
                                className="p-2 rounded-full hover:bg-[#f4f1e8] transition-colors disabled:opacity-50"
                              >
                                {isFavoriteLoading ? (
                                  <Loader2 className="h-5 w-5 animate-spin text-[#c4a882]" />
                                ) : (
                                  <Heart
                                    className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-[#c4a882]"}`}
                                  />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Price & Book */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 sm:w-40">
                            <div className="text-right">
                              <div className="text-xl font-semibold text-[#2d5a27]">${teeTime.price}</div>
                              {teeTime.original_price && teeTime.original_price > teeTime.price && (
                                <div className="text-xs text-[#6b5344] line-through">${teeTime.original_price}</div>
                              )}
                              {teeTime.has_cart === 1 && <div className="text-xs text-[#6b5344]">incl. cart</div>}
                            </div>
                            <Button asChild size="sm" className="bg-[#2d5a27] hover:bg-[#1a3d17] text-white">
                              <a href={teeTime.booking_url} target="_blank" rel="noopener noreferrer">
                                Book
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
