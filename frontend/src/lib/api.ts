// Thin wrapper for Flask backend API calls
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

console.log('[API] Using base URL:', API_URL)

export async function api<T>(
  path: string,
  options?: {
    method?: string
    body?: any
  }
): Promise<T> {
  const url = `${API_URL}${path}`

  try {
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      const contentType = response.headers.get('content-type')
      let error = `API error: ${response.status}`

      if (contentType?.includes('application/json')) {
        try {
          const errorData = await response.json()
          error = errorData.error || error
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      console.error(`[API] ${response.status} ${path}:`, error)
      throw new Error(error)
    }

    return response.json()
  } catch (error) {
    console.error(`[API] Request failed for ${path}:`, error)
    throw error
  }
}
