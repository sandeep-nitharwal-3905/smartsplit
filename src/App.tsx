import { useState, useEffect } from 'react';
import { Users, Plus, DollarSign, LogOut, Trash2, User, ArrowLeftRight, Share2, Copy, Link as LinkIcon, X } from 'lucide-react';
import { onAuthStateChange, signUpUser, signInUser, logoutUser, signInWithGoogle, sendVerificationEmail } from './firebase/auth';
import { 
  createGroup as createFirebaseGroup, 
  getUserGroups, 
  createExpense as createFirebaseExpense,
  updateExpense as updateFirebaseExpense,
  getGroupExpenses,
  getUserExpenses,
  deleteExpense as deleteFirebaseExpense,
  createSettlement as createFirebaseSettlement,
  getUserByEmail,
  getUsers,
  addFriend as addFirebaseFriend,
  getUserFriends,
  getGroup,
  updateGroup,
  deleteGroup as deleteFirebaseGroup,
  onUserGroupsChange,
  onGroupExpensesChange,
  onUserExpensesChange
} from './firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from './firebase/config';
import { doc, setDoc } from 'firebase/firestore';

// Type definitions
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface Group {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  participants: string[];
  groupId: string | null;
  createdAt: string;
  createdBy?: string;
  isSettlement?: boolean;
  splitAmounts?: Record<string, number>; // Custom split amounts per participant
}

interface Notification {
  id: string;
  message: string;
  type: 'expense' | 'settlement' | 'group';
  timestamp: number;
}

export default function ExpenseSplitApp() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState('login');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  // Expense form states
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [selectedPayer, setSelectedPayer] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<'equal' | 'unequal'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  // Group form states
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [tempMemberEmail, setTempMemberEmail] = useState('');

  // Friend form state
  const [friendEmail, setFriendEmail] = useState('');
  const [memberCache, setMemberCache] = useState<Record<string, User>>({});
  
  // Group join states
  const [showJoinLinkModal, setShowJoinLinkModal] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState('');

  // Group created success modal
  const [showGroupCreatedModal, setShowGroupCreatedModal] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState('');

  // Notification states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [previousExpenses, setPreviousExpenses] = useState<Expense[]>([]);

  // Edit expense states
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Edit group states
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Check if email is verified (skip for Google users)
        if (!firebaseUser.emailVerified && !firebaseUser.providerData.some(p => p.providerId === 'google.com')) {
          setCurrentUser(null);
          setView('login');
          setLoading(false);
          setEmailVerificationSent(true);
          return;
        }
        
        const userData: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || '',
          createdAt: firebaseUser.metadata.creationTime || ''
        };
        setCurrentUser(userData);
        setView('dashboard');
        setLoading(false);
        setEmailVerificationSent(false);
      } else {
        setCurrentUser(null);
        setView('login');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadUserFriends();
      
      // Check if there's a join group ID in URL
      const urlParams = new URLSearchParams(window.location.search);
      const joinId = urlParams.get('join');
      if (joinId) {
        setJoinGroupId(joinId);
        setShowJoinLinkModal(true);
        // Clear URL parameter
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      // Real-time listener for groups
      const unsubscribeGroups = onUserGroupsChange(currentUser.id, (updatedGroups) => {
        setGroups(updatedGroups as Group[]);
      });
      
      // Real-time listener for user expenses
      const unsubscribeExpenses = onUserExpensesChange(currentUser.id, async (updatedExpenses) => {
        const expensesList = updatedExpenses as Expense[];
        
        // Detect new expenses added by others
        if (previousExpenses.length > 0) {
          const newExpenses = expensesList.filter(exp => 
            !previousExpenses.find(prev => prev.id === exp.id) &&
            exp.paidBy !== currentUser.id
          );
          
          newExpenses.forEach(expense => {
            const payerName = getUserName(expense.paidBy);
            const isSettlement = expense.description === 'Settlement';
            const message = isSettlement
              ? `${payerName} settled up $${expense.amount.toFixed(2)}`
              : `${payerName} added "${expense.description}" - $${expense.amount.toFixed(2)}`;
            
            addNotification(message, isSettlement ? 'settlement' : 'expense');
          });
        }
        
        setPreviousExpenses(expensesList);
        setExpenses(expensesList);
        await loadUsersFromExpenses(expensesList);
      });
      
      return () => {
        unsubscribeGroups();
        unsubscribeExpenses();
      };
    }
  }, [currentUser]);

  const loadUserFriends = async () => {
    if (!currentUser) return;
    try {
      const userFriends = await getUserFriends(currentUser.id);
      setFriends(userFriends as User[]);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadUserExpenses = async () => {
    if (!currentUser) return;
    try {
      const userExpenses = await getUserExpenses(currentUser.id);
      setExpenses(userExpenses as Expense[]);
      
      // Load user data for all participants in expenses
      await loadUsersFromExpenses(userExpenses as Expense[]);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const loadUsersFromExpenses = async (expensesList: Expense[]) => {
    try {
      // Collect all unique user IDs from expenses
      const userIds = new Set<string>();
      expensesList.forEach(expense => {
        if (expense.paidBy !== currentUser?.id) {
          userIds.add(expense.paidBy);
        }
        expense.participants.forEach(pId => {
          if (pId !== currentUser?.id) {
            userIds.add(pId);
          }
        });
      });

      // Filter out users we already have
      const unknownUserIds = Array.from(userIds).filter(
        id => !memberCache[id] && !friends.find(f => f.id === id)
      );

      if (unknownUserIds.length > 0) {
        const users = await getUsers(unknownUserIds);
        const newCache = { ...memberCache };
        users.forEach((user: any) => {
          if (user) {
            newCache[user.id] = user as User;
          }
        });
        setMemberCache(newCache);
      }
    } catch (error) {
      console.error('Error loading users from expenses:', error);
    }
  };

  useEffect(() => {
    if (selectedGroup) {
      loadGroupMembers();
      
      // Real-time listener for group expenses
      const unsubscribe = onGroupExpensesChange(selectedGroup.id, async (updatedExpenses) => {
        setExpenses(updatedExpenses as Expense[]);
        await loadUsersFromExpenses(updatedExpenses as Expense[]);
      });
      
      return () => unsubscribe();
    }
  }, [selectedGroup]);

  const loadGroupMembers = async () => {
    if (!selectedGroup) return;
    
    try {
      const memberIds = selectedGroup.members.filter(id => id !== currentUser?.id && !memberCache[id]);
      if (memberIds.length > 0) {
        const members = await getUsers(memberIds);
        const newCache = { ...memberCache };
        members.forEach((member: any) => {
          if (member) {
            newCache[member.id] = member as User;
          }
        });
        setMemberCache(newCache);
      }
    } catch (error) {
      console.error('Error loading group members:', error);
    }
  };

  useEffect(() => {
    calculateBalances();
  }, [expenses, friends, selectedGroup]);

  const loadUserData = async () => {
    if (!currentUser) return;
    
    try {
      const userGroups = await getUserGroups(currentUser.id);
      setGroups(userGroups as Group[]);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadGroupExpenses = async () => {
    if (!selectedGroup) return;
    
    try {
      const groupExpenses = await getGroupExpenses(selectedGroup.id);
      setExpenses(groupExpenses as Expense[]);
      
      // Load user data for all participants in expenses
      await loadUsersFromExpenses(groupExpenses as Expense[]);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const calculateBalances = () => {
    const balanceMap: Record<string, number> = {};
    
    const relevantExpenses = selectedGroup 
      ? expenses.filter(e => e.groupId === selectedGroup.id)
      : expenses.filter(e => 
          currentUser && e.participants.includes(currentUser.id) && !e.groupId
        );

    relevantExpenses.forEach(expense => {
      const payer = expense.paidBy;
      const participants = expense.participants;
      
      // Use custom splits if available, otherwise split equally
      const getParticipantShare = (participantId: string): number => {
        if (expense.splitAmounts && expense.splitAmounts[participantId]) {
          return expense.splitAmounts[participantId];
        }
        return expense.amount / participants.length;
      };

      participants.forEach(participantId => {
        if (participantId !== payer) {
          const shareAmount = getParticipantShare(participantId);
          const key = `${participantId}-${payer}`;
          const reverseKey = `${payer}-${participantId}`;

          if (balanceMap[reverseKey]) {
            balanceMap[reverseKey] -= shareAmount;
            if (Math.abs(balanceMap[reverseKey]) < 0.01) {
              delete balanceMap[reverseKey];
            }
          } else {
            balanceMap[key] = (balanceMap[key] || 0) + shareAmount;
          }
        }
      });
    });

    setBalances(balanceMap);
  };

  const handleAuth = async () => {
    if (!email || !password) {
      alert('Please fill all fields');
      return;
    }
    
    try {
      if (isSignUp) {
        if (!name) {
          alert('Please enter your name');
          return;
        }
        const userCredential = await signUpUser(email, password);
        
        // Send email verification
        await sendVerificationEmail(userCredential.user);
        
        // Update profile with name
        await updateProfile(userCredential.user, { displayName: name });
        // Create user document in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email,
          name,
          createdAt: new Date().toISOString()
        });
        
        // Sign out the user until they verify their email
        await logoutUser();
        setEmailVerificationSent(true);
        alert('Account created! Please check your email to verify your account.');
      } else {
        const userCredential = await signInUser(email, password);
        
        // Check if email is verified
        if (!userCredential.user.emailVerified) {
          await logoutUser();
          setEmailVerificationSent(true);
          alert('Please verify your email before logging in. Check your inbox.');
          return;
        }
      }
      
      setEmail('');
      setPassword('');
      setName('');
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Authentication failed';
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please log in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format. Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const userCredential = await signInWithGoogle();
      const user = userCredential.user;
      
      // Create or update user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      
      // Don't show error if user cancelled the popup
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return;
      }
      
      let errorMessage = 'Google sign-in failed';
      if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Popup was blocked. Please allow popups for this site.';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with this email using a different sign-in method.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setView('login');
      setSelectedGroup(null);
      setGroups([]);
      setExpenses([]);
      setFriends([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleAddGroup = async () => {
    if (!groupName) {
      alert('Please enter group name');
      return;
    }
    
    if (!currentUser) return;
    
    try {
      const newGroup = {
        name: groupName,
        members: [currentUser.id, ...groupMembers],
        createdBy: currentUser.id,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await createFirebaseGroup(newGroup);
      setGroups([...groups, { id: docRef.id, ...newGroup }]);
      
      // Show success modal with share options
      setCreatedGroupId(docRef.id);
      setShowGroupCreatedModal(true);
      
      setGroupName('');
      setGroupMembers([]);
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    }
  };

  const addMemberToGroup = async () => {
    if (!tempMemberEmail || !currentUser) return;
    
    try {
      const user = await getUserByEmail(tempMemberEmail);
      if (user && user.id !== currentUser.id && !groupMembers.includes(user.id)) {
        setGroupMembers([...groupMembers, user.id]);
        setMemberCache({ ...memberCache, [user.id]: user as User });
        setTempMemberEmail('');
      } else {
        alert('User not found or already added');
      }
    } catch (error) {
      console.error('Error finding user:', error);
      alert('User not found');
    }
  };

  const handleAddFriend = async () => {
    if (!friendEmail) {
      alert('Please enter friend email');
      return;
    }
    
    if (!currentUser) return;
    
    try {
      const friend = await getUserByEmail(friendEmail);
      if (friend && friend.id !== currentUser.id) {
        // Check if already a friend
        if (friends.find(f => f.id === friend.id)) {
          alert('This user is already your friend');
          return;
        }
        
        // Add to Firestore
        await addFirebaseFriend(currentUser.id, friend.id);
        
        setFriends([...friends, friend as User]);
        setFriendEmail('');
        setView('dashboard');
        alert('Friend added successfully!');
      } else {
        alert('Friend not found or invalid email.');
      }
    } catch (error) {
      console.error('Error finding friend:', error);
      alert('Friend not found');
    }
  };

  const handleAddExpense = async () => {
    if (!expenseDesc || !expenseAmount || !selectedPayer || selectedParticipants.length === 0) {
      alert('Please fill all fields and select participants');
      return;
    }
    
    if (!currentUser) return;
    
    // Validate custom splits if unequal mode
    let splitAmounts: Record<string, number> | undefined;
    if (splitMode === 'unequal') {
      splitAmounts = {};
      let totalSplit = 0;
      
      for (const participantId of selectedParticipants) {
        const amount = parseFloat(customSplits[participantId] || '0');
        if (isNaN(amount) || amount <= 0) {
          alert(`Please enter a valid amount for ${getUserName(participantId)}`);
          return;
        }
        splitAmounts[participantId] = amount;
        totalSplit += amount;
      }
      
      // Allow small rounding differences (0.01)
      if (Math.abs(totalSplit - parseFloat(expenseAmount)) > 0.01) {
        alert(`Split amounts ($${totalSplit.toFixed(2)}) must equal total expense ($${expenseAmount})`);
        return;
      }
    }
    
    try {
      if (isEditMode && editingExpense) {
        // Update existing expense
        const updatedExpenseData: any = {
          description: expenseDesc,
          amount: parseFloat(expenseAmount),
          paidBy: selectedPayer,
          participants: selectedParticipants,
        };
        
        if (splitAmounts) {
          updatedExpenseData.splitAmounts = splitAmounts;
        } else {
          updatedExpenseData.splitAmounts = null;
        }
        
        await updateFirebaseExpense(editingExpense.id, updatedExpenseData);
        
        setExpenses(expenses.map(e => 
          e.id === editingExpense.id 
            ? { ...e, ...updatedExpenseData }
            : e
        ));
        
        setIsEditMode(false);
        setEditingExpense(null);
      } else {
        // Create new expense
        const newExpense: any = {
          description: expenseDesc,
          amount: parseFloat(expenseAmount),
          paidBy: selectedPayer,
          participants: selectedParticipants,
          groupId: selectedGroup?.id || null,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id
        };
        
        if (splitAmounts) {
          newExpense.splitAmounts = splitAmounts;
        }
        
        const docRef = await createFirebaseExpense(newExpense);
        setExpenses([...expenses, { id: docRef.id, ...newExpense }]);
      }
      
      setExpenseDesc('');
      setExpenseAmount('');
      setSelectedPayer('');
      setSelectedParticipants([]);
      setSplitMode('equal');
      setCustomSplits({});
      setView(selectedGroup ? 'groupDetail' : 'dashboard');
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense');
    }
  };

  const handleSettleUp = async (fromId: string, toId: string, amount: number) => {
    try {
      const settlement = {
        from: fromId,
        to: toId,
        amount,
        groupId: selectedGroup?.id || null,
        settledAt: new Date().toISOString()
      };
      
      await createFirebaseSettlement(settlement);
      
      // Create a settlement expense where the debtor (fromId) pays the creditor (toId)
      // This is recorded as an expense paid by the debtor with only the creditor as participant
      // This effectively cancels out the debt
      const newExpense = {
        description: `Settlement: ${getUserName(fromId)} paid ${getUserName(toId)}`,
        amount: amount,
        paidBy: fromId,
        participants: [toId], // Only the creditor is the participant (receiver)
        groupId: selectedGroup?.id || null,
        createdAt: new Date().toISOString(),
        isSettlement: true
      };
      
      const docRef = await createFirebaseExpense(newExpense);
      const updatedExpenses = [...expenses, { id: docRef.id, ...newExpense }];
      setExpenses(updatedExpenses);
      
      // Reload expenses to ensure everything is up to date
      if (selectedGroup) {
        await loadGroupExpenses();
      } else {
        await loadUserExpenses();
      }
      
      alert('Settlement recorded successfully!');
    } catch (error) {
      console.error('Error settling up:', error);
      alert('Failed to settle up');
    }
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return 'You';
    // Check in friends first
    const friend = friends.find(u => u.id === userId);
    if (friend) return friend.name;
    // Check in memberCache (for group members)
    const cachedMember = memberCache[userId];
    if (cachedMember) return cachedMember.name;
    // Return Unknown as fallback
    return 'Unknown';
  };

  const formatDateTime = (dateInput: any) => {
    if (!dateInput) return 'Unknown date';
    
    let date: Date;
    
    // Handle Firebase Timestamp object
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } 
    // Handle string format: "23 November 2025 at 21:47:07 UTC+5:30"
    else if (typeof dateInput === 'string') {
      const firebaseMatch = dateInput.match(/(\d+)\s+(\w+)\s+(\d+)\s+at\s+(\d+):(\d+):(\d+)/);
      if (firebaseMatch) {
        const [, day, monthName, year, hours, minutes, seconds] = firebaseMatch;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                            'July', 'August', 'September', 'October', 'November', 'December'];
        const month = monthNames.indexOf(monthName);
        
        if (month !== -1) {
          date = new Date(parseInt(year), month, parseInt(day), 
                         parseInt(hours), parseInt(minutes), parseInt(seconds));
        } else {
          date = new Date(dateInput);
        }
      } else {
        // Try standard Date parsing (ISO format)
        date = new Date(dateInput);
      }
    } 
    // Handle Date object or timestamp
    else {
      date = new Date(dateInput);
    }
    
    // Check if date is invalid
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();

    // Format date and time
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');

    // Show year only if different from current year
    const dateStr = year === now.getFullYear() 
      ? `${month} ${day}`
      : `${month} ${day}, ${year}`;
    
    return `${dateStr} at ${displayHours}:${displayMinutes} ${ampm}`;
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      await deleteFirebaseExpense(expenseId);
      setExpenses(expenses.filter(e => e.id !== expenseId));
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense');
    }
  };

  const startEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsEditMode(true);
    setExpenseDesc(expense.description);
    setExpenseAmount(expense.amount.toString());
    setSelectedPayer(expense.paidBy);
    setSelectedParticipants(expense.participants);
    
    if (expense.splitAmounts) {
      setSplitMode('unequal');
      const splits: Record<string, string> = {};
      Object.entries(expense.splitAmounts).forEach(([id, amount]) => {
        splits[id] = amount.toString();
      });
      setCustomSplits(splits);
    } else {
      setSplitMode('equal');
      setCustomSplits({});
    }
    
    setView('addExpense');
  };

  const cancelEditExpense = () => {
    setEditingExpense(null);
    setIsEditMode(false);
    setExpenseDesc('');
    setExpenseAmount('');
    setSelectedPayer('');
    setSelectedParticipants([]);
    setSplitMode('equal');
    setCustomSplits({});
    setView(selectedGroup ? 'groupDetail' : 'dashboard');
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteFirebaseGroup(groupId);
      setGroups(groups.filter(g => g.id !== groupId));
      setSelectedGroup(null);
      setView('dashboard');
      alert('Group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete group');
    }
  };

  const handleJoinGroup = async () => {
    if (!joinGroupId.trim()) {
      alert('Please enter a group ID');
      return;
    }
    
    if (!currentUser) return;
    
    try {
      const groupData = await getGroup(joinGroupId.trim());
      
      if (!groupData) {
        alert('Group not found. Please check the group ID.');
        return;
      }
      
      const group = groupData as Group;
      
      // Check if already a member
      if (group.members.includes(currentUser.id)) {
        alert('You are already a member of this group');
        return;
      }
      
      // Add user to group
      const updatedMembers = [...group.members, currentUser.id];
      await updateGroup(joinGroupId.trim(), { members: updatedMembers });
      
      // Update local state
      await loadUserData();
      setJoinGroupId('');
      setShowJoinLinkModal(false);
      alert(`Successfully joined ${group.name}!`);
    } catch (error) {
      console.error('Error joining group:', error);
      alert('Failed to join group');
    }
  };

  const copyGroupLink = (groupId: string) => {
    const link = `${window.location.origin}?join=${groupId}`;
    navigator.clipboard.writeText(link).then(() => {
      alert('Group link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link. Group ID: ' + groupId);
    });
  };

  const copyGroupId = (groupId: string) => {
    navigator.clipboard.writeText(groupId).then(() => {
      alert('Group ID copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy. Group ID: ' + groupId);
    });
  };

  // Notification functions
  const addNotification = (message: string, type: 'expense' | 'settlement' | 'group') => {
    const notification: Notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: Date.now()
    };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Login/Signup View
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-4 sm:p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <DollarSign className="w-16 h-16 mx-auto text-teal-500 mb-2" />
            <h1 className="text-3xl font-bold text-gray-800">SmartSplit</h1>
            <p className="text-gray-600">Split expenses with friends</p>
          </div>
          
          <div className="space-y-4">
            {isSignUp && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            
            {emailVerificationSent && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  📧 Verification email sent! Please check your inbox or spam folder and verify your email before logging in.
                </p>
              </div>
            )}
            
            <button
              onClick={handleAuth}
              className="w-full bg-teal-500 text-white py-2 rounded-lg hover:bg-teal-600 transition font-semibold"
            >
              {isSignUp ? 'Sign Up' : 'Log In'}
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>
            
            <button
              onClick={handleGoogleSignIn}
              className="w-full bg-white text-gray-700 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
          
          <p className="text-center mt-4 text-gray-600">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-teal-500 ml-2 font-semibold hover:underline"
            >
              {isSignUp ? 'Log In' : 'Sign Up'}
            </button>
          </p>
          
          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Developed & designed with <span className="text-red-500">❤</span> by Sandeep Nitharwal
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard View
  if (view === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-teal-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-lg sm:text-2xl font-bold">SmartSplit</h1>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">Welcome, {currentUser?.name}</span>
              <button onClick={handleLogout} className="p-2 hover:bg-teal-600 rounded">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          {/* Main Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
            <button
              onClick={() => setView('addGroup')}
              className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <Users className="w-7 h-7" />
              <div className="text-left">
                <div className="font-bold text-lg">Create Group</div>
                <div className="text-xs opacity-90">Start splitting expenses</div>
              </div>
            </button>
            
            <button
              onClick={() => setShowJoinLinkModal(true)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <LinkIcon className="w-7 h-7" />
              <div className="text-left">
                <div className="font-bold text-lg">Join Group</div>
                <div className="text-xs opacity-90">Enter group ID or link</div>
              </div>
            </button>
          </div>

          {/* Info Banner for first-time users */}
          {groups.length === 0 && expenses.length === 0 && (
            <div className="mb-4 sm:mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <h3 className="font-semibold text-blue-900 mb-1.5 sm:mb-2 text-sm sm:text-base">👋 Welcome to SmartSplit!</h3>
              <p className="text-xs sm:text-sm text-blue-800 mb-1.5 sm:mb-2">Get started by creating a group or joining an existing one:</p>
              <ul className="text-xs sm:text-sm text-blue-700 space-y-1 ml-4 list-disc">
                <li><strong>Create Group:</strong> Perfect for roommates, trips, or shared expenses</li>
                <li><strong>Join Group:</strong> Someone shared a group link with you? Join here!</li>
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  Your Groups
                </h2>
                <button
                  onClick={() => setView('addFriend')}
                  className="text-xs sm:text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 self-start"
                  title="Manage your friends to easily add them to groups"
                >
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Friends ({friends.length})
                </button>
              </div>
              {groups.length === 0 ? (
                <p className="text-sm sm:text-base text-gray-500">No groups yet. Create one to get started!</p>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  {groups.map(group => (
                    <div
                      key={group.id}
                      onClick={() => {
                        setSelectedGroup(group);
                        setView('groupDetail');
                      }}
                      className="p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                    >
                      <h3 className="font-semibold text-sm sm:text-base truncate">{group.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-600">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5" />
                Overall Balances
              </h2>
              {Object.keys(balances).length === 0 ? (
                <p className="text-sm sm:text-base text-gray-500">All settled up!</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {Object.entries(balances).map(([key, amount]) => {
                    const [fromId, toId] = key.split('-');
                    return (
                      <div key={key} className="p-2.5 sm:p-3 bg-gray-50 rounded">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 mb-2">
                          <span className="text-xs sm:text-sm">
                            {getUserName(fromId)} owes {getUserName(toId)}
                          </span>
                          <span className="font-bold text-teal-600 text-sm sm:text-base">${amount.toFixed(2)}</span>
                        </div>
                        {fromId === currentUser?.id && (
                          <button
                            onClick={() => handleSettleUp(fromId, toId, amount)}
                            className="text-xs sm:text-sm bg-green-500 text-white px-3 py-1 sm:py-1.5 rounded hover:bg-green-600"
                          >
                            Settle Up
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Join Group Modal */}
        {showJoinLinkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">Join a Group</h2>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4">Enter the Group ID to join</p>
              
              <input
                type="text"
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinGroup()}
                placeholder="Enter Group ID"
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 mb-3 sm:mb-4"
              />
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleJoinGroup}
                  className="flex-1 bg-teal-500 text-white py-2 sm:py-2.5 rounded-lg hover:bg-teal-600 transition font-semibold text-sm sm:text-base"
                >
                  Join Group
                </button>
                <button
                  onClick={() => {
                    setShowJoinLinkModal(false);
                    setJoinGroupId('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 sm:py-2.5 rounded-lg hover:bg-gray-400 transition font-semibold text-sm sm:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Footer */}
        <footer className="mt-8 pb-6 text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            Developed & designed with <span className="text-red-500">❤</span> by Sandeep Nitharwal
          </p>
        </footer>
      </div>
    );
  }

  // Group Detail View
  if (view === 'groupDetail' && selectedGroup) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-teal-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <button onClick={() => setView('dashboard')} className="hover:bg-teal-600 p-2 rounded">
                ← Back
              </button>
              {isEditingGroupName ? (
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    className="flex-1 px-3 py-1 text-sm sm:text-base border border-white rounded bg-teal-600 text-white placeholder-teal-200 focus:outline-none focus:ring-2 focus:ring-white"
                    placeholder="Group name"
                  />
                  <button
                    onClick={async () => {
                      if (editGroupName.trim()) {
                        await updateGroup(selectedGroup.id, { name: editGroupName });
                        setSelectedGroup({ ...selectedGroup, name: editGroupName });
                        setGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, name: editGroupName } : g));
                        setIsEditingGroupName(false);
                      }
                    }}
                    className="text-white hover:bg-teal-600 p-1 rounded text-sm"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingGroupName(false);
                      setEditGroupName(selectedGroup.name);
                    }}
                    className="text-white hover:bg-teal-600 p-1 rounded text-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-bold truncate">{selectedGroup.name}</h1>
                  <button
                    onClick={() => {
                      setEditGroupName(selectedGroup.name);
                      setIsEditingGroupName(true);
                    }}
                    className="hover:bg-teal-600 p-1 rounded"
                    title="Edit group name"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-teal-600 rounded">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
            <button
              onClick={() => setView('addExpense')}
              className="flex-1 min-w-[140px] bg-teal-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-teal-600 transition font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Expense
            </button>
            
            <button
              onClick={() => setView('manageGroupMembers')}
              className="bg-purple-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-purple-600 transition font-semibold flex items-center gap-1 sm:gap-2"
              title="Manage members"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Members</span>
            </button>
            
            <button
              onClick={() => copyGroupLink(selectedGroup.id)}
              className="bg-blue-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-blue-600 transition font-semibold flex items-center gap-1 sm:gap-2"
              title="Share group link"
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Share</span>
            </button>
            
            <button
              onClick={() => copyGroupId(selectedGroup.id)}
              className="bg-gray-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-gray-600 transition font-semibold flex items-center gap-1 sm:gap-2"
              title="Copy group ID"
            >
              <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">ID</span>
            </button>
            
            {selectedGroup.createdBy === currentUser?.id && (
              <button
                onClick={() => handleDeleteGroup(selectedGroup.id)}
                className="bg-red-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-lg hover:bg-red-600 transition font-semibold flex items-center gap-1 sm:gap-2"
                title="Delete group"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Group Balances</h2>
              {Object.keys(balances).length === 0 ? (
                <p className="text-sm sm:text-base text-gray-500">All settled up!</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {Object.entries(balances).map(([key, amount]) => {
                    const [fromId, toId] = key.split('-');
                    return (
                      <div key={key} className="p-2.5 sm:p-3 bg-gray-50 rounded">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 mb-2">
                          <span className="text-xs sm:text-sm">
                            {getUserName(fromId)} owes {getUserName(toId)}
                          </span>
                          <span className="font-bold text-teal-600 text-sm sm:text-base">${amount.toFixed(2)}</span>
                        </div>
                        {fromId === currentUser?.id && (
                          <button
                            onClick={() => handleSettleUp(fromId, toId, amount)}
                            className="text-xs sm:text-sm bg-green-500 text-white px-3 py-1 sm:py-1.5 rounded hover:bg-green-600\">
                            Settle Up
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Recent Expenses</h2>
              {expenses.length === 0 ? (
                <p className="text-gray-500">No expenses yet.</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map(expense => {
                    // Calculate current user's share
                    const userShare = currentUser && expense.participants.includes(currentUser.id)
                      ? (expense.splitAmounts && expense.splitAmounts[currentUser.id]
                          ? expense.splitAmounts[currentUser.id]
                          : expense.amount / expense.participants.length)
                      : 0;
                    
                    const isPayer = expense.paidBy === currentUser?.id;
                    
                    return (
                      <div key={expense.id} className="p-3 border border-gray-200 rounded">
                        <div className="flex justify-between items-start gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{expense.description}</h3>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-gray-600">
                              <span>Paid by {getUserName(expense.paidBy)}</span>
                              <span className="hidden sm:inline">•</span>
                              <span className="text-xs sm:text-sm text-gray-500">{formatDateTime(expense.createdAt)}</span>
                            </div>
                            
                            {/* Show user's share and total */}
                            <div className="mt-1.5 sm:mt-2 space-y-1">
                              {isPayer ? (
                                <div className="text-xs sm:text-sm">
                                  <span className="text-green-600 font-medium">You paid: ${expense.amount.toFixed(2)}</span>
                                  {expense.participants.length > 1 && (
                                    <span className="text-gray-600"> (Your share: ${userShare.toFixed(2)})</span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs sm:text-sm">
                                  <span className="text-orange-600 font-medium">Your share: ${userShare.toFixed(2)}</span>
                                  <span className="text-gray-600"> of ${expense.amount.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                            
                            {expense.splitAmounts && (
                              <div className="mt-1 text-xs text-gray-500">
                                <span className="font-medium">Custom split:</span>
                                <span className="block sm:inline">
                                  {expense.participants.map((pId, idx) => (
                                    <span key={pId}>
                                      {idx > 0 && ', '}
                                      {getUserName(pId)}: ${expense.splitAmounts![pId].toFixed(2)}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0 self-start">
                            <button
                              onClick={() => startEditExpense(expense)}
                              className="p-1 hover:bg-blue-100 rounded"
                              title="Edit expense"
                            >
                              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="p-1 hover:bg-red-100 rounded"
                              title="Delete expense"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Add Group View
  if (view === 'addGroup') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-teal-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-4">
            <button onClick={() => setView('dashboard')} className="hover:bg-teal-600 p-2 rounded">
              ← Back
            </button>
            <h1 className="text-lg sm:text-2xl font-bold">Create New Group</h1>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., Roommates, Trip to Paris"
                />
              </div>

              {friends.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Add Members (Optional)</label>
                  <p className="text-xs text-gray-600 mb-2">Select friends to add to this group:</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {friends.map(friend => {
                      const isAdded = groupMembers.includes(friend.id);
                      return (
                        <button
                          key={friend.id}
                          onClick={() => {
                            if (isAdded) {
                              setGroupMembers(groupMembers.filter(id => id !== friend.id));
                            } else {
                              setGroupMembers([...groupMembers, friend.id]);
                            }
                          }}
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm transition ${
                            isAdded
                              ? 'bg-teal-100 text-teal-700 border-2 border-teal-500'
                              : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {isAdded && '✓ '}{friend.name || friend.email}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {friends.length === 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-blue-800">
                    💡 Tip: Add friends first to quickly add them to groups. You can add members after creating the group too!
                  </p>
                </div>
              )}

              <button
                onClick={handleAddGroup}
                className="w-full bg-teal-500 text-white py-2.5 sm:py-3 rounded-lg hover:bg-teal-600 transition font-semibold text-sm sm:text-base"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
        
        {/* Group Created Success Modal */}
        {showGroupCreatedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md">
              <div className="text-center mb-4">
                <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Group Created!</h2>
                <p className="text-sm sm:text-base text-gray-600">Share this group with others to start splitting expenses</p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => copyGroupLink(createdGroupId)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white py-2.5 sm:py-3 rounded-lg hover:bg-blue-600 transition font-semibold text-sm sm:text-base"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  Share Group Link
                </button>
                
                <button
                  onClick={() => copyGroupId(createdGroupId)}
                  className="w-full flex items-center justify-center gap-2 bg-gray-500 text-white py-2.5 sm:py-3 rounded-lg hover:bg-gray-600 transition font-semibold text-sm sm:text-base"
                >
                  <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                  Copy Group ID
                </button>
                
                <button
                  onClick={() => {
                    setShowGroupCreatedModal(false);
                    setView('dashboard');
                  }}
                  className="w-full bg-teal-500 text-white py-2.5 sm:py-3 rounded-lg hover:bg-teal-600 transition font-semibold text-sm sm:text-base"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Manage Group Members View
  if (view === 'manageGroupMembers' && selectedGroup) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-teal-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-4">
            <button onClick={() => setView('groupDetail')} className="hover:bg-teal-600 p-2 rounded">
              ← Back
            </button>
            <h1 className="text-lg sm:text-2xl font-bold">Manage Members</h1>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-800">
                💡 Add members to your group by selecting from your friends or adding new users by email.
              </p>
            </div>

            {/* Quick add from friends */}
            {friends.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Add from Friends</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {friends.map(friend => {
                    const isAdded = selectedGroup.members.includes(friend.id);
                    return (
                      <button
                        key={friend.id}
                        onClick={async () => {
                          if (!isAdded) {
                            const updatedMembers = [...selectedGroup.members, friend.id];
                            await updateGroup(selectedGroup.id, { members: updatedMembers });
                            setSelectedGroup({ ...selectedGroup, members: updatedMembers });
                            setGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, members: updatedMembers } : g));
                          }
                        }}
                        disabled={isAdded}
                        className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm transition ${
                          isAdded
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-teal-100 text-teal-700 border-2 border-teal-500 hover:bg-teal-200'
                        }`}
                      >
                        {isAdded ? '✓ Added' : `+ ${friend.name || friend.email}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add by email */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Add by Email</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={tempMemberEmail}
                  onChange={(e) => setTempMemberEmail(e.target.value)}
                  onKeyPress={async (e) => {
                    if (e.key === 'Enter') {
                      await addMemberToGroup();
                      if (selectedGroup && tempMemberEmail) {
                        const user = await getUserByEmail(tempMemberEmail);
                        if (user && !selectedGroup.members.includes(user.id)) {
                          const updatedMembers = [...selectedGroup.members, user.id];
                          await updateGroup(selectedGroup.id, { members: updatedMembers });
                          setSelectedGroup({ ...selectedGroup, members: updatedMembers });
                          setGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, members: updatedMembers } : g));
                          setTempMemberEmail('');
                        }
                      }
                    }
                  }}
                  placeholder="friend@example.com"
                  className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={async () => {
                    if (!tempMemberEmail) return;
                    try {
                      const user = await getUserByEmail(tempMemberEmail);
                      if (user && !selectedGroup.members.includes(user.id)) {
                        const updatedMembers = [...selectedGroup.members, user.id];
                        await updateGroup(selectedGroup.id, { members: updatedMembers });
                        setSelectedGroup({ ...selectedGroup, members: updatedMembers });
                        setGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, members: updatedMembers } : g));
                        setMemberCache({ ...memberCache, [user.id]: user as User });
                        setTempMemberEmail('');
                        alert('Member added successfully!');
                      } else {
                        alert('User not found or already in group');
                      }
                    } catch (error) {
                      alert('Failed to add member');
                    }
                  }}
                  className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 text-sm sm:text-base whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Current members */}
            <div>
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Current Members ({selectedGroup.members.length})</h3>
              <div className="space-y-1.5 sm:space-y-2">
                {selectedGroup.members.map(memberId => {
                  const member = memberCache[memberId] || friends.find(f => f.id === memberId) || { id: memberId, name: 'Loading...', email: '' };
                  const isCreator = memberId === selectedGroup.createdBy;
                  const isCurrentUser = memberId === currentUser?.id;
                  return (
                    <div key={memberId} className="flex justify-between items-center p-2.5 sm:p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium text-sm sm:text-base truncate">
                          {member.name || 'Unknown'} {isCurrentUser && '(You)'} {isCreator && '👑'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                      {!isCreator && selectedGroup.createdBy === currentUser?.id && (
                        <button
                          onClick={async () => {
                            if (confirm('Remove this member from the group?')) {
                              const updatedMembers = selectedGroup.members.filter(id => id !== memberId);
                              await updateGroup(selectedGroup.id, { members: updatedMembers });
                              setSelectedGroup({ ...selectedGroup, members: updatedMembers });
                              setGroups(groups.map(g => g.id === selectedGroup.id ? { ...g, members: updatedMembers } : g));
                            }
                          }}
                          className="text-red-500 text-xs sm:text-sm font-medium hover:text-red-700 flex-shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Add Friend View
  if (view === 'addFriend') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-teal-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-4">
            <button onClick={() => setView('dashboard')} className="hover:bg-teal-600 p-2 rounded">
              ← Back
            </button>
            <h1 className="text-lg sm:text-2xl font-bold">Manage Friends</h1>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
            <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-800">
                💡 Add friends here to quickly include them when creating groups. You can also add people directly by email when creating a group.
              </p>
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Add Friend by Email</label>
                <input
                  type="email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="friend@example.com"
                />
              </div>

              <button
                onClick={handleAddFriend}
                className="w-full bg-teal-500 text-white py-2.5 sm:py-3 rounded-lg hover:bg-teal-600 transition font-semibold text-sm sm:text-base"
              >
                Add Friend
              </button>
            </div>

            <div className="mt-4 sm:mt-6">
              <h3 className="font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Your Friends</h3>
              {friends.length === 0 ? (
                <p className="text-sm sm:text-base text-gray-500">No friends added yet.</p>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  {friends.map(friend => (
                    <div key={friend.id} className="p-2.5 sm:p-3 border border-gray-200 rounded">
                      <p className="font-medium text-sm sm:text-base truncate">{friend.name}</p>
                      <p className="text-xs sm:text-sm text-gray-600 truncate">{friend.email}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Add Expense View
  if (view === 'addExpense') {
    // Build available members list with proper user data
    let availableMembers: User[] = [];
    
    if (selectedGroup) {
      // For groups, get all members including current user
      availableMembers = selectedGroup.members.map(memberId => {
        if (memberId === currentUser?.id && currentUser) {
          return currentUser;
        }
        return memberCache[memberId] || friends.find(f => f.id === memberId) || {
          id: memberId,
          name: 'Loading...',
          email: '',
          createdAt: ''
        };
      });
    } else {
      // For non-group expenses, show current user and friends
      availableMembers = currentUser ? [currentUser, ...friends] : friends;
    }

    const handleSelectAll = () => {
      if (selectedParticipants.length === availableMembers.length) {
        setSelectedParticipants([]);
      } else {
        setSelectedParticipants(availableMembers.map(m => m.id));
      }
    };

    const allSelected = selectedParticipants.length === availableMembers.length && availableMembers.length > 0;

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-teal-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => isEditMode ? cancelEditExpense() : setView(selectedGroup ? 'groupDetail' : 'dashboard')} 
              className="hover:bg-teal-600 p-2 rounded"
            >
              ← Back
            </button>
            <h1 className="text-lg sm:text-2xl font-bold">{isEditMode ? 'Edit Expense' : 'Add Expense'}</h1>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            {selectedGroup && (
              <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                <p className="text-sm text-teal-800">
                  <strong>Group:</strong> {selectedGroup.name}
                </p>
              </div>
            )}
            
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Description</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., Dinner at restaurant"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Paid By</label>
                <select
                  value={selectedPayer}
                  onChange={(e) => setSelectedPayer(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select payer</option>
                  {availableMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.id === currentUser?.id ? 'You' : member.name || member.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 mb-2">
                  <label className="block text-xs sm:text-sm font-medium">Split Between</label>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs sm:text-sm text-teal-600 hover:text-teal-700 font-medium self-start"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                {/* Split Mode Toggle */}
                <div className="mb-2 sm:mb-3 flex gap-1.5 sm:gap-2 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => {
                      setSplitMode('equal');
                      setCustomSplits({});
                    }}
                    className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition ${
                      splitMode === 'equal'
                        ? 'bg-white text-teal-600 shadow'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Split Equally
                  </button>
                  <button
                    onClick={() => setSplitMode('unequal')}
                    className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition ${
                      splitMode === 'unequal'
                        ? 'bg-white text-teal-600 shadow'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Split Unequally
                  </button>
                </div>
                
                <div className="space-y-1.5 sm:space-y-2 border border-gray-300 rounded-lg p-2 sm:p-3 max-h-80 sm:max-h-96 overflow-y-auto">
                  {availableMembers.length === 0 ? (
                    <p className="text-xs sm:text-sm text-gray-500">No members available</p>
                  ) : (
                    availableMembers.map(member => (
                      <div key={member.id} className="border-b border-gray-100 last:border-0 pb-1.5 sm:pb-2 last:pb-0">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 sm:p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedParticipants.includes(member.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedParticipants([...selectedParticipants, member.id]);
                                if (splitMode === 'unequal' && expenseAmount) {
                                  // Auto-calculate remaining amount
                                  const existingSplits = selectedParticipants.reduce((sum, id) => 
                                    sum + parseFloat(customSplits[id] || '0'), 0
                                  );
                                  const remaining = parseFloat(expenseAmount) - existingSplits;
                                  setCustomSplits({
                                    ...customSplits,
                                    [member.id]: remaining > 0 ? remaining.toFixed(2) : '0'
                                  });
                                }
                              } else {
                                setSelectedParticipants(selectedParticipants.filter(id => id !== member.id));
                                if (splitMode === 'unequal') {
                                  const newSplits = { ...customSplits };
                                  delete newSplits[member.id];
                                  setCustomSplits(newSplits);
                                }
                              }
                            }}
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 flex-shrink-0"
                          />
                          <span className="flex-1 text-xs sm:text-sm truncate">
                            {member.id === currentUser?.id ? 'You' : (member.name || member.email || 'Loading...')}
                          </span>
                          
                          {/* Custom amount input for unequal split */}
                          {splitMode === 'unequal' && selectedParticipants.includes(member.id) && (
                            <input
                              type="number"
                              step="0.01"
                              value={customSplits[member.id] || ''}
                              onChange={(e) => setCustomSplits({
                                ...customSplits,
                                [member.id]: e.target.value
                              })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-20 sm:w-24 px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500"
                              placeholder="$0.00"
                            />
                          )}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                
                {selectedParticipants.length > 0 && expenseAmount && (
                  <div className="mt-2 p-2 sm:p-2.5 bg-gray-50 rounded text-xs sm:text-sm">
                    {splitMode === 'equal' ? (
                      <p className="text-gray-600">
                        Each person pays: <span className="font-semibold text-gray-800">
                          ${(parseFloat(expenseAmount) / selectedParticipants.length).toFixed(2)}
                        </span>
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-gray-600 font-medium">Custom split:</p>
                        {(() => {
                          const totalSplit = selectedParticipants.reduce((sum, id) => 
                            sum + parseFloat(customSplits[id] || '0'), 0
                          );
                          const remaining = parseFloat(expenseAmount) - totalSplit;
                          return (
                            <>
                              <p className="text-gray-600">
                                Total assigned: <span className="font-semibold text-gray-800">${totalSplit.toFixed(2)}</span>
                              </p>
                              {Math.abs(remaining) > 0.01 && (
                                <p className={`font-semibold ${remaining > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                  {remaining > 0 ? 'Remaining' : 'Over'}: ${Math.abs(remaining).toFixed(2)}
                                </p>
                              )}
                              {Math.abs(remaining) <= 0.01 && (
                                <p className="text-green-600 font-semibold">✓ Split matches total</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={handleAddExpense}
                disabled={selectedParticipants.length === 0}
                className="w-full bg-teal-500 text-white py-2.5 sm:py-3 rounded-lg hover:bg-teal-600 transition font-semibold text-sm sm:text-base disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isEditMode ? 'Update Expense' : 'Add Expense'}
              </button>
              
              {isEditMode && (
                <button
                  onClick={cancelEditExpense}
                  className="w-full bg-gray-300 text-gray-700 py-2.5 sm:py-3 rounded-lg hover:bg-gray-400 transition font-semibold text-sm sm:text-base"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Notification Toast Component (rendered globally)
  const NotificationToast = () => {
    if (notifications.length === 0) return null;

    return (
      <div className="fixed top-2 sm:top-4 right-2 sm:right-4 z-50 space-y-1.5 sm:space-y-2 w-[calc(100vw-1rem)] sm:w-auto max-w-sm">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="bg-white rounded-lg shadow-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3 animate-slide-in border-l-4 border-teal-500"
          >
            <div className="flex-shrink-0">
              {notification.type === 'expense' && (
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-teal-500" />
              )}
              {notification.type === 'settlement' && (
                <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              )}
              {notification.type === 'group' && (
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm text-gray-800 break-words">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <NotificationToast />
      {null}
    </>
  );
}
