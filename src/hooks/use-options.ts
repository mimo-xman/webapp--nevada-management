"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { OptionItem } from "@/components/entity-dialog";

/**
 * Charge les options d'une liste déroulante depuis /api/options.
 * Utilisé par tous les formulaires d'entités.
 */
export function useOptions(type: string) {
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let annule = false;
    api<{ options: OptionItem[] }>(`/api/options?type=${type}`)
      .then((res) => {
        if (!annule) setOptions(res.options);
      })
      .catch(() => {
        if (!annule) setOptions([]);
      })
      .finally(() => {
        if (!annule) setCharge(true);
      });
    return () => {
      annule = true;
    };
  }, [type]);

  const chargement = !charge;

  return { options, chargement };
}
