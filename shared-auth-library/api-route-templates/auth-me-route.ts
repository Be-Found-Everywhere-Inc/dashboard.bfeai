// Template: GET /api/auth/me
// Co-founders: Copy this to your app at src/app/api/auth/me/route.ts
//
// Returns the currently authenticated user's info including profile data.
// The client-side AuthProvider calls this endpoint because the bfeai_session
// cookie is httpOnly and not accessible via JavaScript.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/bfeai-auth/server";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Use service role to bypass RLS (SSO JWT is not a Supabase session)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, avatar_url, company, industry, created_at, updated_at"
      )
      .eq("id", user.userId)
      .single();

    if (profileError) {
      console.error("[/api/auth/me] Profile fetch error:", profileError);
      return NextResponse.json({
        userId: user.userId,
        email: user.email,
        profile: null,
      });
    }

    return NextResponse.json({
      userId: user.userId,
      email: user.email,
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        company: profile.company,
        industry: profile.industry,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    });
  } catch (error) {
    console.error("[/api/auth/me] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
