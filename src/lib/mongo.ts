import { MongoClient, ObjectId, type Collection, type Db } from "mongodb";
import type {
  AuditDoc,
  EtudiantDoc,
  EtudiantGroupeDoc,
  GroupeDoc,
  InscriptionDoc,
  LangueDoc,
  NiveauDoc,
  PaiementDoc,
  ProfDoc,
  UserDoc,
} from "./types";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "nevada";

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getClientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

export interface Collections {
  users: Collection<UserDoc>;
  etudiants: Collection<EtudiantDoc>;
  profs: Collection<ProfDoc>;
  langues: Collection<LangueDoc>;
  niveaux: Collection<NiveauDoc>;
  groupes: Collection<GroupeDoc>;
  inscriptions: Collection<InscriptionDoc>;
  etudiants_groupes: Collection<EtudiantGroupeDoc>;
  paiements: Collection<PaiementDoc>;
  audits: Collection<AuditDoc>;
}

export async function getCollections(): Promise<Collections> {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>("users"),
    etudiants: db.collection<EtudiantDoc>("etudiants"),
    profs: db.collection<ProfDoc>("profs"),
    langues: db.collection<LangueDoc>("langues"),
    niveaux: db.collection<NiveauDoc>("niveaux"),
    groupes: db.collection<GroupeDoc>("groupes"),
    inscriptions: db.collection<InscriptionDoc>("inscriptions"),
    etudiants_groupes: db.collection<EtudiantGroupeDoc>("etudiants_groupes"),
    paiements: db.collection<PaiementDoc>("paiements"),
    audits: db.collection<AuditDoc>("audits"),
  };
}

/** Convertit une chaîne hexadécimale de 24 caractères en ObjectId, sinon null. */
export function oid(value: unknown): ObjectId | null {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{24}$/.test(value)) return null;
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

/** Convertit un ObjectId en chaîne, sinon null. */
export function oidStr(value: unknown): string | null {
  return value instanceof ObjectId ? value.toString() : null;
}
