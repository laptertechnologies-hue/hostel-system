import { createClient } from '@supabase/supabase-js'

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const defaultOrigin = 'http://localhost:3000'
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null

const supabasePublic = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
  : null

function getCorsHeaders(origin) {
  const isAllowed = !allowedOrigins.length || allowedOrigins.includes(origin)
  const allowedOrigin = isAllowed ? origin || defaultOrigin : defaultOrigin

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  }
}

function jsonResponse(res, statusCode, payload, origin) {
  res.statusCode = statusCode
  Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
    res.setHeader(key, value)
  })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  if (!req.body) {
    return {}
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body)
  }

  return req.body
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
    email: user.email,
    role: user.user_metadata?.role || 'student',
    university: user.user_metadata?.university || null,
    phone: user.phone || null,
  }
}

function parsePriceCents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }

  if (typeof value === 'string') {
    const numeric = Number(String(value).replace(/[^0-9.]/g, ''))

    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.round(numeric * 100))
    }
  }

  return 0
}

function requireSupabaseRuntime(origin, res) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    jsonResponse(res, 503, {
      message: 'Supabase is not configured yet. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel to enable auth and bookings.',
    }, origin)
    return false
  }

  return true
}

async function authenticateRequest(req) {
  const authHeader = req.headers.authorization || ''

  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  if (!supabasePublic) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  supabasePublic.auth.setAuth(token)

  const { data, error } = await supabasePublic.auth.getUser()

  if (error || !data.user) {
    return null
  }

  return data.user
}

async function getHostelsFromDb() {
  const { data, error } = await supabaseAdmin
    .from('hostels')
    .select('id,name,location,area,university,description,price_cents,status,image_url')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data || []).map((hostel) => ({
    id: hostel.id,
    name: hostel.name,
    location: hostel.location,
    area: hostel.area,
    university: hostel.university,
    description: hostel.description,
    price: `$${(hostel.price_cents / 100).toFixed(0)}/month`,
    status: hostel.status,
    image_url: hostel.image_url,
  }))
}

async function createHostelRecord(ownerId, payload) {
  const { data, error } = await supabaseAdmin
    .from('hostels')
    .insert([
      {
        owner_id: ownerId,
        name: payload.name,
        location: payload.location,
        area: payload.area || null,
        university: payload.university,
        description: payload.description,
        price_cents: parsePriceCents(payload.price),
        image_url: payload.image_url || null,
        status: payload.status || 'available',
      },
    ])
    .select('id,name,location,area,university,description,price_cents,status,image_url')
    .single()

  if (error) {
    throw error
  }

  return {
    id: data.id,
    name: data.name,
    location: data.location,
    area: data.area,
    university: data.university,
    description: data.description,
    price: `$${(data.price_cents / 100).toFixed(0)}/month`,
    status: data.status,
    image_url: data.image_url,
  }
}

async function createBookingRecord(userId, payload) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .insert([
      {
        user_id: userId,
        hostel_id: payload.hostelId,
        booking_status: payload.bookingStatus || 'pending',
        notes: payload.notes || null,
      },
    ])
    .select('id,user_id,hostel_id,booking_status,notes,created_at')
    .single()

  if (error) {
    throw error
  }

  return {
    id: data.id,
    userId: data.user_id,
    hostelId: data.hostel_id,
    bookingStatus: data.booking_status,
    notes: data.notes,
    createdAt: data.created_at,
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || defaultOrigin

  if (req.method === 'OPTIONS') {
    return jsonResponse(res, 204, {}, origin)
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`)
    const path = url.pathname

    if (path === '/api/health') {
      return jsonResponse(res, 200, { status: 'ok', service: 'hostelhub-api' }, origin)
    }

    if (!requireSupabaseRuntime(origin, res)) {
      return
    }

    if (path === '/api/hostels' && req.method === 'GET') {
      const hostels = await getHostelsFromDb()
      return jsonResponse(res, 200, { hostels }, origin)
    }

    if (path === '/api/hostels' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const authUser = await authenticateRequest(req)

      if (!authUser) {
        return jsonResponse(res, 401, { message: 'Authentication is required to add a hostel.' }, origin)
      }

      const role = authUser.user_metadata?.role || 'student'

      if (role !== 'owner' && role !== 'admin') {
        return jsonResponse(res, 403, { message: 'Only hostel owners and admins can add hostels.' }, origin)
      }

      if (!body.name || !body.location || !body.university || !body.description) {
        return jsonResponse(res, 400, { message: 'Hostel name, location, university, and description are required.' }, origin)
      }

      const createdHostel = await createHostelRecord(authUser.id, body)
      return jsonResponse(res, 201, createdHostel, origin)
    }

    if (path === '/api/bookings' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const authUser = await authenticateRequest(req)

      if (!authUser) {
        return jsonResponse(res, 401, { message: 'Authentication is required to create a booking.' }, origin)
      }

      if ((authUser.user_metadata?.role || 'student') !== 'student') {
        return jsonResponse(res, 403, { message: 'Only students can create bookings.' }, origin)
      }

      if (!body.hostelId) {
        return jsonResponse(res, 400, { message: 'A hostelId is required to create a booking.' }, origin)
      }

      const booking = await createBookingRecord(authUser.id, body)
      return jsonResponse(res, 201, booking, origin)
    }

    return jsonResponse(res, 404, { message: 'Route not found.' }, origin)
  } catch (error) {
    const message = error?.message || 'Unexpected error.'
    return jsonResponse(res, 500, { message }, origin)
  }
}
