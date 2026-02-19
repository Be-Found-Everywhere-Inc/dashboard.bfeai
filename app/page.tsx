import { redirect } from "next/navigation";

export default function Home() {
  // Root path redirects to profile (which handles auth check)
  // If user is not authenticated, they'll be redirected to login from there
  redirect("/profile");
}
