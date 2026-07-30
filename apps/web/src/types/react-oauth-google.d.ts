import type { ReactNode } from "react";

declare module "@react-oauth/google" {
  export type CredentialResponse = {
    credential?: string;
    [key: string]: unknown;
  };

  export function GoogleOAuthProvider(props: {
    clientId: string;
    children?: ReactNode;
  }): JSX.Element;

  export function GoogleLogin(props: {
    onSuccess: (credentialResponse: CredentialResponse) => void;
    onError?: () => void;
    useOneTap?: boolean;
    theme?: string;
    shape?: string;
    size?: string;
    text?: string;
  }): JSX.Element;
}

