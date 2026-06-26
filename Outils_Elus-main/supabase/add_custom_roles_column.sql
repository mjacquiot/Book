-- Migration pour activer la fonctionnalité des rôles personnalisés
ALTER TABLE collectivity_roles_config ADD COLUMN IF NOT EXISTS custom_roles JSONB DEFAULT '[]'::jsonb;
