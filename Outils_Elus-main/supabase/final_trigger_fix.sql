-- =================================================================================
-- SCRIPT FINAL : CORRECTION DU TYPE ENUM (user_role)
-- =================================================================================

-- On recrée la fonction Trigger en forçant la conversion du texte en ENUM (::public.user_role)
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

    -- 2. Insertion principale avec CAST (::public.user_role)
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
        -- C'est ici que ça plantait : on force la conversion du texte en public.user_role
        (COALESCE(NEW.raw_user_meta_data->>'role', 'elu'))::public.user_role,
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
    -- Fallback de diagnostic au cas où un autre souci arrive
    BEGIN
        INSERT INTO public.profiles (id, email, username, role)
        VALUES (NEW.id, NEW.email, 'ERREUR DB: ' || SQLERRM, 'elu'::public.user_role)
        ON CONFLICT (id) DO UPDATE SET username = 'ERREUR DB: ' || SQLERRM;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
