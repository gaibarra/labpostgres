-- =============================================================================
--  SCRIPT DE INSERCIÓN DE PACIENTES FICTICIOS
-- =============================================================================
--  Instrucciones:
--  1. Ve a tu proyecto de Supabase.
--  2. En el menú de la izquierda, haz clic en "SQL Editor".
--  3. Haz clic en "+ New query".
--  4. Copia y pega TODO el contenido de este archivo en el editor.
--  5. Haz clic en "RUN".
--
--  Este script creará 10 pacientes ficticios localizados en
--  Navojoa, Sonora, México.
--
--  El script es seguro de ejecutar múltiples veces. Gracias a la cláusula
--  ON CONFLICT, si un paciente con un email ya existe, simplemente se
--  ignorará la inserción de esa fila.
-- =============================================================================

INSERT INTO public.patients (full_name, date_of_birth, sex, email, phone_number, address)
VALUES
    ('José Luis Hernández García', '1985-03-15', 'Masculino', 'paciente.navojoa.1@test.com', '6421234567', 'Calle Pesqueira 110, Colonia Centro, Navojoa, Sonora, México'),
    ('María Guadalupe Martínez López', '1992-07-22', 'Femenino', 'paciente.navojoa.2@test.com', '6427654321', 'Avenida Obregón 25, Colonia Reforma, Navojoa, Sonora, México'),
    ('Francisco Javier González Pérez', '1978-11-30', 'Masculino', 'paciente.navojoa.3@test.com', '6421122334', 'Boulevard Centenario 500, Colonia Sonora, Navojoa, Sonora, México'),
    ('Juana Isabel Rodríguez Sánchez', '2001-01-10', 'Femenino', 'paciente.navojoa.4@test.com', '6425556677', 'Calle No Reelección 303, Colonia Juárez, Navojoa, Sonora, México'),
    ('Antonio Ramírez Flores', '1965-05-25', 'Masculino', 'paciente.navojoa.5@test.com', '6428889900', 'Callejón del Deporte 45, Colonia Deportiva, Navojoa, Sonora, México'),
    ('Margarita Gómez Díaz', '1988-09-18', 'Femenino', 'paciente.navojoa.6@test.com', '6423219876', 'Avenida Morelos 820, Colonia Constitución, Navojoa, Sonora, México'),
    ('Jesús Manuel Castillo Ortiz', '1995-02-28', 'Masculino', 'paciente.navojoa.7@test.com', '6424561237', 'Calle Talamante 12, Colonia Beltrones, Navojoa, Sonora, México'),
    ('Sofía Elena Vázquez Cruz', '1999-06-05', 'Femenino', 'paciente.navojoa.8@test.com', '6429876543', 'Calle Rayón 711, Colonia SOP, Navojoa, Sonora, México'),
    ('Miguel Ángel Jiménez Reyes', '1980-12-12', 'Masculino', 'paciente.navojoa.9@test.com', '6421002030', 'Avenida Allende 44, Colonia Centro, Navojoa, Sonora, México'),
    ('Verónica Patricia Mendoza Ruiz', '1993-08-01', 'Femenino', 'paciente.navojoa.10@test.com', '6426789012', 'Boulevard Cuauhtémoc 91, Colonia Tepeyac, Navojoa, Sonora, México')
ON CONFLICT (email) DO NOTHING;

-- Mensaje de confirmación
SELECT '10 pacientes ficticios de Navojoa, Sonora, han sido insertados o ignorados si ya existían.' as "Resultado";