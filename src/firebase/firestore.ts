import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './config';

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  GROUPS: 'groups',
  EXPENSES: 'expenses',
  SETTLEMENTS: 'settlements',
  FRIENDS: 'friends'
};

// User operations
export const createUser = async (userId: string, userData: any) => {
  await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
    ...userData,
    createdAt: serverTimestamp()
  });
};

export const getUser = async (userId: string) => {
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
};

export const getUserByEmail = async (email: string) => {
  const q = query(collection(db, COLLECTIONS.USERS), where('email', '==', email));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

export const getUsers = async (userIds: string[]) => {
  const users = await Promise.all(
    userIds.map(async (userId) => {
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
      return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
    })
  );
  return users.filter(user => user !== null);
};

// Group operations
export const createGroup = async (groupData: any) => {
  return await addDoc(collection(db, COLLECTIONS.GROUPS), {
    ...groupData,
    createdAt: serverTimestamp()
  });
};

export const getUserGroups = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.GROUPS),
    where('members', 'array-contains', userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const onUserGroupsChange = (userId: string, callback: (groups: any[]) => void) => {
  const q = query(
    collection(db, COLLECTIONS.GROUPS),
    where('members', 'array-contains', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(groups);
  });
};

export const getGroup = async (groupId: string) => {
  const groupDoc = await getDoc(doc(db, COLLECTIONS.GROUPS, groupId));
  return groupDoc.exists() ? { id: groupDoc.id, ...groupDoc.data() } : null;
};

export const updateGroup = async (groupId: string, groupData: any) => {
  return await updateDoc(doc(db, COLLECTIONS.GROUPS, groupId), groupData);
};

export const deleteGroup = async (groupId: string) => {
  await deleteDoc(doc(db, COLLECTIONS.GROUPS, groupId));
};

// Expense operations
export const createExpense = async (expenseData: any) => {
  return await addDoc(collection(db, COLLECTIONS.EXPENSES), {
    ...expenseData,
    createdAt: serverTimestamp()
  });
};

export const getGroupExpenses = async (groupId: string | null) => {
  const q = groupId
    ? query(collection(db, COLLECTIONS.EXPENSES), where('groupId', '==', groupId))
    : query(collection(db, COLLECTIONS.EXPENSES), where('groupId', '==', null));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const onGroupExpensesChange = (groupId: string | null, callback: (expenses: any[]) => void) => {
  const q = groupId
    ? query(collection(db, COLLECTIONS.EXPENSES), where('groupId', '==', groupId))
    : query(collection(db, COLLECTIONS.EXPENSES), where('groupId', '==', null));
  
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(expenses);
  });
};

export const getUserExpenses = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.EXPENSES),
    where('participants', 'array-contains', userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const onUserExpensesChange = (userId: string, callback: (expenses: any[]) => void) => {
  const q = query(
    collection(db, COLLECTIONS.EXPENSES),
    where('participants', 'array-contains', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(expenses);
  });
};

export const deleteExpense = async (expenseId: string) => {
  await deleteDoc(doc(db, COLLECTIONS.EXPENSES, expenseId));
};

// Settlement operations
export const createSettlement = async (settlementData: any) => {
  return await addDoc(collection(db, COLLECTIONS.SETTLEMENTS), {
    ...settlementData,
    settledAt: serverTimestamp()
  });
};

export const getGroupSettlements = async (groupId: string | null) => {
  const q = groupId
    ? query(collection(db, COLLECTIONS.SETTLEMENTS), where('groupId', '==', groupId))
    : query(collection(db, COLLECTIONS.SETTLEMENTS), where('groupId', '==', null));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Friend operations
export const addFriend = async (userId: string, friendId: string) => {
  return await addDoc(collection(db, COLLECTIONS.FRIENDS), {
    userId,
    friendId,
    createdAt: serverTimestamp()
  });
};

export const getUserFriends = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.FRIENDS),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(q);
  const friendIds = snapshot.docs.map(doc => doc.data().friendId);
  
  if (friendIds.length === 0) return [];
  
  // Fetch friend user data
  const friends = await getUsers(friendIds);
  return friends;
};
