import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import pkg from 'pg'

const { Pool } = pkg

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const defaultOrigin = 'http://localhost:3000'
const dbConfigured = Boolean(process.env.DATABASE_URL)
const jwtConfigured = Boolean(process.env.JWT_SECRET)
const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID)
const adminEmail = process.env.ADMIN_EMAIL?.trim()
const adminPassword = process.env.ADMIN_PASSWORD?.trim()
const adminConfigured = Boolean(adminEmail && adminPassword)

let pool
let schemaReady = false

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    })
  }

  return pool
}

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
    name: user.name,
    email: user.email,
    role: user.role,
    university: user.university,
    phone: user.phone,
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

function requireDbRuntime(origin, res) {
  if (!dbConfigured) {
    jsonResponse(res, 503, {
      message: 'The live database is not configured yet. Set DATABASE_URL in Vercel to enable hostel listings, login, and booking.',
    }, origin)
    return false
  }

  return true
}

function requireJwtRuntime(origin, res) {
  if (!jwtConfigured) {
    jsonResponse(res, 503, {
      message: 'JWT_SECRET is not configured. Set it in Vercel to enable authentication.',
    }, origin)
    return false
  }

  return true
}

function requireGoogleRuntime(origin, res) {
  if (!googleConfigured) {
    jsonResponse(res, 503, {
      message: 'GOOGLE_CLIENT_ID is not configured. Set it in Vercel to enable Google Sign-In.',
    }, origin)
    return false
  }

  return true
}

function getAdminUser() {
  if (!adminConfigured) {
    return null
  }

  return {
    id: 'admin-env',
    name: 'Admin',
    email: adminEmail,
    role: 'admin',
    university: null,
    phone: null,
  }
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  )
}

function authenticateRequest(req) {
  const authHeader = req.headers.authorization || ''

  if (!authHeader.startsWith('Bearer ')) {
    return null
  }

  try {
    const token = authHeader.replace('Bearer ', '')
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

async function ensureSchema() {
  if (schemaReady || !dbConfigured) {
    return
  }

  const client = await getPool().connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name STRING NOT NULL,
        email STRING NOT NULL UNIQUE,
        password_hash STRING,
        google_id STRING UNIQUE,
        role STRING NOT NULL DEFAULT 'student',
        university STRING,
        phone STRING,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS hostels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID REFERENCES users(id),
        name STRING NOT NULL,
        location STRING NOT NULL,
        area STRING,
        university STRING,
        description STRING,
        price_cents INT NOT NULL DEFAULT 0,
        image_url STRING,
        status STRING NOT NULL DEFAULT 'available',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS hostel_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
        image_url STRING NOT NULL,
        caption STRING,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hostel_id UUID REFERENCES hostels(id),
        room_name STRING NOT NULL,
        room_type STRING NOT NULL DEFAULT 'shared',
        price_cents INT NOT NULL DEFAULT 0,
        capacity INT NOT NULL DEFAULT 1,
        status STRING NOT NULL DEFAULT 'available',
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        hostel_id UUID REFERENCES hostels(id),
        room_id UUID REFERENCES rooms(id),
        booking_status STRING NOT NULL DEFAULT 'pending',
        start_date DATE,
        end_date DATE,
        notes STRING,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `)

    schemaReady = true
  } finally {
    client.release()
  }
}

async function getUserByEmail(email) {
  const client = await getPool().connect()

  try {
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email])
    return result.rows[0]
  } finally {
    client.release()
  }
}

async function createUser(user) {
  const client = await getPool().connect()

  try {
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, role, university, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.name, user.email, user.password_hash, user.role, user.university || null, user.phone || null],
    )

    return result.rows[0]
  } finally {
    client.release()
  }
}

async function upsertGoogleUser(payload) {
  const client = await getPool().connect()

  try {
    const result = await client.query(
      `INSERT INTO users (name, email, google_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE
       SET name = EXCLUDED.name, email = EXCLUDED.email, updated_at = now()
       RETURNING *`,
      [payload.name, payload.email, payload.googleId, payload.role || 'student'],
    )

    return result.rows[0]
  } finally {
    client.release()
  }
}

async function getHostelsFromDb() {
  const client = await getPool().connect()

  try {
    const result = await client.query(`
      SELECT
        h.id,
        h.name,
        h.location,
        h.area,
        h.university,
        h.description,
        h.price_cents,
        h.status,
        COALESCE(h.image_url, hi.image_url) AS image_url
      FROM hostels h
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM hostel_images
        WHERE hostel_id = h.id
        ORDER BY created_at
        LIMIT 1
      ) hi ON true
      ORDER BY h.created_at DESC
    `)

    return result.rows.map((hostel) => ({
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
  } finally {
    client.release()
  }
}

async function createHostelRecord(ownerId, payload) {
  const client = await getPool().connect()

  try {
    await client.query('BEGIN')

    const hostelResult = await client.query(
      `INSERT INTO hostels (owner_id, name, location, area, university, description, price_cents, image_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        ownerId,
        payload.name,
        payload.location,
        payload.area || null,
        payload.university,
        payload.description,
        parsePriceCents(payload.price),
        payload.image_url || null,
        payload.status || 'available',
      ],
    )

    const hostel = hostelResult.rows[0]

    if (payload.image_url) {
      await client.query(
        `INSERT INTO hostel_images (hostel_id, image_url, caption)
         VALUES ($1, $2, $3)`,
        [hostel.id, payload.image_url, payload.image_caption || null],
      )
    }

    await client.query('COMMIT')

    return {
      id: hostel.id,
      name: hostel.name,
      location: hostel.location,
      area: hostel.area,
      university: hostel.university,
      description: hostel.description,
      price: `$${(hostel.price_cents / 100).toFixed(0)}/month`,
      status: hostel.status,
      image_url: hostel.image_url,
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function createBookingRecord(userId, payload) {
  const client = await getPool().connect()

  try {
    const result = await client.query(
      `INSERT INTO bookings (user_id, hostel_id, booking_status, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, payload.hostelId, payload.bookingStatus || 'pending', payload.notes || null],
    )

    const booking = result.rows[0]

    return {
      id: booking.id,
      userId: booking.user_id,
      hostelId: booking.hostel_id,
      bookingStatus: booking.booking_status,
      notes: booking.notes,
      createdAt: booking.created_at,
    }
  } finally {
    client.release()
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || defaultOrigin

  if (req.method === 'OPTIONS') {
    return jsonResponse(res, 204, {}, origin)
  }

  try {
    await ensureSchema()

    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`)
    const path = url.pathname

    if (path === '/api/health') {
      return jsonResponse(res, 200, { status: 'ok', service: 'hostelhub-api' }, origin)
    }

    if (path === '/api/hostels' && req.method === 'GET') {
      if (!requireDbRuntime(origin, res)) {
        return
      }

      const hostels = await getHostelsFromDb()
      return jsonResponse(res, 200, { hostels }, origin)
    }

    if (path === '/api/hostels' && req.method === 'POST') {
      if (!requireDbRuntime(origin, res)) {
        return
      }

      if (!requireJwtRuntime(origin, res)) {
        return
      }

      const body = await readJsonBody(req)
      const authUser = authenticateRequest(req)

      if (!authUser) {
        return jsonResponse(res, 401, { message: 'Authentication is required to add a hostel.' }, origin)
      }

      if (authUser.role !== 'owner' && authUser.role !== 'admin') {
        return jsonResponse(res, 403, { message: 'Only hostel owners and admins can add hostels.' }, origin)
      }

      if (!body.name || !body.location || !body.university || !body.description) {
        return jsonResponse(res, 400, { message: 'Hostel name, location, university, and description are required.' }, origin)
      }

      const createdHostel = await createHostelRecord(authUser.sub, body)
      return jsonResponse(res, 201, createdHostel, origin)
    }

    if (path === '/api/bookings' && req.method === 'POST') {
      if (!requireDbRuntime(origin, res)) {
        return
      }

      if (!requireJwtRuntime(origin, res)) {
        return
      }

      const body = await readJsonBody(req)
      const authUser = authenticateRequest(req)

      if (!authUser) {
        return jsonResponse(res, 401, { message: 'Authentication is required to create a booking.' }, origin)
      }

      if (authUser.role !== 'student') {
        return jsonResponse(res, 403, { message: 'Only students can create bookings.' }, origin)
      }

      if (!body.hostelId) {
        return jsonResponse(res, 400, { message: 'A hostelId is required to create a booking.' }, origin)
      }

      const booking = await createBookingRecord(authUser.sub, body)
      return jsonResponse(res, 201, booking, origin)
    }

    if (path === '/api/auth/register' && req.method === 'POST') {
      if (!requireDbRuntime(origin, res)) {
        return
      }

      if (!requireJwtRuntime(origin, res)) {
        return
      }

      const body = await readJsonBody(req)
      const { name, email, password } = body

      if (!name || !email || !password) {
        return jsonResponse(res, 400, { message: 'Name, email, and password are required.' }, origin)
      }

      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        return jsonResponse(res, 409, { message: 'An account with this email already exists.' }, origin)
      }

      const password_hash = await bcrypt.hash(password, 10)
      const user = await createUser({ name, email, password_hash, role: 'student' })
      const token = signToken(user)

      return jsonResponse(res, 201, { token, user: sanitizeUser(user) }, origin)
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const { email, password } = body

      if (!email || !password) {
        return jsonResponse(res, 400, { message: 'Email and password are required.' }, origin)
      }

      if (adminConfigured && email === adminEmail && password === adminPassword) {
        if (!requireJwtRuntime(origin, res)) {
          return
        }

        const adminUser = getAdminUser()
        return jsonResponse(res, 200, { token: signToken(adminUser), user: sanitizeUser(adminUser) }, origin)
      }

      if (!requireDbRuntime(origin, res)) {
        return
      }

      if (!requireJwtRuntime(origin, res)) {
        return
      }

      const user = await getUserByEmail(email)
      if (!user) {
        return jsonResponse(res, 401, { message: 'Invalid email or password.' }, origin)
      }

      const isValid = await bcrypt.compare(password, user.password_hash)
      if (!isValid) {
        return jsonResponse(res, 401, { message: 'Invalid email or password.' }, origin)
      }

      return jsonResponse(res, 200, { token: signToken(user), user: sanitizeUser(user) }, origin)
    }

    if (path === '/api/auth/google' && req.method === 'POST') {
      if (!requireDbRuntime(origin, res)) {
        return
      }

      if (!requireJwtRuntime(origin, res)) {
        return
      }

      if (!requireGoogleRuntime(origin, res)) {
        return
      }

      const body = await readJsonBody(req)
      const { credential } = body

      if (!credential) {
        return jsonResponse(res, 400, { message: 'Google credential is required.' }, origin)
      }

      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      })

      const payload = ticket.getPayload()
      const user = await upsertGoogleUser({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
        role: 'student',
      })

      return jsonResponse(res, 200, { token: signToken(user), user: sanitizeUser(user) }, origin)
    }

    return jsonResponse(res, 404, { message: 'Route not found.' }, origin)
  } catch (error) {
    const message = error?.message || 'Unexpected error.'
    return jsonResponse(res, 500, { message }, origin)
  }
}
