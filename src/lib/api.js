const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export function getStoredSession() {
  try {
    const raw = localStorage.getItem('hostelhub-session')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function apiRequest(path, options = {}) {
  const session = getStoredSession()
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed')
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

export async function loginUser(payload) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function registerUser(payload) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function googleSignIn(credential) {
  return apiRequest('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  })
}
