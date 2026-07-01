// Thin wrapper for Flask backend API calls
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export async function api<T>(
  path: string,
  options?: {
    method?: string
    body?: any
  }
): Promise<T> {
  const url = `${API_URL}${path}`
  const response = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `API error: ${response.status}`)
  }

  return response.json()
}
