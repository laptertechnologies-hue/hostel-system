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
- DATABASE_URL
- GOOGLE_CLIENT_ID
- VITE_GOOGLE_CLIENT_ID
- JWT_SECRET
- ALLOWED_ORIGINS

## Google client ID
Use this Client ID in both GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID:
560793221927-d89ap70eogakodgeocsmhbve3ahjifon.apps.googleusercontent.com

Add https://hostel-system-lac.vercel.app to the authorized origins in Google Cloud Console.

## Deploy to Vercel
1. Push this repository to GitHub
2. Import the repo in Vercel
3. Add the environment variables above
4. Deploy

Vercel will redeploy automatically on every push to GitHub.
