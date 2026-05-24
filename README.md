# HostelHub

A responsive hostel booking website for students, hostel owners, and admins.

## Features
- Student search by university, suburb, or area
- Login and registration flow using the real backend
- Google Sign-In support
- Owner dashboard to add hostels and pricing
- Admin overview area for live listings and bookings
- GitHub + Vercel deployment ready

## Local development
1. Install dependencies
   npm install
2. Create a local .env file with your values
3. Start the dev server
   npm run dev

## Required environment variables
Set these in Vercel and in your local .env file:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_GOOGLE_CLIENT_ID
- ALLOWED_ORIGINS

Public registrations are locked to the student role and are handled by Supabase Auth.

## Google client ID
Use this Client ID in VITE_GOOGLE_CLIENT_ID:
560793221927-d89ap70eogakodgeocsmhbve3ahjifon.apps.googleusercontent.com

Add https://hostel-system-lac.vercel.app to the authorized origins in Google Cloud Console.

## Supabase setup
1. Create a Supabase project.
2. Add the required environment variables above.
3. Run the SQL in [sql/schema.sql](sql/schema.sql) in the Supabase SQL editor.
4. Enable Google OAuth in Supabase and set the callback URL for your deployed app.

## Deploy to Vercel
1. Push this repository to GitHub
2. Import the repo in Vercel
3. Add the environment variables above
4. Deploy

Vercel will redeploy automatically on every push to GitHub.
