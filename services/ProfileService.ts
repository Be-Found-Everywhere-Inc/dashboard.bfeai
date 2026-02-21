const BASE_URL = "/.netlify/functions";

/**
 * Authenticated fetch using HttpOnly cookies (SSO auth).
 * The bfeai_session cookie is sent automatically with credentials: 'include'.
 */
const authenticatedFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}/${path}`, {
    ...init,
    credentials: 'include', // Include cookies for SSO authentication
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (payload as { error?: string }).error ?? "Request failed";
    throw new Error(message);
  }

  return payload as T;
};

export type ProfileUpdates = {
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
};

export const ProfileService = {
  updateProfile: (updates: ProfileUpdates) =>
    authenticatedFetch<{ success: boolean; message: string }>("settings-update-profile", {
      method: "POST",
      body: JSON.stringify(updates),
    }),
};
