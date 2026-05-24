import { useEffect, useMemo, useState } from 'react'
import {
  clearSession,
  createBooking,
  createHostel,
  fetchHostels,
  getStoredSession,
  googleSignIn,
  loginUser,
  registerUser,
  saveSession,
} from './lib/api'

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
  }
}

function App() {
  const [hostels, setHostels] = useState([])
  const [bookings, setBookings] = useState([])
  const [search, setSearch] = useState('')
  const [authMode, setAuthMode] = useState('login')
  const [session, setSession] = useState(() => getStoredSession())
  const [message, setMessage] = useState('Set DATABASE_URL, JWT_SECRET, and the Google environment variables in Vercel to enable the live system.')
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
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
  })

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  useEffect(() => {
    let active = true

    const loadHostels = async () => {
      setIsLoading(true)

      try {
        const response = await fetchHostels()
        if (active) {
          const nextHostels = (response.hostels || []).map(normalizeHostel)
          setHostels(nextHostels)
          setMessage(`Showing ${nextHostels.length} live hostel listings.`)
        }
      } catch (error) {
        if (active) {
          setHostels([])
          setMessage(error.message)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadHostels()

    return () => {
      active = false
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

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const data = await googleSignIn(response.credential)
            saveSession({ token: data.token, user: data.user })
            setSession({ token: data.token, user: data.user })
            setMessage(`Welcome ${data.user.name}! Your ${data.user.role} dashboard is ready.`)
          } catch (error) {
            setMessage(error.message)
          }
        },
      })

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

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = loadGoogle
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [googleClientId])

  const filteredHostels = useMemo(() => {
    const query = search.toLowerCase().trim()

    if (!query) {
      return hostels
    }

    return hostels.filter((hostel) =>
      [hostel.name, hostel.location, hostel.area, hostel.university, hostel.description]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [hostels, search])

  const roleSummary = useMemo(() => {
    if (!session?.user) {
      return 'Create an account to unlock the student, owner, and admin dashboards.'
    }

    if (session.user.role === 'owner') {
      return 'Owner dashboard: add your own hostels, set room prices, and review booking activity for your properties.'
    }

    if (session.user.role === 'admin') {
      return 'Admin dashboard: review all bookings, approve hostels, and control visibility and pricing.'
    }

    return 'Student dashboard: search by university or area, compare rooms, and create a booking request.'
  }, [session])

  const currentRole = session?.user?.role || 'guest'

  const totalHostels = hostels.length
  const pendingBookings = bookings.filter((booking) => booking.bookingStatus === 'pending').length

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('Processing your request...')

    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        university: form.university,
      }

      const data = authMode === 'login' ? await loginUser(payload) : await registerUser(payload)
      saveSession({ token: data.token, user: data.user })
      setSession({ token: data.token, user: data.user })
      setMessage(`Welcome ${data.user.name}! Your ${data.user.role} dashboard is ready.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
    setMessage('You are signed out. Log in again to continue booking and managing rooms.')
  }

  const handleAddHostel = async (event) => {
    event.preventDefault()

    if (!session?.user) {
      setMessage('Log in first and choose the owner role to add a hostel.')
      return
    }

    if (session.user.role !== 'owner' && session.user.role !== 'admin') {
      setMessage('Only owners and admins can add hostels.')
      return
    }

    try {
      const createdHostel = await createHostel({
        name: ownerForm.name,
        location: ownerForm.location,
        area: ownerForm.area,
        university: ownerForm.university,
        description: ownerForm.description,
        price: ownerForm.price,
        status: ownerForm.status,
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
      })
      setMessage(`Hostel ${createdHostel.name} has been added to the live listings.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const handleBookNow = async (hostel) => {
    if (!session?.user) {
      setMessage('Please log in before booking a room.')
      return
    }

    if (session.user.role !== 'student') {
      setMessage('Only students can create booking requests.')
      return
    }

    try {
      const booking = await createBooking({
        hostelId: hostel.id,
        notes: `Booking requested for ${hostel.name}`,
      })

      setBookings((current) => [booking, ...current])
      setMessage(`Booking request created for ${hostel.name}. Owners and admins can now see it.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <a className="navbar-brand fw-bold" href="#">HostelHub</a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item"><a className="nav-link" href="#featured">Featured</a></li>
              <li className="nav-item"><a className="nav-link" href="#dashboard">Dashboard</a></li>
              <li className="nav-item"><a className="nav-link" href="#auth">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="#how-it-works">How it works</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <header className="py-5">
        <div className="container">
          <div className="row align-items-center gy-4">
            <div className="col-lg-6">
              <p className="text-primary fw-semibold text-uppercase">Student hostel booking</p>
              <h1 className="display-4 fw-bold mb-3">Book hostels and rooms near your university or preferred area.</h1>
              <p className="lead text-secondary mb-4">
                HostelHub uses the real backend for logins, hostel listings, and booking creation. Configure your CokroachDB and Google credentials in Vercel to go live.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <a href="#featured" className="btn btn-primary btn-lg">Explore rooms</a>
                <a href="#auth" className="btn btn-outline-primary btn-lg">Login or register</a>
              </div>

              <div className="mt-4 p-4 bg-white rounded-4 shadow-sm">
                <p className="fw-semibold mb-2">Live status</p>
                <p className="mb-3 text-secondary">{message}</p>
                {session?.user ? (
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className="badge bg-primary">{session.user.role}</span>
                    <span className="text-secondary">{session.user.email}</span>
                    <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>Sign out</button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card shadow border-0 rounded-4">
                <div className="card-body p-4 p-md-5">
                  <p className="text-muted mb-1">Search instantly</p>
                  <h2 className="h4 fw-bold mb-4">Find the right hostel in your area</h2>
                  <div className="mb-3">
                    <label className="form-label">University, suburb, or location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Makerere, Westlands, East Legon"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Budget</label>
                      <select className="form-select" defaultValue="Any budget">
                        <option>Any budget</option>
                        <option>Below $150</option>
                        <option>$150 - $250</option>
                        <option>Above $250</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Room type</label>
                      <select className="form-select" defaultValue="Any room type">
                        <option>Any room type</option>
                        <option>Shared</option>
                        <option>Private</option>
                        <option>Apartment</option>
                      </select>
                    </div>
                  </div>
                  <p className="mb-0 mt-4 text-secondary">{filteredHostels.length} live hostel options currently matching your search.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="featured" className="py-5">
          <div className="container">
            <div className="d-flex justify-content-between align-items-end flex-wrap gap-3 mb-4">
              <div>
                <p className="text-primary fw-semibold mb-1">Featured hostels</p>
                <h2 className="h3 fw-bold">Live listings from your database</h2>
              </div>
              <p className="text-secondary mb-0">The site now waits for the real database and Google credentials instead of showing demo data.</p>
            </div>

            <div className="row g-4">
              {isLoading ? (
                <div className="col-12">
                  <div className="alert alert-light border">Loading live hostel listings...</div>
                </div>
              ) : filteredHostels.length ? (
                filteredHostels.map((hostel) => (
                  <div className="col-md-6 col-lg-4" key={hostel.id}>
                    <div className="card h-100 border-0 shadow-sm rounded-4">
                      <div className="card-body">
                        <span className={`badge mb-2 ${hostel.status === 'available' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'}`}>
                          {hostel.status}
                        </span>
                        <h3 className="h5 fw-bold">{hostel.name}</h3>
                        <p className="text-secondary mb-1">{hostel.location}</p>
                        <p className="text-secondary mb-1">{hostel.university}</p>
                        <p className="text-secondary mb-3">{hostel.description}</p>
                        <div className="d-flex justify-content-between align-items-center">
                          <strong>{hostel.price}</strong>
                          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => handleBookNow(hostel)}>
                            {session?.user ? 'Book now' : 'Login to book'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-12">
                  <div className="alert alert-light border">
                    No live hostels are available yet. Add <strong>DATABASE_URL</strong> in Vercel and publish your first hostel records.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="dashboard" className="py-5 bg-white">
          <div className="container">
            <div className="text-center mb-4">
              <p className="text-primary fw-semibold mb-1">Role-based dashboard</p>
              <h2 className="h3 fw-bold">What each user sees after login</h2>
            </div>
            <div className="row g-4 align-items-stretch">
              <div className="col-lg-4">
                <div className="card border-0 shadow-sm h-100 rounded-4">
                  <div className="card-body">
                    <p className="text-primary fw-semibold mb-2">Current role</p>
                    <h3 className="h5 fw-bold text-capitalize">{currentRole}</h3>
                    <p className="text-secondary mb-0">{roleSummary}</p>
                  </div>
                </div>
              </div>

              <div className="col-lg-8">
                <div className="card border-0 shadow-sm h-100 rounded-4">
                  <div className="card-body">
                    {currentRole === 'student' && (
                      <div>
                        <h3 className="h5 fw-bold">Student quick actions</h3>
                        <p className="text-secondary">Your booking requests are sent to the live backend and linked to the selected hostel.</p>
                        {bookings.length ? (
                          <ul className="list-group list-group-flush mt-3">
                            {bookings.map((booking) => (
                              <li className="list-group-item px-0" key={booking.id}>
                                <strong>Booking #{booking.id.slice(0, 8)}</strong> — {booking.notes || 'Live booking request'} <span className="badge bg-warning-subtle text-warning ms-2">{booking.bookingStatus}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-secondary mb-0">No live bookings yet. Search and book a room to create one.</p>
                        )}
                      </div>
                    )}

                    {currentRole === 'owner' && (
                      <div>
                        <h3 className="h5 fw-bold">Owner dashboard</h3>
                        <p className="text-secondary">Add a hostel listing and set the price you want students to see.</p>
                        <form className="row g-3 mt-2" onSubmit={handleAddHostel}>
                          <div className="col-md-6">
                            <label className="form-label">Hostel name</label>
                            <input className="form-control" value={ownerForm.name} onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} required />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Location</label>
                            <input className="form-control" value={ownerForm.location} onChange={(event) => setOwnerForm({ ...ownerForm, location: event.target.value })} required />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Area</label>
                            <input className="form-control" value={ownerForm.area} onChange={(event) => setOwnerForm({ ...ownerForm, area: event.target.value })} placeholder="e.g. Westlands" />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">University</label>
                            <input className="form-control" value={ownerForm.university} onChange={(event) => setOwnerForm({ ...ownerForm, university: event.target.value })} required />
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
                            <label className="form-label">Description</label>
                            <textarea className="form-control" rows="3" value={ownerForm.description} onChange={(event) => setOwnerForm({ ...ownerForm, description: event.target.value })} required />
                          </div>
                          <div className="col-12">
                            <button type="submit" className="btn btn-primary">Add hostel</button>
                          </div>
                        </form>
                      </div>
                    )}

                    {currentRole === 'admin' && (
                      <div>
                        <h3 className="h5 fw-bold">Admin overview</h3>
                        <div className="row g-3 mt-2">
                          <div className="col-md-4">
                            <div className="p-3 bg-light rounded-3">
                              <p className="small text-muted mb-1">Hostels live</p>
                              <h4 className="mb-0">{totalHostels}</h4>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="p-3 bg-light rounded-3">
                              <p className="small text-muted mb-1">Pending bookings</p>
                              <h4 className="mb-0">{pendingBookings}</h4>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="p-3 bg-light rounded-3">
                              <p className="small text-muted mb-1">Areas covered</p>
                              <h4 className="mb-0">{new Set(hostels.map((hostel) => hostel.area).filter(Boolean)).size}</h4>
                            </div>
                          </div>
                        </div>
                        <p className="text-secondary mt-3 mb-0">Once your CockroachDB instance is connected, this dashboard will reflect the live hostel and booking data from the database.</p>
                      </div>
                    )}

                    {currentRole === 'guest' && (
                      <div>
                        <h3 className="h5 fw-bold">Finish your account setup</h3>
                        <p className="text-secondary">Create an account or sign in with Google to unlock the live dashboards and booking flow.</p>
                        <a href="#auth" className="btn btn-primary">Go to login</a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="auth" className="py-5">
          <div className="container">
            <div className="row g-4 align-items-start">
              <div className="col-lg-5">
                <p className="text-primary fw-semibold mb-1">Authentication</p>
                <h2 className="h3 fw-bold">Login, register, and sign in with Google</h2>
                <p className="text-secondary mb-4">
                  The live backend is now the only path for logins, hostel listings, and booking creation. Configure your environment variables in Vercel and deploy again.
                </p>

                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body">
                    <div className="btn-group w-100" role="group">
                      <button type="button" className={`btn ${authMode === 'login' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setAuthMode('login')}>Login</button>
                      <button type="button" className={`btn ${authMode === 'register' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setAuthMode('register')}>Register</button>
                    </div>

                    <form className="mt-4" onSubmit={handleSubmit}>
                      {authMode === 'register' && (
                        <div className="mb-3">
                          <label className="form-label">Full name</label>
                          <input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                        </div>
                      )}

                      <div className="mb-3">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-control" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                      </div>

                      <div className="mb-3">
                        <label className="form-label">Password</label>
                        <input type="password" className="form-control" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                      </div>

                      {authMode === 'register' && (
                        <>
                          <div className="mb-3">
                            <label className="form-label">Role</label>
                            <select className="form-select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                              <option value="student">Student</option>
                              <option value="owner">Hostel owner</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="mb-3">
                            <label className="form-label">University (optional)</label>
                            <input className="form-control" value={form.university} onChange={(event) => setForm({ ...form, university: event.target.value })} />
                          </div>
                        </>
                      )}

                      <button type="submit" className="btn btn-primary w-100">
                        {authMode === 'login' ? 'Login' : 'Create account'}
                      </button>
                    </form>

                    {googleClientId ? (
                      <div className="mt-3">
                        <div className="text-center text-muted mb-2">or</div>
                        <div id="google-signin-button"></div>
                      </div>
                    ) : (
                      <div className="alert alert-light border mt-3 mb-0">
                        Add <strong>VITE_GOOGLE_CLIENT_ID</strong> in your environment variables to enable Google Sign-In.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-lg-7">
                <div className="card border-0 shadow-sm rounded-4">
                  <div className="card-body">
                    <h3 className="h5 fw-bold">Google client ID setup</h3>
                    <ol className="mb-3">
                      <li>Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Console</a></li>
                      <li>Select your OAuth client and copy the <strong>Web client ID</strong></li>
                      <li>Add it to Vercel as both <strong>GOOGLE_CLIENT_ID</strong> and <strong>VITE_GOOGLE_CLIENT_ID</strong></li>
                      <li>Set <strong>ALLOWED_ORIGINS</strong> to <strong>https://hostel-system-lac.vercel.app</strong></li>
                    </ol>
                    <div className="alert alert-primary mb-0">
                      Your current Google client ID is <strong>560793221927-d89ap70eogakodgeocsmhbve3ahjifon.apps.googleusercontent.com</strong>. Add it in both Vercel variables.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-5">
          <div className="container">
            <div className="text-center mb-5">
              <p className="text-primary fw-semibold mb-1">How it works</p>
              <h2 className="h3 fw-bold">Built for students, owners, and admins</h2>
            </div>
            <div className="row g-4">
              <div className="col-md-4">
                <div className="p-4 rounded-4 bg-light h-100">
                  <h3 className="h5 fw-bold">1. Search by location</h3>
                  <p className="text-secondary mb-0">Filter by university, suburb, or exact area and compare hostels instantly.</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-4 rounded-4 bg-light h-100">
                  <h3 className="h5 fw-bold">2. Sign in securely</h3>
                  <p className="text-secondary mb-0">Use email/password or Google Sign-In to access the live dashboards.</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-4 rounded-4 bg-light h-100">
                  <h3 className="h5 fw-bold">3. Manage the process</h3>
                  <p className="text-secondary mb-0">Students book, owners add hostels, and admins oversee pricing and visibility.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-4 bg-primary text-white">
        <div className="container d-flex flex-column flex-md-row justify-content-between gap-2">
          <span>HostelHub — responsive hostel booking for students.</span>
          <span>Push updates to GitHub and Vercel will redeploy automatically.</span>
        </div>
      </footer>
    </div>
  )
}

export default App
