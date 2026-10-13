"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";

/**
 * Dialogue de confirmation de suppression (logique).
 * Le composant parent contrôle l'élément à supprimer.
 */
export function ConfirmSuppression({
  element,
  onOpenChange,
  endpoint,
  description,
  onDeleted,
}: {
  element: unknown;
  onOpenChange: (open: boolean) => void;
  endpoint: string;
  description: string;
  onDeleted: () => void;
}) {
  const [envoi, setEnvoi] = useState(false);

  async function supprimer() {
    const id = (element as { _id: string } | null)?._id;
    if (!id) return;
    setEnvoi(true);
    try {
      await api(`${endpoint}/${id}`, { method: "DELETE" });
      toast.success("Suppression effectuée.");
      onOpenChange(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <AlertDialog open={element !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            Confirmer la suppression
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={envoi}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              supprimer();
            }}
            disabled={envoi}
            className="bg-[var(--argile)] text-white hover:bg-[#a8461f]"
          >
            {envoi && <Loader2 className="size-4 animate-spin" />}
            <Trash2 className="size-4" />
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
