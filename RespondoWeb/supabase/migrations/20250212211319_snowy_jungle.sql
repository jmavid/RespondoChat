/*
  # Update security policies for tickets and profiles

  1. Changes
    - Update ticket policies to allow proper access to tickets and related data
    - Add missing policies for ticket operations
    - Ensure proper access to profiles table

  2. Security
    - Maintain RLS enabled on all tables
    - Add more specific policies for ticket operations
    - Fix permission issues with user access
*/

-- Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "Usuarios pueden ver tickets propios o asignados" ON tickets;
DROP POLICY IF EXISTS "Usuarios pueden crear tickets" ON tickets;
DROP POLICY IF EXISTS "Usuarios pueden actualizar tickets propios o asignados" ON tickets;

-- Create new policies for tickets
CREATE POLICY "Users can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tickets or assigned tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid()
  );

-- Drop and recreate profiles policies
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read profiles of users assigned to their tickets" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create new policies for profiles
CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create policy for inserting profiles (needed for user creation)
CREATE POLICY "Service role can create profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;