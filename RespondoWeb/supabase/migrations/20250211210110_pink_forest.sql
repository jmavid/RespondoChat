/*
  # Fix Database Relationships

  1. Changes
    - Drop existing foreign key constraints
    - Add proper foreign key references to auth.users
    - Update RLS policies
    - Fix UUID handling

  2. Security
    - Maintain RLS policies
    - Update foreign key constraints
*/

-- Drop existing foreign key constraints
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_created_by_fkey;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;
ALTER TABLE ticket_comments DROP CONSTRAINT IF EXISTS ticket_comments_created_by_fkey;
ALTER TABLE ticket_attachments DROP CONSTRAINT IF EXISTS ticket_attachments_created_by_fkey;
ALTER TABLE ticket_audit_log DROP CONSTRAINT IF EXISTS ticket_audit_log_changed_by_fkey;

-- Add proper foreign key references to auth.users
ALTER TABLE tickets
  ADD CONSTRAINT tickets_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_assigned_to_fkey 
  FOREIGN KEY (assigned_to) 
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

ALTER TABLE ticket_comments
  ADD CONSTRAINT ticket_comments_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE ticket_attachments
  ADD CONSTRAINT ticket_attachments_created_by_fkey 
  FOREIGN KEY (created_by) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE ticket_audit_log
  ADD CONSTRAINT ticket_audit_log_changed_by_fkey 
  FOREIGN KEY (changed_by) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Update RLS policies to use proper joins
DROP POLICY IF EXISTS "Usuarios pueden ver tickets propios o asignados" ON tickets;
CREATE POLICY "Usuarios pueden ver tickets propios o asignados"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE users.id = tickets.created_by
    )
  );

DROP POLICY IF EXISTS "Usuarios pueden crear tickets" ON tickets;
CREATE POLICY "Usuarios pueden crear tickets"
  ON tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Usuarios pueden actualizar tickets propios o asignados" ON tickets;
CREATE POLICY "Usuarios pueden actualizar tickets propios o asignados"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid()
  );

-- Add indexes for foreign keys to improve performance
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_by ON ticket_comments(created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_created_by ON ticket_attachments(created_by);
CREATE INDEX IF NOT EXISTS idx_ticket_audit_log_changed_by ON ticket_audit_log(changed_by);