-- =================================================================================
-- SCRIPT DE RÉPARATION D'URGENCE (BOUCLE INFINIE RLS SUR PROFILES)
-- =================================================================================

DO $$
DECLARE
    t_name text;
    tables_to_unlock text[] := ARRAY['allowed_registrations', 'themes', 'subjects', 'documents', 'councils', 'messages', 'collectivity_roles_config'];
BEGIN
    -- 1. CORRECTION DU CRASH (BOUCLE INFINIE SUR PROFILES)
    -- On supprime immédiatement la policy cassée sur profiles
    BEGIN
        DROP POLICY IF EXISTS "demo_admin_access" ON public.profiles;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- On recrée une policy sur profiles SANS faire de SELECT sur profiles lui-même !
    -- On se base sur le JWT de l'utilisateur (auth.jwt()) ou on laisse les rules existantes gérer
    -- Pour le rôle demo, il peut au moins lire les profils de sa collectivité
    BEGIN
        CREATE POLICY "demo_admin_access" ON public.profiles
        FOR SELECT
        USING (
            collectivite_id = (auth.jwt()->'user_metadata'->>'collectivite_id')
            OR
            (auth.jwt()->'user_metadata'->>'role') = 'superadmin'
        );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 2. CORRECTION DES AUTRES TABLES (SANS BOUCLE)
    -- On utilise auth.jwt()->'user_metadata'->>'role' au lieu de faire un SELECT sur profiles !
    FOREACH t_name IN ARRAY tables_to_unlock
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "demo_admin_access" ON public.%I', t_name);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            EXECUTE format('
                CREATE POLICY "demo_admin_access" ON public.%I
                FOR ALL USING (
                    (auth.jwt()->''user_metadata''->>''role'') = ''demo''
                    OR (auth.jwt()->''user_metadata''->>''role'') = ''superadmin''
                ) WITH CHECK (
                    (auth.jwt()->''user_metadata''->>''role'') = ''demo''
                    OR (auth.jwt()->''user_metadata''->>''role'') = ''superadmin''
                );
            ', t_name);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;
