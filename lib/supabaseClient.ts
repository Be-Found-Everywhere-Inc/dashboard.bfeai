import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are not set. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type CookieStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const getCookieDomain = () => {
  if (typeof window === "undefined") {
    return ".bfeai.com";
  }

  const hostname = window.location.hostname;
  if (hostname === "bfeai.com" || hostname.endsWith(".bfeai.com")) {
    return ".bfeai.com";
  }

  return undefined;
};

const buildBaseCookieAttributes = () => {
  const attributes = ["Path=/", "SameSite=Lax"];
  const domain = getCookieDomain();

  if (domain) {
    attributes.push(`Domain=${domain}`);
  }

  if (typeof window === "undefined" || window.location.protocol === "https:") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
};

const readCookie = (name: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));

  return match ? decodeURIComponent(match[1]) : null;
};

const cookieStorage: CookieStorage = {
  getItem: (key) => readCookie(key),
  setItem: (key, value) => {
    if (typeof document === "undefined") {
      return;
    }

    document.cookie = `${key}=${encodeURIComponent(value)}; ${buildBaseCookieAttributes()}; Max-Age=${ONE_YEAR_SECONDS}`;
  },
  removeItem: (key) => {
    if (typeof document === "undefined") {
      return;
    }

    document.cookie = `${key}=; ${buildBaseCookieAttributes()}; Max-Age=0`;
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: cookieStorage,
  },
});
