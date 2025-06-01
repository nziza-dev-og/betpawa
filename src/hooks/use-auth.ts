
import { useEffect, useState } from 'react';
import { auth, onAuthStateChanged, signInAnonymously, type User as FirebaseUser, db, doc, setDoc, getDoc } from '@/lib/firebase';

export interface UserProfile {
  uid: string;
  walletBalance: number;
  displayName?: string; // Optional
}

export interface AuthState {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loadingAuth: boolean;
  authError: string | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoadingAuth(true);
      setAuthError(null); // Clear previous auth errors on new auth state event

      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data() as UserProfile);
        } else {
          const newUserProfile: UserProfile = {
            uid: firebaseUser.uid,
            walletBalance: 100, // Initial wallet balance
            displayName: firebaseUser.displayName || `Player${firebaseUser.uid.substring(0,5)}`,
          };
          try {
            await setDoc(userDocRef, newUserProfile);
            setUserProfile(newUserProfile);
          } catch (error) {
            console.error("Error creating user profile:", error);
            setAuthError("Failed to create user profile.");
          }
        }
      } else {
        // No user, attempt anonymous sign-in
        try {
          await signInAnonymously(auth);
          // The onAuthStateChanged listener will pick up the new anonymous user
          // and trigger the profile creation/fetching logic above.
        } catch (error: any) {
          console.error("Anonymous sign-in failed:", error);
          if (error.code === 'auth/admin-restricted-operation') {
            const specificError = "Anonymous sign-in is not enabled. Please enable it in your Firebase project's Authentication settings (Sign-in method tab).";
            console.error("IMPORTANT: " + specificError);
            setAuthError(specificError);
          } else {
            setAuthError("Failed to sign in anonymously. Please try again.");
          }
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, userProfile, loadingAuth, authError, setUserProfile };
}
