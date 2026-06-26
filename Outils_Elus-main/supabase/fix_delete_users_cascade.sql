-- =================================================================================
-- SCRIPT DE RÉPARATION SUPABASE : CONTRAINTES DE CLÉS ÉTRANGÈRES ("CASCADE DELETE")
-- 
-- Exécutez ce script dans la section "SQL Editor" de votre Dashboard Supabase 
-- pour autoriser la suppression des utilisateurs (évite l'erreur "Database Error").
-- =================================================================================

-- 1. Table: user_crypto_keys
ALTER TABLE public.user_crypto_keys DROP CONSTRAINT IF EXISTS user_crypto_keys_user_id_fkey;
ALTER TABLE public.user_crypto_keys
    ADD CONSTRAINT user_crypto_keys_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Table: collectivity_shared_keys
ALTER TABLE public.collectivity_shared_keys DROP CONSTRAINT IF EXISTS collectivity_shared_keys_user_id_fkey;
ALTER TABLE public.collectivity_shared_keys
    ADD CONSTRAINT collectivity_shared_keys_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Table: profiles (Essentiel !)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Options Additionnelles : Si certaines de ces tables existent et référencent l'utilisateur, on applique le Cascade

-- Table: themes (si created_by référence auth.users)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'themes_created_by_fkey') THEN
        ALTER TABLE public.themes DROP CONSTRAINT themes_created_by_fkey;
        ALTER TABLE public.themes ADD CONSTRAINT themes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Table: subjects
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subjects_created_by_fkey') THEN
        ALTER TABLE public.subjects DROP CONSTRAINT subjects_created_by_fkey;
        ALTER TABLE public.subjects ADD CONSTRAINT subjects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Table: documents
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'documents_created_by_fkey') THEN
        ALTER TABLE public.documents DROP CONSTRAINT documents_created_by_fkey;
        ALTER TABLE public.documents ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Table: allowed_registrations
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'allowed_registrations_created_by_fkey') THEN
        ALTER TABLE public.allowed_registrations DROP CONSTRAINT allowed_registrations_created_by_fkey;
        ALTER TABLE public.allowed_registrations ADD CONSTRAINT allowed_registrations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Table: user_roles_history (si existante)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_history_user_id_fkey') THEN
        ALTER TABLE public.user_roles_history DROP CONSTRAINT user_roles_history_user_id_fkey;
        ALTER TABLE public.user_roles_history ADD CONSTRAINT user_roles_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;
