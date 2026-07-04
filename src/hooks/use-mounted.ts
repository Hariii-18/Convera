import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns `true` only after the component has mounted on the client.
 * Use to gate client-only UI (e.g. reading `next-themes`) without hydration mismatches.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
