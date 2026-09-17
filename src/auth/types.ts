export type AuthUser = {
  uid: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
};

/** Google Sign-In — also owns the shared auth-state listener and sign-out,
 * since there's one underlying Firebase Auth instance regardless of which
 * method signed the user in. */
export interface AuthProvider {
  signIn(): Promise<AuthUser>;
  signOut(): Promise<void>;
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;
}

export interface EmailAuthProvider {
  signUp(name: string, email: string, password: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  resendVerificationEmail(): Promise<void>;
  reloadCurrentUser(): Promise<AuthUser | null>;
}

export type AuthErrorLike = { code?: string };
