import { create } from "zustand";

type AuthState = {
  googleIdToken: string | null;
  setGoogleIdToken: (token: string) => void;
  clearGoogleIdToken: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  googleIdToken: null,
  setGoogleIdToken: (token) => set({ googleIdToken: token }),
  clearGoogleIdToken: () => set({ googleIdToken: null }),
}));

