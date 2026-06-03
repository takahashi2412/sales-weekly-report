import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export const getVisibleUserIds = async (user) => {
  if (!user) return [];
  
  // executive → 全ユーザー
  if (user.role === 'executive') {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => d.id);
  }
  
  // manager → 自チームメンバー + 自分
  if (user.role === 'manager') {
    const teamQuery = query(
      collection(db, 'teams'),
      where('leaderId', '==', user.uid)
    );
    const teamSnap = await getDocs(teamQuery);
    const memberIds = [user.uid];
    teamSnap.forEach(doc => {
      const members = doc.data().members || [];
      memberIds.push(...members);
    });
    return [...new Set(memberIds)];
  }
  
  // leader → 自分 + 自チームメンバー
  if (user.role === 'leader') {
    if (user.teamId) {
      const q = query(collection(db, 'users'), where('teamId', '==', user.teamId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.id);
    }
    return [user.uid];
  }

  return [user.uid];
};

export const getVisibleUsers = async (user) => {
  const ids = await getVisibleUserIds(user);
  if (!ids || ids.length === 0) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .filter(d => ids.includes(d.id))
    .map(d => ({ id: d.id, ...d.data() }));
};
