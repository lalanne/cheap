import type { User } from 'firebase/auth';

import type { AuthUser } from '../types';

export function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName,
    photoUrl: user.photoURL,
    emailVerified: user.emailVerified,
  };
}
