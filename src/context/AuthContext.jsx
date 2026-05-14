import { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null means not logged in
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        let userProfile = { title: '一般', name: currentUser.email.split('@')[0], teamId: '' };
        
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            userProfile = docSnap.data();
          } else if (currentUser.email === 'k.takahashi@rush-up.co.jp') {
            // Fallback for root admin if not in users collection yet
            userProfile = { title: '代表', name: '高橋 圭', teamId: 'root' };
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }

        // Determine roleGroup based on title
        const executives = ['代表', '取締役', '役員'];
        const managers = ['統括', '副統括', 'MG', 'PMG', 'SM', 'TL'];
        
        let roleGroup = 'member';
        if (executives.includes(userProfile.title)) roleGroup = 'executive';
        else if (managers.includes(userProfile.title)) roleGroup = 'manager';

        setUser({ 
          uid: currentUser.uid, 
          email: currentUser.email,
          title: userProfile.title,
          name: userProfile.name,
          teamId: userProfile.teamId,
          roleGroup: roleGroup, // 'executive', 'manager', 'member'
          role: roleGroup === 'executive' ? 'admin' : 'manager' // backward compatibility
        });
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

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
