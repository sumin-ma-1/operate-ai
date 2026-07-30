"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { GoogleLogin } from "@react-oauth/google";

type GoogleSignInTriggerProps = {
  onCredential: (idToken: string) => void;
  onError?: () => void;
  /** Called when the user activates sign-in (e.g. hyperlink click). */
  triggerRef: MutableRefObject<(() => void) | null>;
};

/**
 * Off-screen official Google button + triggerRef to open the account chooser
 * without a custom modal. Prefer a synchronous button click (keeps the user
 * gesture for the account popup); fall back to GIS prompt().
 */
export function GoogleSignInTrigger({
  onCredential,
  onError,
  triggerRef,
}: GoogleSignInTriggerProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickHiddenButton = () => {
      const btn = hostRef.current?.querySelector<HTMLElement>(
        '[role="button"]'
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    };

    triggerRef.current = () => {
      // Must stay synchronous with the user click when possible.
      if (clickHiddenButton()) return;

      const googleId = (
        window as Window & {
          google?: {
            accounts?: {
              id?: { prompt: () => void };
            };
          };
        }
      ).google?.accounts?.id;

      if (googleId?.prompt) {
        googleId.prompt();
        return;
      }

      onError?.();
    };

    return () => {
      triggerRef.current = null;
    };
  }, [onError, triggerRef]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0"
      aria-hidden="true"
    >
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          if (credentialResponse.credential) {
            onCredential(credentialResponse.credential);
          } else {
            onError?.();
          }
        }}
        onError={() => onError?.()}
        useOneTap={false}
        theme="filled_blue"
        shape="pill"
        size="large"
        text="signin_with"
      />
    </div>
  );
}
