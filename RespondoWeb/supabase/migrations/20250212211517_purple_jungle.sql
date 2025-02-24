/*
  # Fix table relationships and references

  1. Changes
    - Add proper foreign key relationships between tables
    - Update ticket queries to use profiles table
    - Fix join queries for tickets and comments

  2. Security
    - Maintain RLS enabled
    - Update policies to work with new relationships
*/

-- Drop existing foreign key constraints if they exist
ALTER TABLE tickets 
  DROP CONSTRAINT IF EXISTS tickets_created_by_fkey,
  DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;

ALTER TABLE ticket_comments 
  DROP CONSTRAINT IF EXISTS ticket_comments_created_by_fkey;

-- Recreate foreign key constraints to reference profiles table
ALTER TABLE tickets
  ADD CONSTRAINT tickets_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id)
  ON DELETE CASCADE;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_assigned_to_fkey 
  FOREIGN KEY (assigned_to) 
  REFERENCES profiles(id)
  ON DELETE SET NULL;

ALTER TABLE ticket_comments
  ADD CONSTRAINT ticket_comments_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Create indexes to improve join performance
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_by ON ticket_comments(created_by);

-- Update policies to use proper joins
DROP POLICY IF EXISTS "Users can view all tickets" ON tickets;
CREATE POLICY "Users can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = tickets.created_by
      OR profiles.id = tickets.assigned_to
    )
  );

-- Update comment policies to use proper joins
DROP POLICY IF EXISTS "Usuarios pueden ver comentarios de sus tickets" ON ticket_comments;
CREATE POLICY "Users can view ticket comments"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.created_by = auth.uid()
        OR tickets.assigned_to = auth.uid()
      )
    )
  );

-- Create views for easier querying
CREATE OR REPLACE VIEW ticket_details AS
SELECT 
  t.*,
  creator.email as creator_email,
  assignee.email as assignee_email
FROM tickets t
LEFT JOIN profiles creator ON t.created_by = creator.id
LEFT JOIN profiles assignee ON t.assigned_to = assignee.id;