-- Create Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Brackets table
CREATE TABLE brackets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  picks JSONB NOT NULL DEFAULT '{}',
  score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Master Key table (only one row expected)
CREATE TABLE master_key (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  winners JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial empty master key row
INSERT INTO master_key (winners) VALUES ('{}');
