const envUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL as string | undefined;

export const APP_BASE_URL = envUrl?.trim() || "https://dashboard.bfeai.com";
