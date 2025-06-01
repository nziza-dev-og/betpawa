import { useEffect, useState } from 'react';
import { auth, onAuthStateChanged, signInAnonymously, type User as FirebaseUser, db, doc, setDoc, getDoc } from '@/lib/firebase';

export interface UserProfile {
  uid: string;
  walletBalance: number;
  displayName?: string; // Optional
}

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoadingAuth(true);
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
          }
        }
      } else {
        // No user, attempt anonymous sign-in
        try {
          const userCredential = await signInAnonymously(auth);
          // The onAuthStateChanged listener will pick up the new anonymous user
          // and trigger the profile creation/fetching logic above.
          // setUser(userCredential.user) is not strictly needed here as listener will re-run.
        } catch (error) {
          console.error("Anonymous sign-in failed:", error);
          setUser(null);
          setUserProfile(null);
        }
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, userProfile, loadingAuth, setUserProfile };
}
