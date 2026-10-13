/**
 * Seed de la base « nevada » : comptes, langues, niveaux, professeurs,
 * étudiants, groupes, inscriptions, relations et paiements.
 *
 * Exécution : bun scripts/seed.ts
 */
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB = process.env.MONGODB_DB || "nevada";

/* PRNG déterministe (mulberry32) pour un seed reproductible. */
let graine = 20261013;
function rnd(): number {
  graine |= 0;
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function entre(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function choix<T>(arr: T[]): T {
  return arr[entre(0, arr.length - 1)];
}
function melange<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = entre(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Utilitaires de dates civiles. */
function aujourdhui(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
}
function dateMoins(nJours: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - nJours);
  return d.toISOString().slice(0, 10);
}

const PRENOMS_F = [
  "Yasmine", "Salma", "Aya", "Imane", "Nour", "Lina", "Sara", "Hajar", "Meryem",
  "Rania", "Amina", "Fatima", "Zineb", "Oumaima", "Chaimae", "Khadija", "Malak",
  "Ghita", "Ines", "Douae",
];
const PRENOMS_M = [
  "Youssef", "Omar", "Mehdi", "Adam", "Anas", "Rayan", "Amine", "Hamza", "Ilyas",
  "Reda", "Zakaria", "Bilal", "Ayoub", "Karim", "Nabil", "Soufiane", "Walid",
  "Achraf", "Yassine", "Otmane",
];
const NOMS = [
  "Benali", "Idrissi", "El Amrani", "Bennani", "Tazi", "El Fassi", "Chraibi",
  "Alaoui", "Berrada", "Sabri", "El Mansouri", "Kettani", "Lahlou", "Benkirane",
  "Harrak", "Ouazzani", "Belkadi", "Skalli", "El Malki", "Fassi Fihri",
];

const LANGUES = ["Français", "Anglais", "Espagnol", "Allemand", "Arabe"];
const NIVEAUX = ["A1", "A2", "B1", "B2", "C1"];
const COULEURS: Record<string, string> = {
  "Français": "#1E6B52",
  "Anglais": "#C4572E",
  "Espagnol": "#B98A1F",
  "Allemand": "#2E7C8A",
  "Arabe": "#7C5CB0",
};
const COMPTES = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "manager", password: "manager123", role: "manager" },
  { username: "assistant", password: "assistant123", role: "assistant" },
];

async function main() {
  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(DB);

  console.log("→ Vidage des collections…");
  for (const c of [
    "users", "etudiants", "profs", "langues", "niveaux", "groupes",
    "inscriptions", "etudiants_groupes", "paiements", "audits",
  ]) {
    await db.collection(c).deleteMany({});
  }

  const now = new Date();
  const today = aujourdhui();

  /* Comptes utilisateurs. */
  console.log("→ Comptes utilisateurs…");
  const usersIds: Record<string, ObjectId> = {};
  for (const u of COMPTES) {
    const _id = new ObjectId();
    usersIds[u.username] = _id;
    await db.collection("users").insertOne({
      _id,
      username: u.username,
      password: await bcrypt.hash(u.password, 10),
      role: u.role,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }

  /* Langues + niveaux. */
  console.log("→ Langues & niveaux…");
  const languesIds: Record<string, ObjectId> = {};
  for (const l of LANGUES) {
    const _id = new ObjectId();
    languesIds[l] = _id;
    await db.collection("langues").insertOne({
      _id,
      name: l,
      couleur: COULEURS[l],
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }
  const niveauxIds: Record<string, ObjectId> = {};
  for (const n of NIVEAUX) {
    const _id = new ObjectId();
    niveauxIds[n] = _id;
    await db.collection("niveaux").insertOne({
      _id,
      name: n,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }

  /* Professeurs : 14. */
  console.log("→ Professeurs…");
  const profsDocs: { _id: ObjectId; nom: string }[] = [];
  const prenomsProf = melange([...PRENOMS_F.slice(0, 7), ...PRENOMS_M.slice(0, 7)]);
  const nomsProf = melange(NOMS);
  for (let i = 0; i < 14; i++) {
    const first_name = prenomsProf[i];
    const last_name = nomsProf[i];
    const _id = new ObjectId();
    await db.collection("profs").insertOne({
      _id,
      first_name,
      last_name,
      cin: `AB${String(100000 + entre(0, 899999))}`,
      phone: `06${String(10000000 + entre(0, 89999999))}`,
      email: `${first_name.toLowerCase()}.${last_name.toLowerCase().replace(/[^a-z]/g, "")}@nevada.ma`,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    profsDocs.push({ _id, nom: `${first_name} ${last_name}` });
  }

  /* Étudiants : 68. */
  console.log("→ Étudiants (68)…");
  const etudiantsDocs: { _id: ObjectId; nom: string }[] = [];
  const prenoms = melange([...PRENOMS_F, ...PRENOMS_F, ...PRENOMS_M, ...PRENOMS_M]);
  const nomsFamille = melange([...NOMS, ...NOMS, ...NOMS, ...NOMS]);
  for (let i = 0; i < 68; i++) {
    const first_name = prenoms[i];
    const last_name = nomsFamille[i];
    const _id = new ObjectId();
    await db.collection("etudiants").insertOne({
      _id,
      first_name,
      last_name,
      cin: `BK${String(200000 + i * 137 + entre(0, 99))}`,
      phone: `06${String(61000000 + i * 431 + entre(0, 99))}`,
      email: `${first_name.toLowerCase()}.${last_name.toLowerCase().replace(/[^a-z]/g, "")}${i}@exemple.ma`,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    etudiantsDocs.push({ _id, nom: `${first_name} ${last_name}` });
  }

  /* Groupes : 2 par langue (10 au total), 8 actifs / 2 terminés. */
  console.log("→ Groupes…");
  const groupesDocs: {
    _id: ObjectId;
    langue: string;
    niveau: string;
    label: string;
    actif: boolean;
  }[] = [];
  const profsMelanges = melange(profsDocs);
  let gi = 0;
  for (const langue of LANGUES) {
    const niveauxLangue = melange(NIVEAUX).slice(0, 2);
    for (const niveau of niveauxLangue) {
      const prof = profsMelanges[gi % profsMelanges.length];
      const _id = new ObjectId();
      const actif = gi < 8;
      await db.collection("groupes").insertOne({
        _id,
        prof_id: prof._id,
        langue_id: languesIds[langue],
        niveau_id: niveauxIds[niveau],
        start_date: actif ? dateMoins(entre(60, 120)) : dateMoins(entre(200, 300)),
        end_date: actif ? null : dateMoins(entre(30, 90)),
        prof_name: prof.nom,
        langue_name: langue,
        niveau_name: niveau,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      });
      groupesDocs.push({ _id, langue, niveau, label: `${langue} · ${niveau}`, actif });
      gi++;
    }
  }

  /* Inscriptions + relations + paiements. */
  console.log("→ Inscriptions, relations & paiements…");
  let nbInscriptions = 0;
  let nbRelations = 0;
  let nbPaiements = 0;
  const auditsSeed: {
    user_id: ObjectId;
    username: string;
    action: "creer";
    ressource: string;
    ressource_id: string | null;
    details: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: null;
  }[] = [];

  for (let i = 0; i < etudiantsDocs.length; i++) {
    const etudiant = etudiantsDocs[i];
    const languesEtudiant = melange(LANGUES).slice(0, i % 3 === 0 ? 2 : 1);

    for (const langue of languesEtudiant) {
      // Répartition : 1/8 inscription commencée AUJOURD'HUI (sans paiement →
      // alimente « Générer les paiements du jour »), 1/12 historique expirée,
      // le reste : active depuis 2 à 5 mois.
      const cas = i % 8 === 0 ? "jour" : i % 12 === 0 ? "expiree" : "active";
      const start_date = cas === "jour" ? today : dateMoins(entre(60, 150));

      // Choisit d'abord un groupe de cette langue, puis son niveau :
      // maximise les affectations réalistes étudiant → groupe.
      const groupesLangue = groupesDocs.filter(
        (g) =>
          g.langue === langue &&
          (cas === "expiree" ? true : g.actif) // les actives vont dans un groupe en cours
      );
      const groupe = groupesLangue.length > 0 ? choix(groupesLangue) : null;
      const niveau = groupe ? groupe.niveau : choix(NIVEAUX);
      const prix = choix([800, 900, 1000, 1200, 1500]);
      const _id = new ObjectId();

      await db.collection("inscriptions").insertOne({
        _id,
        etudiant_id: etudiant._id,
        langue_id: languesIds[langue],
        niveau_ids: [niveauxIds[niveau]],
        niveaux: [{ id: niveauxIds[niveau].toString(), name: niveau }],
        price: prix,
        start_date,
        expired_at: cas === "expiree" ? dateMoins(entre(20, 50)) : null,
        etudiant_name: etudiant.nom,
        langue_name: langue,
        created_at: new Date(`${start_date}T09:00:00.000Z`),
        updated_at: now,
        deleted_at: null,
      });
      nbInscriptions++;

      if (cas !== "jour") {
        const statut = cas === "expiree" ? "payer" : i % 5 === 0 ? "en_attente" : "payer";
        await db.collection("paiements").insertOne({
          _id: new ObjectId(),
          inscription_id: _id,
          date: start_date,
          status: statut,
          montant: prix,
          etudiant_id: etudiant._id,
          etudiant_name: etudiant.nom,
          langue_id: languesIds[langue],
          langue_name: langue,
          created_at: new Date(`${start_date}T10:00:00.000Z`),
          updated_at: now,
          deleted_at: null,
        });
        nbPaiements++;
      }

      if (groupe && cas !== "jour") {
        await db.collection("etudiants_groupes").insertOne({
          _id: new ObjectId(),
          groupe_id: groupe._id,
          etudiant_id: etudiant._id,
          start_date,
          end_date: cas === "expiree" ? dateMoins(entre(20, 50)) : null,
          etudiant_name: etudiant.nom,
          langue_id: languesIds[langue],
          groupe_label: groupe.label,
          created_at: new Date(`${start_date}T09:30:00.000Z`),
          updated_at: now,
          deleted_at: null,
        });
        nbRelations++;
      }

      if (i % 20 === 0) {
        auditsSeed.push({
          user_id: usersIds["admin"],
          username: "admin",
          action: "creer",
          ressource: "inscriptions",
          ressource_id: null,
          details: `Inscription de ${etudiant.nom} en ${langue} (${niveau}) — ${prix} DH, début ${start_date}.`,
          created_at: new Date(Date.now() - entre(1, 20) * 86400000),
          updated_at: now,
          deleted_at: null,
        });
      }
    }
  }

  if (auditsSeed.length) await db.collection("audits").insertMany(auditsSeed);

  /* Index. */
  console.log("→ Index…");
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("etudiants").createIndex({ cin: 1 });
  await db.collection("profs").createIndex({ cin: 1 });
  await db.collection("inscriptions").createIndex({ etudiant_id: 1, langue_id: 1 });
  await db.collection("etudiants_groupes").createIndex({ etudiant_id: 1 });
  await db.collection("paiements").createIndex({ inscription_id: 1, date: 1 });
  await db.collection("audits").createIndex({ created_at: -1 });

  console.log("✓ Seed terminé :");
  console.log(`   ${COMPTES.length} comptes · ${LANGUES.length} langues · ${NIVEAUX.length} niveaux`);
  console.log(`   ${profsDocs.length} professeurs · ${etudiantsDocs.length} étudiants`);
  console.log(
    `   ${groupesDocs.length} groupes · ${nbInscriptions} inscriptions · ${nbRelations} relations · ${nbPaiements} paiements`
  );
  console.log("   → Testez « Générer les paiements du jour » sur la page Paiements.");

  await client.close();
}

main().catch((e) => {
  console.error("✗ Seed échoué :", e);
  process.exit(1);
});
