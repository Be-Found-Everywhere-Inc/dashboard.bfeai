import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/bfeai-auth";
import { ProfileService, type ProfileUpdates } from "@/services/ProfileService";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook for managing user profile operations.
 * Uses SSO authentication via HttpOnly cookies - no token management needed.
 */
export const useProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: ProfileUpdates) => {
      if (!user?.id) {
        throw new Error("Not authenticated");
      }

      // Update via backend endpoint (updates Supabase, user_settings, and Stripe)
      return ProfileService.updateProfile(updates);
    },
    onSuccess: () => {
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ newPassword }: { newPassword: string }) => {
      // Use Supabase client-side password update
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      return { success: true };
    },
  });

  return {
    updateProfile: updateProfileMutation.mutateAsync,
    updateProfileLoading: updateProfileMutation.isPending,
    updateProfileError: updateProfileMutation.error,

    changePassword: changePasswordMutation.mutateAsync,
    changePasswordLoading: changePasswordMutation.isPending,
    changePasswordError: changePasswordMutation.error,
  };
};
