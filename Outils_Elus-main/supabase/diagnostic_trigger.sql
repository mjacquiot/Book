-- =================================================================================
-- SCRIPT DE DÉBLOCAGE FINAL DES PROFILS (SUPPRESSION DES CONTRAINTES DE RÔLE)
-- =================================================================================

-- 1. On s'assure que la colonne "role" est bien du texte libre sans restriction stricte
-- Cela évite les plantages si la base de données refuse le mot "demo" ou autre.

DO $$
BEGIN
    -- Suppression d'une éventuelle contrainte CHECK sur le rôle
    BEGIN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Si 'role' est un type ENUM (rare mais possible), on tente d'ajouter 'demo'
    BEGIN
        EXECUTE 'ALTER TYPE user_role ADD VALUE IF NOT EXISTS ''demo''';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- 2. On reconstruit le trigger avec des logs pour comprendre d'où vient l'erreur
CREATE OR REPLACE FUNCTION public.sync_user_email_on_signup()
RETURNS TRIGGER AS $$
DECLARE
    clean_demo_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Nettoyage de la date
    BEGIN
        IF NEW.raw_user_meta_data->>'demo_expires_at' IN ('', 'null', 'undefined') THEN
            clean_demo_date := NULL;
        ELSE
            clean_demo_date := (NEW.raw_user_meta_data->>'demo_expires_at')::TIMESTAMP WITH TIME ZONE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        clean_demo_date := NULL;
    END;

    -- 2. Insertion principale
    INSERT INTO public.profiles (
        id, 
        email,
        username,
        role,
        collectivite_id,
        demo_expires_at
    )
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', 'Nouveau Membre'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'elu'),
        NEW.raw_user_meta_data->>'collectivite_id',
        clean_demo_date
    )
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.profiles.username),
        role = COALESCE(EXCLUDED.role, public.profiles.role),
        collectivite_id = COALESCE(EXCLUDED.collectivite_id, public.profiles.collectivite_id),
        demo_expires_at = COALESCE(EXCLUDED.demo_expires_at, public.profiles.demo_expires_at);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fallback ultra-bavard pour afficher L'ERREUR EXACTE dans le champ "username" !!
    BEGIN
        INSERT INTO public.profiles (id, email, username, role)
        VALUES (NEW.id, NEW.email, 'ERREUR DB: ' || SQLERRM, 'elu')
        ON CONFLICT (id) DO UPDATE SET username = 'ERREUR DB: ' || SQLERRM;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
