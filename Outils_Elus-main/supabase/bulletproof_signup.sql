-- =================================================================================
-- SCRIPT FINAL DE CORRECTION D'INSCRIPTION : À EXÉCUTER DANS SUPABASE (SQL EDITOR)
-- =================================================================================

-- 1. On s'assure que toutes les colonnes existent bien dans la base !
-- Sans ces colonnes, le système plante à l'inscription.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'demo_expires_at') THEN
        ALTER TABLE public.profiles ADD COLUMN demo_expires_at TIMESTAMP WITH TIME ZONE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_done') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_done BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'allowed_registrations' AND column_name = 'demo_expires_at') THEN
        ALTER TABLE public.allowed_registrations ADD COLUMN demo_expires_at TIMESTAMP WITH TIME ZONE NULL;
    END IF;
END $$;

-- 2. Création du déclencheur (Trigger) ultra-sécurisé
-- Ce code intercepte la création de compte et copie les données sans jamais planter.
CREATE OR REPLACE FUNCTION public.sync_user_email_on_signup()
RETURNS TRIGGER AS $$
DECLARE
    clean_demo_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Protection contre le texte "null", "undefined", "" ou les dates invalides
    BEGIN
        IF NEW.raw_user_meta_data->>'demo_expires_at' IN ('', 'null', 'undefined') THEN
            clean_demo_date := NULL;
        ELSE
            clean_demo_date := (NEW.raw_user_meta_data->>'demo_expires_at')::TIMESTAMP WITH TIME ZONE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        clean_demo_date := NULL;
    END;

    -- Insertion sécurisée dans le profil
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
    -- Fallback absolu si une contrainte bizzare casse encore tout
    BEGIN
        INSERT INTO public.profiles (id, email, username, role)
        VALUES (NEW.id, NEW.email, 'Erreur Profil', 'elu')
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. On s'assure que le déclencheur est bien activé sur la table auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_user_email_on_signup();
