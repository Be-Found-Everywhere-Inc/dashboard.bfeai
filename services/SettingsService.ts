export type UserSettings = {
  user_id: string;
  email_invoices: boolean;
  newsletter_opt_in: boolean;
  security_alerts: boolean;
  login_alerts: boolean;
  two_factor_enabled: boolean;
  session_timeout_minutes: number;
  updated_at: string;
};

const fetchSettings = async (): Promise<UserSettings> => {
  const response = await fetch("/.netlify/functions/settings-get", {
    credentials: "include",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to fetch settings" }));
    throw new Error(err.error ?? "Failed to fetch settings");
  }

  return response.json() as Promise<UserSettings>;
};

const updateSettings = async (
  patch: Partial<Omit<UserSettings, "user_id">>
): Promise<UserSettings> => {
  const response = await fetch("/.netlify/functions/settings-update", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Failed to update settings" }));
    throw new Error(err.error ?? "Failed to update settings");
  }

  return response.json() as Promise<UserSettings>;
};

export const SettingsService = {
  get: fetchSettings,
  update: updateSettings,
};
