import { useState, useEffect } from 'react';
import { Users, Plus, DollarSign, LogOut, Trash2, User, ArrowLeftRight, Share2, Copy, Link as LinkIcon } from 'lucide-react';
import { onAuthStateChange, signUpUser, signInUser, logoutUser, signInWithGoogle, sendVerificationEmail } from './firebase/auth';
import { 
  createGroup as createFirebaseGroup, 
  getUserGroups, 
  createExpense as createFirebaseExpense,
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
        setExpenses(updatedExpenses as Expense[]);
        await loadUsersFromExpenses(updatedExpenses as Expense[]);
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
      const sharePerPerson = expense.amount / participants.length;

      participants.forEach(participantId => {
        if (participantId !== payer) {
          const key = `${participantId}-${payer}`;
          const reverseKey = `${payer}-${participantId}`;

          if (balanceMap[reverseKey]) {
            balanceMap[reverseKey] -= sharePerPerson;
            if (Math.abs(balanceMap[reverseKey]) < 0.01) {
              delete balanceMap[reverseKey];
            }
          } else {
            balanceMap[key] = (balanceMap[key] || 0) + sharePerPerson;
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
      setGroupName('');
      setGroupMembers([]);
      setView('dashboard');
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
    
    try {
      const newExpense = {
        description: expenseDesc,
        amount: parseFloat(expenseAmount),
        paidBy: selectedPayer,
        participants: selectedParticipants,
        groupId: selectedGroup?.id || null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id
      };
      
      const docRef = await createFirebaseExpense(newExpense);
      setExpenses([...expenses, { id: docRef.id, ...newExpense }]);
      
      setExpenseDesc('');
      setExpenseAmount('');
      setSelectedPayer('');
      setSelectedParticipants([]);
      setView(selectedGroup ? 'groupDetail' : 'dashboard');
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense');
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

  const deleteExpense = async (expenseId: string) => {
    try {
      await deleteFirebaseExpense(expenseId);
      setExpenses(expenses.filter(e => e.id !== expenseId));
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense');
    }
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
            <h1 className="text-3xl font-bold text-gray-800">SplitEasy</h1>
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
                  📧 Verification email sent! Please check your inbox and verify your email before logging in.
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
            <h1 className="text-lg sm:text-2xl font-bold">SplitEasy</h1>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">Welcome, {currentUser?.name}</span>
              <button onClick={handleLogout} className="p-2 hover:bg-teal-600 rounded">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-6">
            <button
              onClick={() => setView('addGroup')}
              className="bg-white p-4 sm:p-6 rounded-lg shadow hover:shadow-lg transition flex items-center justify-center gap-3"
            >
              <Users className="w-6 h-6 text-teal-500" />
              <span className="font-semibold">Create Group</span>
            </button>
            
            <button
              onClick={() => setShowJoinLinkModal(true)}
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition flex items-center justify-center gap-3"
            >
              <LinkIcon className="w-6 h-6 text-teal-500" />
              <span className="font-semibold">Join Group</span>
            </button>
            
            <button
              onClick={() => setView('addFriend')}
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition flex items-center justify-center gap-3"
            >
              <User className="w-6 h-6 text-teal-500" />
              <span className="font-semibold">Add Friend</span>
            </button>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <button
              onClick={() => {
                setSelectedGroup(null);
                setView('addExpense');
              }}  className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition flex items-center justify-center gap-3"
            >
              <Plus className="w-6 h-6 text-teal-500" />
              <span className="font-semibold">Add Expense</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Your Groups
              </h2>
              {groups.length === 0 ? (
                <p className="text-gray-500">No groups yet. Create one to get started!</p>
              ) : (
                <div className="space-y-2">
                  {groups.map(group => (
                    <div
                      key={group.id}
                      onClick={() => {
                        setSelectedGroup(group);
                        setView('groupDetail');
                      }}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                    >
                      <h3 className="font-semibold">{group.name}</h3>
                      <p className="text-sm text-gray-600">{group.members.length} members</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Overall Balances
              </h2>
              {Object.keys(balances).length === 0 ? (
                <p className="text-gray-500">All settled up!</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(balances).map(([key, amount]) => {
                    const [fromId, toId] = key.split('-');
                    return (
                      <div key={key} className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">
                            {getUserName(fromId)} owes {getUserName(toId)}
                          </span>
                          <span className="font-bold text-teal-600">${amount.toFixed(2)}</span>
                        </div>
                        {fromId === currentUser?.id && (
                          <button
                            onClick={() => handleSettleUp(fromId, toId, amount)}
                            className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">Join a Group</h2>
              <p className="text-sm sm:text-base text-gray-600 mb-4">Enter the Group ID to join</p>
              
              <input
                type="text"
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinGroup()}
                placeholder="Enter Group ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 mb-4"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={handleJoinGroup}
                  className="flex-1 bg-teal-500 text-white py-2 rounded-lg hover:bg-teal-600 transition font-semibold"
                >
                  Join Group
                </button>
                <button
                  onClick={() => {
                    setShowJoinLinkModal(false);
                    setJoinGroupId('');
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Group Detail View
  if (view === 'groupDetail' && selectedGroup) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-teal-500 text-white p-3 sm:p-4 shadow-lg">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={() => setView('dashboard')} className="hover:bg-teal-600 p-2 rounded">
                ← Back
              </button>
              <h1 className="text-lg sm:text-2xl font-bold truncate">{selectedGroup.name}</h1>
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
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xl font-bold mb-4">Group Balances</h2>
              {Object.keys(balances).length === 0 ? (
                <p className="text-gray-500">All settled up!</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(balances).map(([key, amount]) => {
                    const [fromId, toId] = key.split('-');
                    return (
                      <div key={key} className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">
                            {getUserName(fromId)} owes {getUserName(toId)}
                          </span>
                          <span className="font-bold text-teal-600">${amount.toFixed(2)}</span>
                        </div>
                        {fromId === currentUser?.id && (
                          <button
                            onClick={() => handleSettleUp(fromId, toId, amount)}
                            className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
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

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Recent Expenses</h2>
              {expenses.length === 0 ? (
                <p className="text-gray-500">No expenses yet.</p>
              ) : (
                <div className="space-y-2">
                  {expenses.map(expense => (
                    <div key={expense.id} className="p-3 border border-gray-200 rounded flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{expense.description}</h3>
                        <p className="text-sm text-gray-600">
                          Paid by {getUserName(expense.paidBy)}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="font-bold text-teal-600">${expense.amount.toFixed(2)}</span>
                        <button
                          onClick={() => deleteExpense(expense.id)}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
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

        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., Roommates, Trip to Paris"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Add Members (Email)</label>
                <p className="text-xs text-gray-500 mb-2">
                  For demo: Create multiple accounts to add as members
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={tempMemberEmail}
                    onChange={(e) => setTempMemberEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addMemberToGroup()}
                    placeholder="friend@example.com"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    onClick={addMemberToGroup}
                    className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1">
                  {groupMembers.map(memberId => {
                    const member = memberCache[memberId] || friends.find(f => f.id === memberId);
                    return (
                      <div key={memberId} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{member?.name || 'Unknown'}</span>
                        <button
                          onClick={() => setGroupMembers(groupMembers.filter(id => id !== memberId))}
                          className="text-red-500 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleAddGroup}
                className="w-full bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-600 transition font-semibold"
              >
                Create Group
              </button>
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
            <h1 className="text-lg sm:text-2xl font-bold">Add Friend</h1>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Friend's Email</label>
                <input
                  type="email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddFriend()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="friend@example.com"
                />
              </div>

              <button
                onClick={handleAddFriend}
                className="w-full bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-600 transition font-semibold"
              >
                Add Friend
              </button>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold mb-3">Your Friends</h3>
              {friends.length === 0 ? (
                <p className="text-gray-500">No friends added yet.</p>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => (
                    <div key={friend.id} className="p-3 border border-gray-200 rounded">
                      <p className="font-medium">{friend.name}</p>
                      <p className="text-sm text-gray-600">{friend.email}</p>
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
              onClick={() => setView(selectedGroup ? 'groupDetail' : 'dashboard')} 
              className="hover:bg-teal-600 p-2 rounded"
            >
              ← Back
            </button>
            <h1 className="text-lg sm:text-2xl font-bold">Add Expense</h1>
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
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g., Dinner at restaurant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Paid By</label>
                <select
                  value={selectedPayer}
                  onChange={(e) => setSelectedPayer(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Split Between</label>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-2 border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto">
                  {availableMembers.length === 0 ? (
                    <p className="text-sm text-gray-500">No members available</p>
                  ) : (
                    availableMembers.map(member => (
                      <label key={member.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedParticipants.includes(member.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParticipants([...selectedParticipants, member.id]);
                            } else {
                              setSelectedParticipants(selectedParticipants.filter(id => id !== member.id));
                            }
                          }}
                          className="w-4 h-4 text-teal-600"
                        />
                        <span className="flex-1">
                          {member.id === currentUser?.id ? 'You' : (member.name || member.email || 'Loading...')}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {selectedParticipants.length > 0 && expenseAmount && (
                  <p className="text-sm text-gray-600 mt-2">
                    Each person pays: ${(parseFloat(expenseAmount) / selectedParticipants.length).toFixed(2)}
                  </p>
                )}
              </div>

              <button
                onClick={handleAddExpense}
                disabled={selectedParticipants.length === 0}
                className="w-full bg-teal-500 text-white py-3 rounded-lg hover:bg-teal-600 transition font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}