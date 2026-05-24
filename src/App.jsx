import { useEffect, useMemo, useState } from 'react'
import { createBooking, createHostel, fetchHostels } from './lib/api'
import { signInUser, signInWithGoogleCredential, signOutUser, signUpUser, supabase } from './lib/supabase'

const featuredAreas = [
  {
    name: 'Westlands',
    city: 'Nairobi',
    idealFor: 'Walking distance to cafés, campuses, and nightlife',
    gradient: 'linear-gradient(135deg, #0ea5e9, #14b8a6)',
  },
  {
    name: 'Kampala Central',
    city: 'Kampala',
    idealFor: 'Fast access to universities, clinics, and transport',
    gradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
  },
  {
    name: 'Mbarara Town',
    city: 'Mbarara',
    idealFor: 'Comfortable rooms for students and visiting families',
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  },
]

function normalizeHostel(hostel) {
  return {
    id: hostel.id,
    name: hostel.name,
    location: hostel.location,
    area: hostel.area,
    university: hostel.university,
    description: hostel.description,
    price: hostel.price || '$0/month',
    status: hostel.status || 'available',
    imageUrl: hostel.imageUrl || hostel.image_url || '',
  }
}

function getHostelImageStyle(hostel) {
  if (hostel.imageUrl) {
    return {
      backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.65), rgba(59, 130, 246, 0.35)), url(${hostel.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }

  const palette = [
    'linear-gradient(135deg, #0f172a, #2563eb)',
    'linear-gradient(135deg, #111827, #0ea5e9)',
    'linear-gradient(135deg, #1d4ed8, #14b8a6)',
    'linear-gradient(135deg, #7c3aed, #ec4899)',
  ]

  return {
    background: palette[Math.abs(hostel.name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palette.length],
  }
}

function App() {
  const [hostels, setHostels] = useState([])
  const [bookings, setBookings] = useState([])
  const [search, setSearch] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [session, setSession] = useState(null)
  const [message, setMessage] = useState('Connect your Supabase project to unlock live bookings.')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    university: '',
  })
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    location: '',
    area: '',
    university: '',
    description: '',
    price: '$180/month',
    status: 'available',
    imageUrl: '',
  })

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  useEffect(() => {
    let active = true

    const loadHostels = async () => {
      setIsLoading(true)

      try {
        const response = await fetchHostels()

        if (!active) {
          return
        }

        const nextHostels = (response.hostels || []).map(normalizeHostel)
        setHostels(nextHostels)

        if (nextHostels.length) {
          setMessage(`Showing ${nextHostels.length} live hostel listings.`)
        } else {
          setMessage('No live hostels are available yet. Add your first hostel from the owner dashboard once your Supabase tables are connected.')
        }
      } catch (error) {
        if (!active) {
          return
        }

        setHostels([])
        setMessage(error.message)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    const bootstrapSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (active) {
        setSession(data.session)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession)
      }
    })

    loadHostels()
    bootstrapSession()

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!googleClientId) {
      return
    }

    const loadGoogle = () => {
      if (!window.google?.accounts?.id) {
        return
      }

      if (!window.__hostelhubGoogleInitializeWrapperInstalled) {
        const originalInitialize = window.google.accounts.id.initialize

        window.google.accounts.id.initialize = (config) => {
          if (window.__hostelhubGoogleInitialized) {
            return
          }

          window.__hostelhubGoogleInitialized = true
          return originalInitialize.call(window.google.accounts.id, config)
        }

        window.__hostelhubGoogleInitializeWrapperInstalled = true
      }

      if (!window.__hostelhubGoogleInitialized) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              const data = await signInWithGoogleCredential(response.credential)
              setSession(data.session)
              setMessage(`Welcome ${data.user.user_metadata?.name || data.user.email}! Your ${data.user.user_metadata?.role || 'student'} dashboard is now ready.`)
            } catch (error) {
              setMessage(error.message)
            }
          },
        })
      }

      const container = document.getElementById('google-signin-button')
      if (container) {
        container.innerHTML = ''
        window.google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
        })
      }
    }

    if (window.google?.accounts?.id) {
      loadGoogle()
      return
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')

    if (existingScript) {
      existingScript.addEventListener('load', loadGoogle)
      return () => {
        existingScript.removeEventListener('load', loadGoogle)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = loadGoogle
    document.body.appendChild(script)

    return () => {
      script.removeEventListener('load', loadGoogle)
    }
  }, [googleClientId])

  const filteredHostels = useMemo(() => {
    const query = search.toLowerCase().trim()

    if (!query) {
      return hostels
    }

    return hostels.filter((hostel) => [hostel.name, hostel.location, hostel.area, hostel.university, hostel.description].join(' ').toLowerCase().includes(query))
  }, [hostels, search])

  const currentRole = session?.user?.user_metadata?.role || 'guest'
  const pendingBookings = bookings.filter((booking) => booking.bookingStatus === 'pending').length

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(authMode === 'login' ? 'Checking your login details...' : 'Creating your account...')

    try {
      if (authMode === 'login') {
        const data = await signInUser({
          email: form.email,
          password: form.password,
        })

        setSession(data.session)
        setMessage(`Welcome ${data.user.user_metadata?.name || data.user.email}! Your ${data.user.user_metadata?.role || 'student'} dashboard is ready.`)
      } else {
        const data = await signUpUser({
          email: form.email,
          password: form.password,
          name: form.name,
          university: form.university,
        })

        if (data.session) {
          setSession(data.session)
          setMessage(`Welcome ${data.user.user_metadata?.name || data.user.email}! Your ${data.user.user_metadata?.role || 'student'} dashboard is ready.`)
        } else {
          setMessage('Check your inbox to confirm your email address and finish creating your account.')
        }
      }

      if (typeof window !== 'undefined') {
        window.location.hash = '#dashboard'
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete the request right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOutUser()
    } finally {
      setSession(null)
      setMessage('You are signed out. You can sign in again anytime to continue booking.')
    }
  }

  const handleAddHostel = async (event) => {
    event.preventDefault()

    if (!session?.user) {
      setMessage('Please log in first and choose owner access to add a hostel.')
      return
    }

    const role = session.user.user_metadata?.role || 'student'

    if (role !== 'owner' && role !== 'admin') {
      setMessage('Only owners and admins can add hostels.')
      return
    }

    try {
      setIsSubmitting(true)
      setMessage('Saving your hostel listing...')

      const createdHostel = await createHostel({
        name: ownerForm.name,
        location: ownerForm.location,
        area: ownerForm.area,
        university: ownerForm.university,
        description: ownerForm.description,
        price: ownerForm.price,
        status: ownerForm.status,
        image_url: ownerForm.imageUrl,
      })

      setHostels((current) => [normalizeHostel(createdHostel), ...current])
      setOwnerForm({
        name: '',
        location: '',
        area: '',
        university: '',
        description: '',
        price: '$180/month',
        status: 'available',
        imageUrl: '',
      })
      setMessage(`Hostel ${createdHostel.name} has been added to the live listings.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBookNow = async (hostel) => {
    if (!session?.user) {
      setMessage('Please log in before booking a room.')
      return
    }

    if ((session.user.user_metadata?.role || 'student') !== 'student') {
      setMessage('Only students can create booking requests.')
      return
    }

    try {
      setIsSubmitting(true)
      setMessage(`Creating your booking request for ${hostel.name}...`)
      const booking = await createBooking({
        hostelId: hostel.id,
        notes: `Booking requested for ${hostel.name}`,
      })

      setBookings((current) => [booking, ...current])
      setMessage(`Booking request created for ${hostel.name}.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleSummary = useMemo(() => {
    if (!session?.user) {
      return 'Create an account to unlock the student, owner, and admin dashboards.'
    }

    const role = session.user.user_metadata?.role || 'student'

    if (role === 'owner') {
      return 'Owner dashboard: add hostels, manage pricing, and review booking activity.'
    }

    if (role === 'admin') {
      return 'Admin dashboard: review live hostels, approve bookings, and oversee visibility.'
    }

    return 'Student dashboard: search by university or area, compare rooms, and create booking requests.'
  }, [session])

  const hasGoogleLogin = Boolean(googleClientId)

  return (
    <div className="home-shell">
      <nav className="topbar">
        <div className="container d-flex justify-content-between align-items-center py-3">
          <div>
            <p className="eyebrow mb-1">HostelHub</p>
            <span className="topbar-tag">Find your next room</span>
          </div>
          <div className="d-none d-lg-flex gap-3 align-items-center">
            <a href="#discover" className="nav-link">Discover</a>
            <a href="#dashboard" className="nav-link">Dashboard</a>
            <a href="#auth" className="nav-link">Account</a>
          </div>
          <a href="#auth" className="btn btn-primary btn-sm">Open account</a>
        </div>
      </nav>

      <header className="hero-section">
        <div className="container">
          <div className="row align-items-center gy-5">
            <div className="col-lg-7">
              <div className="hero-copy fade-up">
                <p className="eyebrow">Student-first hostel booking</p>
                <h1 className="display-4 fw-bold mb-3">Book smarter, live faster, and manage hostels in one place.</h1>
                <p className="lead text-secondary mb-4">
                  HostelHub gives students a clean booking experience while giving live updates for hostels, rooms, and bookings.
                </p>
                <div className="d-flex flex-wrap gap-3 mb-4">
                  <a href="#discover" className="btn btn-primary btn-lg">Explore hostels</a>
                  <a href="#auth" className="btn btn-outline-primary btn-lg">Login or register</a>
                </div>
                <div className="status-banner">
                  <div>
                    <p className="small text-muted mb-1">Live status</p>
                    <p className="mb-0">{message}</p>
                  </div>
                  {session?.user ? (
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="badge bg-primary">{session.user.user_metadata?.role || 'student'}</span>
                      <span className="text-secondary">{session.user.email}</span>
                      <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>Sign out</button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="hero-panel fade-up">
                <div className="hero-panel-inner">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <p className="small text-muted mb-1">Find the right room</p>
                      <h2 className="h5 fw-bold mb-0">Search by location or university</h2>
                    </div>
                    <span className="badge bg-success-subtle text-success">Live</span>
                  </div>
                  <label className="form-label">University, suburb, or neighbourhood</label>
                  <input
                    type="text"
                    className="form-control mb-3"
                    placeholder="Try Westlands, Makerere, or Mbarara"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <div className="row g-3">
                    <div className="col-6">
                      <div className="stat-card">
                        <p className="small text-muted mb-1">Listings</p>
                        <h3 className="h4 mb-0">{hostels.length}</h3>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="stat-card">
                        <p className="small text-muted mb-1">Bookings</p>
                        <h3 className="h4 mb-0">{pendingBookings}</h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 mb-0 text-secondary">
                    {filteredHostels.length} matching hostel options are currently visible in the live catalogue.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="discover" className="py-5">
          <div className="container">
            <div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
              <div>
                <p className="eyebrow">Popular areas</p>
                <h2 className="h3 fw-bold">Pick a neighbourhood and compare your next option</h2>
              </div>
              <p className="text-secondary mb-0">Use these curated location cards to explore trending areas while your live listings load from the database.</p>
            </div>

            <div className="row g-4">
              {featuredAreas.map((area) => (
                <div className="col-md-4" key={area.name}>
                  <div className="feature-card fade-up" style={{ background: area.gradient }}>
                    <p className="small text-white-50 mb-2">{area.city}</p>
                    <h3 className="h5 fw-bold text-white">{area.name}</h3>
                    <p className="text-white-50 mb-0">{area.idealFor}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-5">
          <div className="container">
            <div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
              <div>
                <p className="eyebrow">Live hostels</p>
                <h2 className="h3 fw-bold">Fresh listings from your database</h2>
              </div>
              <p className="text-secondary mb-0">When your Supabase tables are connected, these cards are populated directly from the backend.</p>
            </div>

            {isLoading ? (
              <div className="alert alert-light border">Loading live hostel listings...</div>
            ) : filteredHostels.length ? (
              <div className="row g-4">
                {filteredHostels.map((hostel) => (
                  <div className="col-md-6 col-lg-4" key={hostel.id}>
                    <article className="hostel-card fade-up">
                      <div className="hostel-image" style={getHostelImageStyle(hostel)} />
                      <div className="p-4">
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <p className="small text-primary fw-semibold mb-1">{hostel.area || hostel.location}</p>
                            <h3 className="h5 fw-bold mb-2">{hostel.name}</h3>
                          </div>
                          <span className={`badge ${hostel.status === 'available' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>{hostel.status}</span>
                        </div>
                        <p className="text-secondary mb-2">{hostel.location}</p>
                        <p className="text-secondary mb-3">{hostel.description}</p>
                        <div className="d-flex justify-content-between align-items-center">
                          <strong>{hostel.price}</strong>
                          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleBookNow(hostel)}>
                            {session?.user ? 'Book now' : 'Login to book'}
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state fade-up">
                <h3 className="h5 fw-bold">No live rooms are available yet</h3>
                <p className="text-secondary mb-0">Connect your Supabase tables and add a hostel through the owner dashboard to populate this section.</p>
              </div>
            )}
          </div>
        </section>

        <section id="dashboard" className="py-5 bg-white">
          <div className="container">
            <div className="row g-4 align-items-stretch">
              <div className="col-lg-4">
                <div className="dashboard-card fade-up">
                  <p className="eyebrow">Role-based dashboard</p>
                  <h2 className="h4 fw-bold">{currentRole === 'guest' ? 'Guest access' : currentRole}</h2>
                  <p className="text-secondary">{roleSummary}</p>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="dashboard-card fade-up">
                  {currentRole === 'student' && (
                    <div>
                      <h3 className="h5 fw-bold">Student actions</h3>
                      <p className="text-secondary">Search live hostels, pick your room, and create booking requests straight from the catalog.</p>
                      {bookings.length ? (
                        <ul className="list-group list-group-flush mt-3">
                          {bookings.map((booking) => (
                            <li className="list-group-item px-0" key={booking.id}>
                              <strong>Booking {booking.id.slice(0, 8)}</strong> — {booking.notes || 'Live booking request'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-secondary mb-0">No booking requests yet. Create one from a hostel card to see it here.</p>
                      )}
                    </div>
                  )}

                  {currentRole === 'owner' && (
                    <div>
                      <h3 className="h5 fw-bold">Owner tools</h3>
                      <form className="row g-3 mt-2" onSubmit={handleAddHostel}>
                        <div className="col-md-6">
                          <label className="form-label">Hostel name</label>
                          <input className="form-control" required value={ownerForm.name} onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Location</label>
                          <input className="form-control" required value={ownerForm.location} onChange={(event) => setOwnerForm({ ...ownerForm, location: event.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Area</label>
                          <input className="form-control" value={ownerForm.area} onChange={(event) => setOwnerForm({ ...ownerForm, area: event.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">University</label>
                          <input className="form-control" required value={ownerForm.university} onChange={(event) => setOwnerForm({ ...ownerForm, university: event.target.value })} />
                        </div>
                        <div className="col-12">
                          <label className="form-label">Description</label>
                          <textarea className="form-control" rows="3" required value={ownerForm.description} onChange={(event) => setOwnerForm({ ...ownerForm, description: event.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Price</label>
                          <input className="form-control" value={ownerForm.price} onChange={(event) => setOwnerForm({ ...ownerForm, price: event.target.value })} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Status</label>
                          <select className="form-select" value={ownerForm.status} onChange={(event) => setOwnerForm({ ...ownerForm, status: event.target.value })}>
                            <option value="available">Available</option>
                            <option value="limited">Limited</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        <div className="col-12">
                          <label className="form-label">Image URL (optional)</label>
                          <input className="form-control" value={ownerForm.imageUrl} onChange={(event) => setOwnerForm({ ...ownerForm, imageUrl: event.target.value })} placeholder="https://images.unsplash.com/..." />
                        </div>
                        <div className="col-12">
                          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add hostel'}</button>
                        </div>
                      </form>
                    </div>
                  )}

                  {currentRole === 'admin' && (
                    <div>
                      <h3 className="h5 fw-bold">Admin overview</h3>
                      <div className="row g-3 mt-2">
                        <div className="col-md-4">
                          <div className="stat-card">
                            <p className="small text-muted mb-1">Active listings</p>
                            <h4 className="mb-0">{hostels.length}</h4>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="stat-card">
                            <p className="small text-muted mb-1">Pending bookings</p>
                            <h4 className="mb-0">{pendingBookings}</h4>
                          </div>
                        </div>
                        <div className="col-md-4">
                          <div className="stat-card">
                            <p className="small text-muted mb-1">Searchable areas</p>
                            <h4 className="mb-0">{new Set(hostels.map((hostel) => hostel.area).filter(Boolean)).size}</h4>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentRole === 'guest' && (
                    <div>
                      <h3 className="h5 fw-bold">Create your account</h3>
                      <p className="text-secondary">Choose your account type and start booking or managing hostels in minutes.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="auth" className="py-5">
          <div className="container">
            <div className="row g-4 align-items-stretch">
              <div className="col-lg-5">
                <div className="auth-card fade-up">
                  <p className="eyebrow">Access your account</p>
                  <h2 className="h3 fw-bold">Login or register in seconds</h2>
                  <p className="text-secondary">Public signups are student-only and now run through Supabase Auth. Use your email and password, or sign in with Google if your client ID is configured.</p>
                  <div className="btn-group w-100 mb-4" role="group">
                    <button type="button" className={`btn ${authMode === 'login' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setAuthMode('login')}>Login</button>
                    <button type="button" className={`btn ${authMode === 'register' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setAuthMode('register')}>Register</button>
                  </div>
                  <form onSubmit={handleSubmit}>
                    {authMode === 'register' && (
                      <div className="mb-3">
                        <label className="form-label">Full name</label>
                        <input className="form-control" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-control" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Password</label>
                      <input type="password" className="form-control" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                    </div>
                    {authMode === 'register' && (
                      <div className="mb-3">
                        <label className="form-label">University</label>
                        <input className="form-control" value={form.university} onChange={(event) => setForm({ ...form, university: event.target.value })} />
                      </div>
                    )}
                    <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>{isSubmitting ? 'Processing...' : authMode === 'login' ? 'Login' : 'Create account'}</button>
                  </form>

                  {hasGoogleLogin ? (
                    <div className="mt-4">
                      <div className="divider-text">or</div>
                      <div id="google-signin-button" className="d-flex justify-content-center"></div>
                    </div>
                  ) : (
                    <div className="mt-4 alert alert-light border mb-0">
                      Google sign-in will appear automatically once <strong>VITE_GOOGLE_CLIENT_ID</strong> is set in your environment.
                    </div>
                  )}
                </div>
              </div>

              <div className="col-lg-7">
                <div className="auth-side-card fade-up">
                  <p className="eyebrow">Why it feels smooth</p>
                  <h3 className="h4 fw-bold">Everything is centered on a clean booking journey</h3>
                  <div className="benefit-list mt-4">
                    <div>
                      <h4 className="h6 fw-bold">Instant search</h4>
                      <p className="text-secondary mb-0">Search live hostels by area, university, or neighborhood in one tap.</p>
                    </div>
                    <div>
                      <h4 className="h6 fw-bold">Role-based dashboards</h4>
                      <p className="text-secondary mb-0">Students book, owners publish listings, and admins review operations from the same UI.</p>
                    </div>
                    <div>
                      <h4 className="h6 fw-bold">Beautiful image-ready cards</h4>
                      <p className="text-secondary mb-0">Hostels support image URLs so your catalogue can look polished from day one.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
