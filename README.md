# Nevada — Gestion d'un centre de langues

Application web de gestion pour un centre de langues, réalisée avec **Next.js 16** (App Router) et **MongoDB**.

> Conception : schéma de collections MongoDB + règles métier fournis dans le brief (voir `design-conception.md`).

## Fonctionnalités

### Gestion complète (CRUD) de 9 collections
- **Étudiants** & **Professeurs** : prénom, nom, CIN (unique), téléphone, mail
- **Langues** & **Niveaux** : catalogue pédagogique (A1 → C1, commun aux langues)
- **Groupes** : prof_id, langue_id, niveau_id, start_date, end_date (null = actif)
- **Inscriptions** : étudiant, langue, niveaux multiples, prix, date de début, `expired_at`
- **Étudiants ↔ Groupes** : affectations avec période (end_date null = active)
- **Paiements** : inscription, date, statut `en_attente` / `payer` / `annuler`, montant
- **Utilisateurs** (admin) : identifiant, mot de passe, rôle
- **Audits** (admin) : journal de toutes les activités des utilisateurs

Toutes les collections portent `created_at`, `updated_at`, `deleted_at` (suppression logique).

### Règles métier (conformes à la conception)
1. **Une seule inscription active** (expired_at: null) par étudiant / langue / niveau — vérifiée à l'ajout et à la modification (erreur 409 explicite).
2. **Un seul groupe actif** (end_date: null) par étudiant et par langue — vérifié à l'ajout et à la modification.
3. **Expiration d'une inscription** : une analyse affiche les groupes actifs de la même langue et demande confirmation ; en un clic, la relation de groupe est clôturée (end_date du jour). L'auto-désinscription peut être refusée (case à cocher).
4. **Un seul paiement par inscription et par date**.
5. **Bouton « Générer les paiements du jour »** : analyse les inscriptions actives dont `start_date = aujourd'hui` sans paiement à cette date, puis crée les paiements avec le statut « en attente ».

### Rôles & permissions
| Action | Assistant | Gestionnaire | Admin |
|---|---|---|---|
| Ajouter / consulter | ✓ | ✓ | ✓ |
| Modifier | — | ✓ | ✓ |
| Supprimer | — | — | ✓ |
| Page **Gains** | — | ✓ | ✓ |
| Pages **Utilisateurs** & **Audits** | — | — | ✓ |

### Recherche, filtres, tri, pagination — partout
- **Recherche** plein texte (debounce 350 ms) sur les champs pertinents
- **Filtres** par langue, statut, professeur, rôle, mois… selon la page
- **Tri** par champ + **bouton de bascule de direction ASC ⇄ DESC**
- **Pagination** numérotée (10 / 25 / 50 par page)
- **Tout l'état vit dans l'URL** (`?q=&sort=&dir=&page=&limit=&filtres=…`) : un refresh ou un lien partagé conserve exactement la position de l'utilisateur.

### Suivi financier (page Gains)
Encaissé / en attente / annulé sur l'année, graphique mensuel, répartition par langue, filtres année + langue.

## Démarrage

```bash
# 1. Dépendances
bun install

# 2. MongoDB (local) — ajuster .env si besoin
#    MONGODB_URI=mongodb://127.0.0.1:27017
#    MONGODB_DB=nevada
#    AUTH_SECRET=<chaîne aléatoire>

# 3. Données de démonstration (68 étudiants, 91 inscriptions, 79 paiements…)
bun run seed

# 4. Développement
bun run dev
```

### Comptes de démonstration
| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Administrateur | `admin` | `admin123` |
| Gestionnaire | `manager` | `manager123` |
| Assistant | `assistant` | `assistant123` |

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Connexion
│   ├── formulaire-connexion.tsx  # Formulaire + signature visuelle
│   ├── (app)/                    # Espace protégé (garde de session)
│   │   ├── dashboard/            # Tableau de bord
│   │   ├── etudiants/ profs/ langues/ niveaux/ groupes/
│   │   ├── etudiants-groupes/ inscriptions/ paiements/
│   │   ├── gains/ audits/ utilisateurs/
│   ├── api/                      # API REST (auth + 10 ressources)
│   │   ├── paiements/generer/    # Analyse + génération du jour
│   │   └── inscriptions/[id]/expirer/
├── components/                   # AppShell, DataTable, ListToolbar,
│                                 # PaginationBar, EntityDialog…
├── hooks/
│   ├── use-list-query.ts         # Pagination/recherche/filtres/tri ↔ URL
│   └── use-options.ts            # Options des listes déroulantes
└── lib/
    ├── mongo.ts                  # Client MongoDB + collections typées
    ├── auth.ts                   # JWT (jose) + cookie httpOnly + gardes
    ├── regles.ts                 # Règles métier (unicités)
    └── …
scripts/seed.ts                   # Jeu de données de démonstration
```

## Sécurité
- Mots de passe hachés (bcrypt, 10 tours)
- Session JWT signée (HS256) en cookie `httpOnly` (8 h)
- Contrôles de rôle côté API **et** côté interface
- Journalisation d'audit sur chaque mutation et connexion

## Design
Direction « l'ardoise du professeur » : sidebar vert pin profond, papier sauge,
typographie **Bricolage Grotesque** (titres), **Instrument Sans** (texte) et
**IBM Plex Mono** (données). Signature : le « ruban des langues », bandeau de
glyphes du monde entier (respecte `prefers-reduced-motion`).
