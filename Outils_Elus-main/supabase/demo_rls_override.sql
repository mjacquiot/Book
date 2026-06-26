-- =================================================================================
-- SCRIPT ULTIME : DÉVERROUILLAGE DES DROITS RLS POUR LE RÔLE "DEMO"
-- =================================================================================
-- Ce script ajoute des règles de sécurité (Policies) additives pour garantir 
-- que le rôle "demo" a EXACTEMENT les mêmes droits qu'un "admin" dans la base de données.

DO $$
DECLARE
    t_name text;
    tables_to_unlock text[] := ARRAY['allowed_registrations', 'profiles', 'themes', 'subjects', 'documents', 'councils', 'messages', 'collectivity_roles_config'];
BEGIN
    FOREACH t_name IN ARRAY tables_to_unlock
    LOOP
        -- 1. On supprime la règle "demo" si elle existait déjà pour la recréer proprement
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "demo_admin_access" ON public.%I', t_name);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- 2. On crée la nouvelle règle de sécurité absolue pour le rôle "demo"
        -- Le rôle "demo" peut lire et écrire tout ce qui concerne sa propre collectivité (ou globalement)
        BEGIN
            EXECUTE format('
                CREATE POLICY "demo_admin_access" ON public.%I
                FOR ALL 
                USING (
                    (SELECT role FROM public.profiles WHERE profiles.id = auth.uid()) = ''demo''
                    OR
                    (SELECT role FROM public.profiles WHERE profiles.id = auth.uid()) = ''superadmin''
                )
                WITH CHECK (
                    (SELECT role FROM public.profiles WHERE profiles.id = auth.uid()) = ''demo''
                    OR
                    (SELECT role FROM public.profiles WHERE profiles.id = auth.uid()) = ''superadmin''
                );
            ', t_name);
        EXCEPTION WHEN OTHERS THEN 
            RAISE NOTICE 'Impossible de créer la policy sur %', t_name;
        END;
    END LOOP;
END $$;
