# Dossier d'Architecture Technique & Sécurité : Plateforme EluConnect

**Destinataire :** Direction des Systèmes d'Information (DSI) / Responsable de la Sécurité des Systèmes d'Information (RSSI)  
**Objet :** Architecture "Privacy-by-Design" et Souveraineté des données dans l'usage de l'IA Générative.

---

## 1. Résumé Exécutif

EluConnect est une solution SaaS de nouvelle génération conçue spécifiquement pour les collectivités territoriales. Contrairement aux solutions d'IA classiques, EluConnect repose sur un paradigme de **confidentialité absolue** grâce à une architecture de **pseudonymisation locale (Edge Computing)** et une gestion des clés de chiffrement de type **Zero-Knowledge**.

---

## 2. Architecture Logicielle

La plateforme utilise une architecture découplée (Decoupled Frontend/Backend) garantissant scalabilité et sécurité.

### 2.1. Frontend & Edge Computing (Côté Client)
*   **Technologie :** Single Page Application (SPA) en JavaScript Vanille (performance brute, absence de dépendances lourdes).
*   **Web Workers :** Utilisation intensive de threads séparés pour le traitement asynchrone (OCR, Parsing PDF, Inférence NLP).
*   **IA Locale (Transformers.js) :** Intégration de modèles de langage compressés (Small Language Models) exécutés directement dans le navigateur du collaborateur pour l'extraction d'entités nommées (NER).

### 2.2. Backend & Persistance (Côté Serveur)
*   **Base de Données :** PostgreSQL avec extension postgis (géospatial) et pgvector (pour le RAG futur).
*   **Infrastructure :** Déploiement sur infrastructure souveraine (Supabase / AWS EU-West-3 ou équivalent français).
*   **Multi-Tenancy :** Cloisonnement étanche des données par **Row Level Security (RLS)**. Chaque ligne en base est protégée par une politique `collectivite_id` vérifiée au niveau du moteur de la base de données.

---

## 3. Sécurité & "Zero-Knowledge"

C'est le cœur de la confiance EluConnect. Aucun administrateur système, pas même l'hébergeur, n'a accès aux données d'identité réelles des collectivités.

### 3.1. Gestion des Clés (PKI Client-Side)
1.  **Vault Key :** Dérivée du mot de passe utilisateur via un algorithme de dérivation de clé fort (PBKDF2/Scrypt).
2.  **Cloud Wallet :** Une paire de clés asymétriques (RSA/ECDSA) est générée à la première connexion. La clé privée est chiffrée localement par la *Vault Key* avant d'être synchronisée.
3.  **Clé de Collectivité (AES-256 GCM) :** Clé symétrique partagée entre les membres autorisés d'une même mairie, permettant de déchiffrer le dictionnaire de pseudonymisation commun.

### 3.2. Flux de Pseudonymisation (Anonymisation dynamique)
Avant qu'une requête ne soit transmise à un modèle de langage (LLM) externe (OpenAI, Mistral, Gemini) :
1.  **Extraction NER Locale :** Le Web Worker analyse le texte pour identifier les noms, téléphones, emails.
2.  **Mapping chiffré :** Chaque entité réelle est hachée (HMAC-SHA256) et associée à un pseudonyme aléatoire.
3.  **Transfert "Blindé" :** Seul le texte pseudonymisé quitte le périmètre de la collectivité.

---

## 4. Conformité RGPD

La solution a été construite pour répondre aux exigences les plus strictes de la CNIL et du RGPD :
*   **Droit à l'oubli :** Implémenté via `ON DELETE CASCADE` garantissant la destruction de toutes les clés et données rattachées.
*   **Minimisation :** Seules les données hachées (pré-anonymisées) sont stockées pour la réutilisation du dictionnaire entre collaborateurs.
*   **Souveraineté :** Support natif des modèles LLM européens (Mistral AI) via des API sécurisées.

---

## 5. Performances Techniques

*   **OCR Intelligent :** Intégration de Tesseract.js pour le traitement des documents numérisés sans transfert serveur.
*   **RAG (Retrieval Augmented Generation) :** Injection de contexte métier local après filtrage de confidentialité, permettant une précision de réponse > 95% sur les sujets administratifs.
*   **Offline First :** L'application conserve une partie de sa logique et de son dictionnaire en `localStorage` pour une réactivité instantanée.

---

## 6. Schéma de Données Simplifié (DSI)

```mermaid
graph LR
    A[Utilisateur] -->|Data + Password| B(Navigateur Client)
    B -->|Inférence NER Locale| C{Anonymisation}
    C -->|Hash Identités| D[Supabase Vault]
    C -->|Texte Pseudonymisé| E[API LLM Externe]
    E -->|Réponse "Masquée"| B
    B -->|Désanonymisation| A
```

---

**Conclusion technique :** EluConnect n'est pas un simple "wrapper" d'IA. C'est une couche de confiance (Trust Layer) qui permet aux agents publics d'utiliser la puissance de l'IA sans jamais compromettre le secret professionnel ou les données personnelles des administrés.
