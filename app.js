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
    const { data: profile, error } = await supabaseClient.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
    if (error || !profile || profile.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return null;
    }
    return session;
}

async function requireAuth(action) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        action(session);
    } else {
        alert('Please login or sign up to view contact details and book rooms.');
        window.location.href = 'login.html';
    }
}

async function redirectUserByRole(user) {
    if (!user) return;
    
    try {
        // The 'profiles' table is the source of truth for the assigned role.
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
        
        if (error) {
            console.warn("Could not fetch profile, falling back to metadata:", error.message);
        }

        // Use DB role. If profile doesn't exist (sync lag), check metadata, otherwise student.
        const role = profile?.role || user.user_metadata?.role || 'student';
        console.log("Auth System: Identifying role...", role);

        if (role === 'admin') {
            window.location.replace('admin.html');
        } else {
            window.location.replace('dashboard.html');
        }
    } catch (err) {
        console.error('Redirection Logic Failed:', err.message);
        window.location.replace('dashboard.html');
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
    }
    // Redirection is handled globally by onAuthStateChange listener
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

async function fetchHostels() {
    const hostelList = document.getElementById('hostelList');
    // Fetch rooms joined with hostel information
    const { data, error } = await supabaseClient
        .from('rooms')
        .select('*, hostels(name, location, description)')
        .eq('status', 'available');

    if (error) {
        console.error('Error fetching rooms:', error.message);
        return;
    }

    hostelList.innerHTML = data.length ? data.map((hostel, index) => `
        <div class="col-md-4 animate-item" style="animation-delay: ${index * 0.1}s">
            <div class="card h-100 shadow-sm hostel-card">
                <img src="${hostel.image_url || 'https://via.placeholder.com/300x200'}" class="card-img-top" alt="${hostel.room_type} at ${hostel.hostels?.name}" style="height: 220px; object-fit: cover;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title mb-0">${hostel.room_type.toUpperCase()}</h5>
                        <span class="badge bg-primary rounded-pill">${hostel.hostels?.name || 'Hostel'}</span>
                    </div>
                    <p class="card-text text-muted small mb-2">
                        <i class="bi bi-geo-alt"></i> ${hostel.hostels?.location || 'Location Not Set'}
                    </p>
                    <p class="card-text text-secondary small">${hostel.hostels?.description || 'No description available.'}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-success">$${(hostel.price_cents / 100).toFixed(2)} <small class="text-muted">/sem</small></span>
                        <button class="btn btn-sm btn-primary" onclick="requireAuth(() => alert('Owner Contact: ${hostel.contact_info || 'Available upon request'}'))">
                            Check Details
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('') : '<div class="col-12 text-center py-5"><p class="text-muted">No rooms are currently listed as available.</p></div>';
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
                <td class="fw-bold">${h.name}</td>
                <td><i class="bi bi-geo-alt small text-muted"></i> ${h.location}</td>
                <td><span class="badge ${h.status === 'available' ? 'bg-success' : 'bg-secondary'}">${h.status}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light border me-1" onclick="prepareRoomModal('${h.id}')" data-bs-toggle="modal" data-bs-target="#addRoomModal">
                        <i class="bi bi-door-open"></i> Add Room
                    </button>
                    <button class="btn btn-sm btn-danger opacity-75" onclick="deleteHostel('${h.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

async function fetchAdminBookings() {
    const { data, error } = await supabaseClient
        .from('bookings')
        .select('*, profiles(name, email), hostels(name), rooms(room_type)')
        .order('created_at', { ascending: false });

    const container = document.getElementById('adminBookingList');
    if (data && container) {
        container.innerHTML = data.map((b, index) => {
            const statusClass = b.booking_status === 'paid' ? 'bg-success' : 
                                b.booking_status === 'pending' ? 'bg-warning text-dark' : 'bg-info';
            return `
                <tr class="animate-item" style="animation-delay: ${index * 0.05}s">
                    <td>
                        <div class="fw-bold">${b.profiles?.name || 'Unknown'}</div>
                        <small class="text-muted">${b.profiles?.email || ''}</small>
                    </td>
                    <td>${b.hostels?.name || 'N/A'} <small class="text-muted">(${b.rooms?.room_type || 'Room'})</small></td>
                    <td><span class="badge bg-light text-dark border">Visit</span></td>
                    <td>${new Date(b.created_at).toLocaleDateString()}</td>
                    <td><span class="badge ${statusClass}">${b.booking_status.toUpperCase()}</span></td>
                </tr>
            `;
        }).join('');
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

async function uploadImage(file) {
    const fileExt = file.name.split('.').pop();
    // Use a timestamp and a random string to ensure unique filenames for room images
    const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
    const filePath = `room-images/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('hostel-images')
        .upload(filePath, file);

    if (uploadError) {
        console.error("Storage Upload Error:", uploadError);
        throw new Error(`Image Upload Failed: ${uploadError.message}`);
    }

    const { data } = supabaseClient.storage
        .from('hostel-images')
        .getPublicUrl(filePath);

    return data.publicUrl;
}

async function handleCreateRoom(e) {
    e.preventDefault();
    const hostelId = document.getElementById('rHostelId').value;
    const type = document.getElementById('rType').value;
    const price = document.getElementById('rPrice').value;
    const contact = document.getElementById('rContact').value;
    const imageFile = document.getElementById('rImageFile').files[0];

    if (!hostelId) {
        alert('Error: No hostel selected. Please close the modal and try again.');
        return;
    }

    try {
        const session = await supabaseClient.auth.getSession();
        console.log("Active Session User:", session.data.session?.user?.email);

        console.log("Step 1: Uploading Image...");
        const imageUrl = await uploadImage(imageFile);

        console.log("Step 2: Inserting Room Data...");
        const { error } = await supabaseClient.from('rooms').insert([{
            hostel_id: hostelId,
            room_type: type,
            room_name: type,
            price_cents: Math.round(Number(price) * 100),
            contact_info: contact,
            image_url: imageUrl,
            status: 'available'
        }]);

        if (error) {
            console.error("Database Insert Error:", error);
            throw error;
        }
        
        alert('Room added successfully!');
        e.target.reset();
        bootstrap.Modal.getInstance(document.getElementById('addRoomModal')).hide();
        // Refresh admin stats to show updated counts
        fetchAdminStats();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function prepareRoomModal(hostelId) {
    document.getElementById('rHostelId').value = hostelId;
}

async function handleCreateHostel(e) {
    e.preventDefault();
    const name = document.getElementById('hName').value;
    const hLocation = document.getElementById('hLocation').value;
    const university = document.getElementById('hUniversity').value;
    const description = document.getElementById('hDescription').value;

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient.from('hostels').insert([{
        owner_id: user.id,
        name,
        location: hLocation,
        university,
        description,
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
window.prepareRoomModal = prepareRoomModal;