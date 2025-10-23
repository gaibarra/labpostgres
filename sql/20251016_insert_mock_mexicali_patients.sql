-- 20251016_insert_mock_mexicali_patients.sql
-- Mock: 10 pacientes de Mexicali, Baja California
-- Esquema esperado: patients(id uuid DEFAULT gen_random_uuid(), external_id text, first_name text, last_name text, full_name generated, date_of_birth date, sex text, document_number text, email text, phone text, created_at, updated_at)
-- Nota: full_name es generado automáticamente (no se inserta).

BEGIN;

INSERT INTO patients (external_id, first_name, last_name, date_of_birth, sex, document_number, email, phone)
VALUES
  ('MXL-PT-001', 'Juan Carlos', 'López Hernández', '1985-03-12', 'M', 'MXC850312JCH1', 'juan.lopez.mxl@example.com',  '6865550101'),
  ('MXL-PT-002', 'María Fernanda', 'García Ramos',   '1992-07-25', 'F', 'MXC920725MFG2', 'maria.garcia.mxl@example.com', '6865550102'),
  ('MXL-PT-003', 'José Luis', 'Martínez Soto',       '1978-11-05', 'M', 'MXC781105JLM3', 'jose.martinez.mxl@example.com','6865550103'),
  ('MXL-PT-004', 'Ana Sofía', 'Pérez Valenzuela',    '2001-02-18', 'F', 'MXC010218ASP4', 'ana.perez.mxl@example.com',    '6865550104'),
  ('MXL-PT-005', 'Carlos Eduardo', 'Ramírez Núñez',  '1969-09-30', 'M', 'MXC690930CERN', 'carlos.ramirez.mxl@example.com','6865550105'),
  ('MXL-PT-006', 'Laura Jimena', 'Hernández Cota',   '2010-12-03', 'F', 'MXC101203LJHC', 'laura.hernandez.mxl@example.com','6865550106'),
  ('MXL-PT-007', 'Diego Alejandro', 'Torres Paredes','2005-05-21', 'M', 'MXC050521DATP', 'diego.torres.mxl@example.com', '6865550107'),
  ('MXL-PT-008', 'Valeria Ximena', 'Chávez Ochoa',   '1999-08-14', 'F', 'MXC990814VXCO', 'valeria.chavez.mxl@example.com','6865550108'),
  ('MXL-PT-009', 'Patricio Iván', 'Gómez Ibarra',    '1957-01-03', 'M', 'MXC570103PIGI', 'patricio.gomez.mxl@example.com','6865550109'),
  ('MXL-PT-010', 'Samanta Renata', 'Morales Vega',   '1988-04-09', 'O', 'MXC880409SRMV', 'samanta.morales.mxl@example.com','6865550110');

COMMIT;
