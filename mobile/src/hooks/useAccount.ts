import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  type AccountView,
  type CredentialSource,
  deleteAccount,
  deleteCredential,
  getAccount,
  putCredential,
} from "@/api/accountClient";

// Loads + mutates the signed-in user's account/credential set via the backend
// account API (#3a), using the session token from useAuth. The token is the only
// thing the account client needs — this hook keeps the screen free of token wiring.
export interface UseAccount {
  account: AccountView | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setCredential: (providerId: string, source: CredentialSource) => Promise<void>;
  removeCredential: (providerId: string) => Promise<void>;
  purge: () => Promise<void>; // D8 server-side account deletion
}

export function useAccount(): UseAccount {
  const { accessToken, status } = useAuth();
  const [account, setAccount] = useState<AccountView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setAccount(await getAccount(accessToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load your account.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (status === "signed_in") void refresh();
    else setAccount(null);
  }, [status, refresh]);

  const setCredential = useCallback(
    async (providerId: string, source: CredentialSource) => {
      if (!accessToken) return;
      await putCredential(accessToken, providerId, { source });
      await refresh();
    },
    [accessToken, refresh],
  );

  const removeCredential = useCallback(
    async (providerId: string) => {
      if (!accessToken) return;
      await deleteCredential(accessToken, providerId);
      await refresh();
    },
    [accessToken, refresh],
  );

  const purge = useCallback(async () => {
    if (!accessToken) return;
    await deleteAccount(accessToken);
    setAccount(null);
  }, [accessToken]);

  return { account, loading, error, refresh, setCredential, removeCredential, purge };
}
