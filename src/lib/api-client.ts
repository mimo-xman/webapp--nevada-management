"use client";

/** Petit client HTTP typé : JSON automatique, erreurs en français. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const message =
      (json as { error?: string } | null)?.error ||
      "Une erreur est survenue. Réessayez.";
    throw new Error(message);
  }
  return json as T;
}

export function jsonBody(payload: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(payload) };
}
