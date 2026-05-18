import { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null means not logged in
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const tokenResult = await fbUser.getIdTokenResult(true);
          const role = tokenResult.claims.role || 'leader';
          
          let userProfile = { title: '一般', name: fbUser.email.split('@')[0], teamId: '', currentProductId: '' };
          const docRef = doc(db, 'users', fbUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            userProfile = { ...userProfile, ...docSnap.data() };
          }

          setUser({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || userProfile.name,
            role,
            title: userProfile.title,
            name: userProfile.name,
            teamId: userProfile.teamId,
            currentProductId: userProfile.currentProductId,
            // For backward compatibility with existing code during transition
            roleGroup: role === 'executive' ? 'executive' : (role === 'manager' ? 'manager' : 'member')
          });
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, error: error.code };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isExecutive = user?.role === 'executive';
  const isManagerOrAbove = ['executive', 'manager'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isExecutive, isManagerOrAbove }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
