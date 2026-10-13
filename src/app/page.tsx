import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { FormulaireConnexion } from "./formulaire-connexion";

export const dynamic = "force-dynamic";

export default async function PageConnexion() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <FormulaireConnexion />;
}
