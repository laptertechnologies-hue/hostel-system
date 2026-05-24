// Initialize Supabase
// Using the credentials found in your /workspaces/hostel-system/.env
const SUPABASE_URL = "https://fhwbqopivxnwsiusnpjf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OUrl0pyugaRYPuh1fOEqow_sS6SOEDB";

if (typeof supabase === 'undefined') {
    console.error('Supabase SDK failed to load. Check your CDN script tag in index.html.');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.error('Error signing out:', error.message);
    window.location.replace('index.html');
}

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session && window.location.pathname.endsWith('dashboard.html')) {
        window.location.href = 'index.html';
    }
    return session;
}

async function checkAdminSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return null;
    }
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (!profile || profile.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return null;
    }
    return session;
}

async function redirectUserByRole(user) {
    if (!user) return;
    
    // Fetch the role from the profiles table
    // maybeSingle() is safer as it won't throw an error if the profile sync has a slight delay
    const { data: profile, error } = await supabaseClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    
    if (error) console.error('Error fetching profile:', error.message);

    // Determine role from profile, or fallback to user metadata (useful during initial sync)
    const role = profile?.role || user.user_metadata?.role || 'student';

    if (role === 'admin') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'dashboard.html';
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const university = document.getElementById('signupUniversity').value;

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { name, university, role: 'student' }
        }
    });

    if (error) {
        alert(error.message);
    } else {
        alert('Registration successful! Please check your email for verification.');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert(error.message);
    } else {
        await redirectUserByRole(data.user);
    }
}

async function signInWithGoogle() {
    // Ensure we redirect back to the current origin's index.html
    const redirectUrl = `${window.location.origin}/index.html`;
    
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        }
    });
    if (error) alert(error.message);
}

async function fetchHostels(searchQuery = '') {
    const hostelList = document.getElementById('hostelList');
    let query = supabaseClient
        .from('hostels')
        .select('*')
        .eq('status', 'available');

    if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%,university.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching hostels:', error.message);
        return;
    }

    hostelList.innerHTML = data.length ? data.map((hostel, index) => `
        <div class="col-md-4 animate-item" style="animation-delay: ${index * 0.1}s">
            <div class="card h-100 shadow-sm hostel-card">
                <img src="${hostel.image_url || 'https://via.placeholder.com/300x200'}" class="card-img-top" alt="Hostel room at ${hostel.name} in ${hostel.location}">
                <div class="card-body">
                    <h5 class="card-title">${hostel.name}</h5>
                    <p class="card-text text-muted small">${hostel.location} - ${hostel.university || 'General'}</p>
                    <p class="card-text">${hostel.description || 'No description available.'}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary">$${(hostel.price_cents / 100).toFixed(2)} /mo</span>
                        <button class="btn btn-sm btn-outline-primary">View Details</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('') : '<div class="col-12 text-center"><p>No hostels found matching your criteria.</p></div>';
}

async function fetchAdminStats() {
    const { data: hostels } = await supabaseClient.from('hostels').select('id');
    const { data: profiles } = await supabaseClient.from('profiles').select('id');
    const { data: bookings } = await supabaseClient.from('bookings').select('id');

    document.getElementById('statHostels').textContent = hostels?.length || 0;
    document.getElementById('statUsers').textContent = profiles?.length || 0;
    document.getElementById('statBookings').textContent = bookings?.length || 0;
}

async function fetchAllProfiles() {
    const { data, error } = await supabaseClient.from('profiles').select('*');
    const container = document.getElementById('adminUserList');
    if (data) {
        container.innerHTML = data.map((p, index) => `
            <tr class="animate-item" style="animation-delay: ${index * 0.05}s">
                <td>${p.name}</td>
                <td>${p.email}</td>
                <td><span class="badge ${p.role === 'admin' ? 'bg-danger' : 'bg-info'}">${p.role}</span></td>
                <td>${new Date(p.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }
}

async function fetchAdminHostels() {
    const { data, error } = await supabaseClient.from('hostels').select('*');
    const container = document.getElementById('adminHostelList');
    if (data && container) {
        container.innerHTML = data.map((h, index) => `
            <tr class="animate-item" style="animation-delay: ${index * 0.05}s">
                <td>${h.name}</td>
                <td>${h.location}</td>
                <td>$${(h.price_cents / 100).toFixed(2)}</td>
                <td><span class="badge ${h.status === 'available' ? 'bg-success' : 'bg-secondary'}">${h.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteHostel('${h.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

async function deleteHostel(id) {
    if (!confirm('Are you sure you want to delete this hostel?')) return;
    const { error } = await supabaseClient.from('hostels').delete().eq('id', id);
    if (error) {
        alert(error.message);
    } else {
        fetchAdminStats();
        fetchAdminHostels();
    }
}

async function handleCreateHostel(e) {
    e.preventDefault();
    const name = document.getElementById('hName').value;
    const hLocation = document.getElementById('hLocation').value;
    const university = document.getElementById('hUniversity').value;
    const price = document.getElementById('hPrice').value;
    const image_url = document.getElementById('hImage').value;
    const description = document.getElementById('hDescription').value;

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient.from('hostels').insert([{
        owner_id: user.id,
        name,
        location: hLocation,
        university,
        description,
        price_cents: parseInt(price) * 100,
        image_url,
        status: 'available'
    }]);

    if (error) {
        alert(error.message);
    } else {
        alert('Hostel created successfully!');
        window.location.reload();
    }
}

// Global listener to handle OAuth redirects and session persistence
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        const path = window.location.pathname;
        const isAuthPage = path.endsWith('index.html') || path.endsWith('login.html') || path === '/' || path === '';
        if (isAuthPage) {
            await redirectUserByRole(session.user);
        }
    }
});

// Expose functions for global access
window.deleteHostel = deleteHostel;