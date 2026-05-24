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
);

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
);

CREATE TABLE IF NOT EXISTS hostel_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  image_url STRING NOT NULL,
  caption STRING,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID REFERENCES hostels(id),
  room_name STRING NOT NULL,
  room_type STRING NOT NULL DEFAULT 'shared',
  price_cents INT NOT NULL DEFAULT 0,
  capacity INT NOT NULL DEFAULT 1,
  status STRING NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT now()
);

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
);
