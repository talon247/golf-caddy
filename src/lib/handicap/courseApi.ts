// GolfCourseAPI.com client
// Docs: https://golfcourseapi.com
// API key from VITE_GOLF_COURSE_API_KEY env var

const BASE_URL = 'https://api.golfcourseapi.com/v1'

function getApiKey(): string {
  return (import.meta.env.VITE_GOLF_COURSE_API_KEY as string | undefined) ?? ''
}

// ── Types matching the actual API response ────────────────────────────────

export interface GolfApiCourse {
  id: number          // API returns numeric id
  club_name: string
  course_name: string
  location: {
    city: string
    state: string
    country: string
  }
}

export interface TeeSet {
  tee_name: string
  course_rating: number
  slope_rating: number
  number_of_holes: number
  total_yards?: number
  par_total?: number
}

export interface GolfApiCourseDetails {
  id: number
  club_name: string
  course_name: string
  location: {
    city: string
    state: string
    country: string
  }
  tees: {
    male: TeeSet[]
    female: TeeSet[]
  }
}

// ── Search ────────────────────────────────────────────────────────────────

export async function searchCourses(
  query: string,
  signal?: AbortSignal,
): Promise<GolfApiCourse[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []
  if (query.trim().length < 2) return []

  const url = `${BASE_URL}/search?search_query=${encodeURIComponent(query.trim())}`
  const res = await fetch(url, {
    headers: { Authorization: `Key ${apiKey}` },
    signal,
  })

  if (res.status === 429) throw new Error('rate_limit')
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`search_error_${res.status}`)

  const data = await res.json() as { courses?: GolfApiCourse[] }
  return data.courses ?? []
}

// ── Course Details (with tee sets) ────────────────────────────────────────

export async function getCourseDetails(
  courseId: number | string,
  signal?: AbortSignal,
): Promise<GolfApiCourseDetails> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('no_api_key')

  const url = `${BASE_URL}/courses/${encodeURIComponent(String(courseId))}`
  const res = await fetch(url, {
    headers: { Authorization: `Key ${apiKey}` },
    signal,
  })

  if (res.status === 404) throw new Error('not_found')
  if (res.status === 429) throw new Error('rate_limit')
  if (!res.ok) throw new Error(`fetch_error_${res.status}`)

  const data = await res.json() as { course?: GolfApiCourseDetails } | GolfApiCourseDetails
  // API wraps response in { course: ... }
  return ('course' in data && data.course) ? data.course : data as GolfApiCourseDetails
}

