import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/bfeai-auth";
import { SettingsService, type UserSettings } from "@/services/SettingsService";

const queryKey = (userId?: string) => ["user-settings", userId] as const;

export const useUserSettings = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const settingsQuery = useQuery<UserSettings>({
    queryKey: queryKey(userId),
    enabled: Boolean(userId),
    queryFn: () => SettingsService.get(),
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<Omit<UserSettings, "user_id">>) =>
      SettingsService.update(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey(userId), data);
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSetting: mutation.mutateAsync,
    updating: mutation.isPending,
  };
};
