-- =============================================================================
--  SCRIPT PARA ASIGNAR ROL DE ADMINISTRADOR
-- =============================================================================
--  Instrucciones:
--  1. Ve a tu proyecto de Supabase.
--  2. En el menú de la izquierda, haz clic en "SQL Editor".
--  3. Haz clic en "+ New query".
--  4. Copia y pega TODO el contenido de este archivo en el editor.
--  5. Haz clic en "RUN".
--
--  Este script asignará el rol 'Administrador' al usuario con el email
--  'gaibarra@hotmail.com'. Es seguro ejecutarlo varias veces.
-- =============================================================================

DO $$
DECLARE
    target_email TEXT := 'gaibarra@hotmail.com';
    user_id_to_update UUID;
    profile_exists BOOLEAN;
BEGIN
    -- 1. Buscar el ID del usuario en la tabla de autenticación
    SELECT id INTO user_id_to_update FROM auth.users WHERE email = target_email;

    -- 2. Si no se encuentra el usuario, mostrar un error.
    IF user_id_to_update IS NULL THEN
        RAISE EXCEPTION 'No se encontró un usuario con el email: %', target_email;
        RETURN;
    END IF;

    -- 3. Verificar si ya existe un perfil para este usuario
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = user_id_to_update) INTO profile_exists;

    -- 4. Si el perfil existe, actualizar el rol. Si no, crearlo.
    IF profile_exists THEN
        -- El perfil ya existe, así que lo actualizamos.
        UPDATE public.profiles
        SET role = 'Administrador'
        WHERE id = user_id_to_update;
        RAISE NOTICE 'Rol de administrador asignado correctamente a %.', target_email;
    ELSE
        -- El perfil no existe, lo creamos desde cero.
        INSERT INTO public.profiles (id, email, first_name, last_name, role)
        SELECT u.id, u.email, u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name', 'Administrador'
        FROM auth.users u
        WHERE u.id = user_id_to_update;
        RAISE NOTICE 'Perfil no existía. Se ha creado y asignado el rol de administrador a %.', target_email;
    END IF;

END $$;