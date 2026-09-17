import { createAuthStore } from './authStore';
import { emailAuthProvider } from './providers/emailAuthProvider';
import { googleAuthProvider } from './providers/googleAuthProvider';

export const useAuthStore = createAuthStore({
  google: googleAuthProvider,
  email: emailAuthProvider,
});
