// GolfCourseAPI.com client
// API key from VITE_GOLF_COURSE_API_KEY env var
// Field names based on THEA-87 API findings

const BASE_URL = 'https://api.golfcourseapi.com/v1'

function getApiKey(): string {
  return (import.meta.env.VITE_GOLF_COURSE_API_KEY as string | undefined) ?? ''
}

export interface GolfApiCourse {
  id: string
  club_name: string
  course_name: string
  city: string
  state_name: string
}

export interface TeeSet {
  tee_name: string
  course_rating: number
  slope_rating: number
  number_of_holes: number
}

export interface GolfApiCourseDetails {
  id: string
  club_name: string
  course_name: string
  city: string
  state_name: string
  tee_sets: TeeSet[]
}

interface SearchResponse {
  courses: GolfApiCourse[]
}

export async function searchCourses(
  query: string,
  signal?: AbortSignal,
): Promise<GolfApiCourse[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []

  const url = `${BASE_URL}/courses?search=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { Authorization: `Key ${apiKey}` },
    signal,
  })

  if (res.status === 429) throw new Error('rate_limit')
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`search_error_${res.status}`)

  const data = (await res.json()) as SearchResponse
  return data.courses ?? []
}

export async function getCourseDetails(
  courseId: string,
  signal?: AbortSignal,
): Promise<GolfApiCourseDetails> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('no_api_key')

  const url = `${BASE_URL}/courses/${encodeURIComponent(courseId)}`
  const res = await fetch(url, {
    headers: { Authorization: `Key ${apiKey}` },
    signal,
  })

  if (res.status === 404) throw new Error('not_found')
  if (res.status === 429) throw new Error('rate_limit')
  if (!res.ok) throw new Error(`fetch_error_${res.status}`)

  return res.json() as Promise<GolfApiCourseDetails>
}
