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

async function handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const university = document.getElementById('signupUniversity').value;
    const role = document.getElementById('signupRole').value;

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { name, university, role }
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
        window.location.href = 'dashboard.html';
    }
}

async function fetchHostels() {
    const hostelList = document.getElementById('hostelList');
    const { data, error } = await supabaseClient
        .from('hostels')
        .select('*')
        .eq('status', 'available');

    if (error) {
        console.error('Error fetching hostels:', error.message);
        return;
    }

    hostelList.innerHTML = data.length ? data.map(hostel => `
        <div class="col-md-4">
            <div class="card h-100 shadow-sm">
                <img src="${hostel.image_url || 'https://via.placeholder.com/300x200'}" class="card-img-top" alt="${hostel.name}">
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