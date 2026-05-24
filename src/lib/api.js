import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function parseResponseBody(response) {
  const text = await response.text().catch(() => '')

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function apiRequest(path, options = {}) {
  const token = await getAccessToken()
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await parseResponseBody(response)

  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Request failed')
  }

  return data
}

export function saveSession(session) {
  localStorage.setItem('hostelhub-session', JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem('hostelhub-session')
}

export async function fetchHostels() {
  return apiRequest('/hostels')
}

export async function createHostel(payload) {
  return apiRequest('/hostels', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createBooking(payload) {
  return apiRequest('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
