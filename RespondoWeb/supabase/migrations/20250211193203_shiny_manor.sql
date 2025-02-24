/*
  # Sistema de Gestión de Tickets

  1. Nuevas Tablas
    - `tickets`
      - Tabla principal para almacenar tickets
      - Incluye todos los campos básicos y relaciones
    - `ticket_comments`
      - Almacena comentarios y actualizaciones de tickets
    - `ticket_attachments`
      - Gestiona archivos adjuntos asociados a tickets
    - `ticket_audit_log`
      - Registra todos los cambios realizados en tickets

  2. Enums
    - ticket_status
    - ticket_priority
    - ticket_category
    - ticket_source

  3. Security
    - RLS habilitado en todas las tablas
    - Políticas específicas para cada rol
*/

-- Crear tipos enumerados
CREATE TYPE ticket_status AS ENUM (
  'open', 'in_progress', 'waiting_client', 'resolved', 'closed'
);

CREATE TYPE ticket_priority AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE ticket_category AS ENUM (
  'hardware', 'software', 'billing', 'network', 'security', 'other'
);

CREATE TYPE ticket_source AS ENUM (
  'web', 'email', 'api', 'chat'
);

-- Tabla principal de tickets
CREATE TABLE tickets (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  category ticket_category NOT NULL,
  source ticket_source NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  CONSTRAINT title_length CHECK (char_length(title) >= 3)
);

-- Tabla de comentarios
CREATE TABLE ticket_comments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Tabla de archivos adjuntos
CREATE TABLE ticket_attachments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  filesize BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Tabla de auditoría
CREATE TABLE ticket_audit_log (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Funciones y triggers para actualización automática
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Función para registro de auditoría
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
DECLARE
  field_name TEXT;
  old_value TEXT;
  new_value TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO ticket_audit_log (ticket_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'status', OLD.status::TEXT, NEW.status::TEXT, auth.uid());
    END IF;
    
    IF OLD.priority != NEW.priority THEN
      INSERT INTO ticket_audit_log (ticket_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'priority', OLD.priority::TEXT, NEW.priority::TEXT, auth.uid());
    END IF;
    
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO ticket_audit_log (ticket_id, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT, auth.uid());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_audit_log
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_changes();

-- Políticas de seguridad
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas para tickets
CREATE POLICY "Usuarios pueden ver tickets propios o asignados"
  ON tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid()
  );

CREATE POLICY "Usuarios pueden crear tickets"
  ON tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Usuarios pueden actualizar tickets propios o asignados"
  ON tickets
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid()
  );

-- Políticas para comentarios
CREATE POLICY "Usuarios pueden ver comentarios de sus tickets"
  ON ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Usuarios pueden crear comentarios en sus tickets"
  ON ticket_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
    )
  );

-- Políticas para archivos adjuntos
CREATE POLICY "Usuarios pueden ver archivos de sus tickets"
  ON ticket_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_attachments.ticket_id
      AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Usuarios pueden adjuntar archivos a sus tickets"
  ON ticket_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_attachments.ticket_id
      AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
    )
  );

-- Políticas para auditoría
CREATE POLICY "Usuarios pueden ver auditoría de sus tickets"
  ON ticket_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tickets
      WHERE tickets.id = ticket_audit_log.ticket_id
      AND (tickets.created_by = auth.uid() OR tickets.assigned_to = auth.uid())
    )
  );