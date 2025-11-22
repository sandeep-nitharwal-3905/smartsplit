# Development Guide - SplitEasy

## Table of Contents
1. [Technology Stack](#technology-stack)
2. [Real-Time Communication](#real-time-communication)
3. [Architecture](#architecture)
4. [Firebase Implementation](#firebase-implementation)
5. [Authentication Flow](#authentication-flow)
6. [Data Models](#data-models)
7. [Development Setup](#development-setup)
8. [Deployment](#deployment)

---

## Technology Stack

### Frontend Framework
- **React 19.2.0** - UI library
- **TypeScript** - Type safety and better development experience
- **Vite 7.2.4** - Fast build tool and dev server

### Styling
- **Tailwind CSS 4.1.17** - Utility-first CSS framework
- **Lucide React 0.554.0** - Icon library

### Backend & Database
- **Firebase Authentication** - User authentication (Email/Password + Google OAuth)
- **Firebase Firestore** - NoSQL real-time database
- **Firebase SDK 12.6.0** - Client SDK

### Real-Time Communication
- **Firebase Firestore Real-time Listeners** - NOT WebSockets or Webhooks
  - Uses Google's proprietary protocol
  - Built on top of gRPC and HTTP/2
  - Handles connection management automatically

---

## Real-Time Communication

### What We Use: Firebase Firestore `onSnapshot()`

**NOT WebSockets:**
- WebSockets require manual connection management
- Need to handle reconnection logic
- Must implement custom protocol

**NOT Webhooks:**
- Webhooks are server-to-server HTTP callbacks
- Require a backend server to receive events
- Not suitable for real-time client updates

**We Use: Firestore Real-time Listeners**
```typescript
import { onSnapshot, query, collection, where } from 'firebase/firestore';

// This creates a persistent connection that pushes updates to the client
const unsubscribe = onSnapshot(query, (snapshot) => {
  // Automatically called when data changes
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  callback(data);
});
```

### How Firebase Real-time Listeners Work

#### Under the Hood
1. **Initial Connection:**
   - Client establishes connection to Firebase servers
   - Uses HTTP/2 for multiplexing multiple streams
   - Falls back to long polling if HTTP/2 unavailable

2. **Data Synchronization:**
   - Server pushes changes to client immediately
   - Uses efficient binary protocol (Protocol Buffers)
   - Only sends changed data, not entire documents

3. **Connection Management:**
   - Automatic reconnection on network issues
   - Connection pooling across multiple listeners
   - Presence detection (online/offline state)

4. **Local Caching:**
   - Offline support with local cache
   - Optimistic updates for better UX
   - Sync when connection restored

### Protocol Details
```
Firebase Firestore Communication Stack:
┌─────────────────────────────────────┐
│   React App (onSnapshot callbacks)  │
├─────────────────────────────────────┤
│   Firebase JS SDK                   │
├─────────────────────────────────────┤
│   gRPC/HTTP2 (Primary)              │
│   Long Polling (Fallback)           │
├─────────────────────────────────────┤
│   Google Cloud Infrastructure       │
└─────────────────────────────────────┘
```

---

## Architecture

### Component Structure
```
App.tsx (Main Component - 1349 lines)
├── Authentication Views
│   ├── Login/Signup
│   └── Email Verification
├── Dashboard View
│   ├── Groups List (Real-time)
│   ├── Your Expenses (Real-time)
│   └── Quick Actions
├── Group Detail View
│   ├── Group Balances (Real-time)
│   ├── Expenses List (Real-time)
│   └── Action Buttons
├── Add Expense View
│   ├── Participant Selection
│   └── Split Calculation
├── Add Group View
│   └── Member Management
└── Add Friend View
    └── Friend Search
```

### State Management
```typescript
// User State
const [currentUser, setCurrentUser] = useState<User | null>(null);
const [friends, setFriends] = useState<User[]>([]);

// Group State
const [groups, setGroups] = useState<Group[]>([]);
const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

// Expense State
const [expenses, setExpenses] = useState<Expense[]>([]);

// Member Cache (for performance)
const [memberCache, setMemberCache] = useState<{ [key: string]: User }>({});
```

### Real-time Listeners Lifecycle
```typescript
useEffect(() => {
  if (!currentUser) return;

  // 1. Subscribe to real-time updates
  const unsubscribeGroups = onUserGroupsChange(
    currentUser.id, 
    (updatedGroups) => setGroups(updatedGroups)
  );

  const unsubscribeExpenses = onUserExpensesChange(
    currentUser.id,
    (updatedExpenses) => setExpenses(updatedExpenses)
  );

  // 2. Cleanup on unmount (prevents memory leaks)
  return () => {
    unsubscribeGroups();
    unsubscribeExpenses();
  };
}, [currentUser]); // Re-subscribe when user changes
```

---

## Firebase Implementation

### Configuration (`src/firebase/config.ts`)
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### Authentication (`src/firebase/auth.ts`)

#### Email/Password Authentication
```typescript
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';

export const signUpUser = async (email: string, password: string, name: string) => {
  // 1. Create user account
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // 2. Update display name
  await updateProfile(userCredential.user, { displayName: name });
  
  // 3. Send verification email
  await sendEmailVerification(userCredential.user);
  
  // 4. Create user document in Firestore
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    email,
    name,
    createdAt: new Date().toISOString()
  });
  
  return userCredential.user;
};
```

#### Google OAuth Authentication
```typescript
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  
  // Check if user document exists, create if not
  const userDoc = await getDoc(doc(db, 'users', result.user.uid));
  if (!userDoc.exists()) {
    await setDoc(doc(db, 'users', result.user.uid), {
      email: result.user.email,
      name: result.user.displayName,
      createdAt: new Date().toISOString()
    });
  }
  
  return result.user;
};
```

### Real-time Listeners (`src/firebase/firestore.ts`)

#### 1. User Groups Listener
```typescript
export const onUserGroupsChange = (
  userId: string,
  callback: (groups: Group[]) => void
): (() => void) => {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('members', 'array-contains', userId));
  
  // onSnapshot returns unsubscribe function
  return onSnapshot(q, (snapshot) => {
    const groups = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Group[];
    callback(groups);
  }, (error) => {
    console.error('Error listening to groups:', error);
  });
};
```

**How it works:**
- Queries all groups where `members` array contains `userId`
- Listens for any changes (add, update, delete)
- Calls callback with updated data automatically
- Returns cleanup function to stop listening

#### 2. Group Expenses Listener
```typescript
export const onGroupExpensesChange = (
  groupId: string,
  callback: (expenses: Expense[]) => void
): (() => void) => {
  const expensesRef = collection(db, 'expenses');
  const q = query(expensesRef, where('groupId', '==', groupId));
  
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];
    callback(expenses);
  });
};
```

#### 3. User Expenses Listener
```typescript
export const onUserExpensesChange = (
  userId: string,
  callback: (expenses: Expense[]) => void
): (() => void) => {
  const expensesRef = collection(db, 'expenses');
  const q = query(expensesRef, where('participants', 'array-contains', userId));
  
  return onSnapshot(q, (snapshot) => {
    const expenses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Expense[];
    callback(expenses);
  });
};
```

### CRUD Operations

#### Create Expense
```typescript
export const createExpense = async (expense: Omit<Expense, 'id'>) => {
  const docRef = await addDoc(collection(db, 'expenses'), {
    ...expense,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
};
```

#### Delete Expense
```typescript
export const deleteExpense = async (expenseId: string) => {
  await deleteDoc(doc(db, 'expenses', expenseId));
};
```

#### Create Settlement
```typescript
export const createSettlement = async (
  fromUserId: string,
  toUserId: string,
  amount: number,
  groupId: string | null
) => {
  // Settlement is recorded as an expense with only creditor as participant
  await createExpense({
    description: 'Settlement',
    amount,
    paidBy: fromUserId,
    participants: [toUserId], // Only creditor receives the payment
    groupId
  });
};
```

---

## Authentication Flow

### 1. Initial Load
```
App Start
  ↓
onAuthStateChange listener
  ↓
User logged in? → Yes → Load user data → Dashboard
  ↓                                          ↓
  No                                    Subscribe to real-time updates
  ↓
Login/Signup View
```

### 2. Signup Flow
```
User enters email/password/name
  ↓
createUserWithEmailAndPassword()
  ↓
Update profile with name
  ↓
Send verification email
  ↓
Create user document in Firestore
  ↓
Redirect to login with message
```

### 3. Google Sign-in Flow
```
User clicks "Sign in with Google"
  ↓
signInWithPopup(GoogleAuthProvider)
  ↓
Check if user document exists
  ↓
Create if not exists
  ↓
Auto-login → Dashboard
```

### 4. Email Verification
```
User signs up → Email sent
  ↓
User clicks link in email
  ↓
Firebase verifies email
  ↓
User logs in → emailVerified = true
  ↓
Access granted
```

---

## Data Models

### User
```typescript
interface User {
  id: string;           // Firebase Auth UID
  email: string;        // User's email
  name: string;         // Display name
  createdAt: string;    // ISO timestamp
}
```

**Firestore Collection:** `users/{userId}`

### Group
```typescript
interface Group {
  id: string;           // Auto-generated document ID
  name: string;         // Group name
  members: string[];    // Array of user IDs
  createdBy: string;    // Creator's user ID
  createdAt: string;    // ISO timestamp
}
```

**Firestore Collection:** `groups/{groupId}`

**Indexes Required:**
- `members` (array-contains) for querying user's groups

### Expense
```typescript
interface Expense {
  id: string;              // Auto-generated document ID
  description: string;     // What was the expense for
  amount: number;          // Total amount
  paidBy: string;          // User ID who paid
  participants: string[];  // Array of user IDs who share
  groupId: string | null;  // Null for non-group expenses
  createdAt: string;       // ISO timestamp
}
```

**Firestore Collection:** `expenses/{expenseId}`

**Indexes Required:**
- `groupId` for querying group expenses
- `participants` (array-contains) for querying user expenses

**Special Case - Settlements:**
- `description` = "Settlement"
- `paidBy` = person paying debt
- `participants` = [creditor only]
- This creates a payment record that cancels debt

### Friend Relationship
```typescript
interface Friend {
  userId: string;      // Current user's ID
  friendId: string;    // Friend's user ID
  createdAt: string;   // ISO timestamp
}
```

**Firestore Collection:** `friends/{autoId}`

**Compound Index Required:**
- `userId` + `friendId` for efficient queries

---

## Development Setup

### Prerequisites
```bash
Node.js 18+ 
npm or yarn
Firebase account
```

### 1. Clone Repository
```bash
git clone https://github.com/sandeep-nitharwal-3905/smartsplit.git
cd splitwise-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create `.env` file:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project
3. Enable Authentication (Email/Password + Google)
4. Create Firestore database

#### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Users can read/write groups they're members of
    match /groups/{groupId} {
      allow read: if request.auth != null && 
                     request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
                               request.auth.uid == resource.data.createdBy;
    }
    
    // Users can read/write expenses they participate in
    match /expenses/{expenseId} {
      allow read: if request.auth != null && 
                     request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && 
                       request.auth.uid == resource.data.paidBy;
    }
    
    // Users can manage their own friends
    match /friends/{friendId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && 
                       request.auth.uid == resource.data.userId;
    }
  }
}
```

#### Required Indexes
Create these composite indexes in Firestore:

1. **Expenses by Group:**
   - Collection: `expenses`
   - Fields: `groupId` (Ascending), `createdAt` (Descending)

2. **Expenses by Participant:**
   - Collection: `expenses`
   - Fields: `participants` (Array-contains), `createdAt` (Descending)

3. **Friends Lookup:**
   - Collection: `friends`
   - Fields: `userId` (Ascending), `friendId` (Ascending)

### 5. Run Development Server
```bash
npm run dev
```

Application will be available at `http://localhost:5173`

---

## Deployment

### Build for Production
```bash
npm run build
```

Output will be in `dist/` folder.

### Deploy to Firebase Hosting
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize hosting
firebase init hosting

# Deploy
firebase deploy --only hosting
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Deploy to Netlify
```bash
# Build
npm run build

# Deploy dist/ folder via Netlify UI or CLI
netlify deploy --prod --dir=dist
```

---

## Performance Optimizations

### 1. Member Cache
```typescript
// Cache user data to avoid repeated Firestore reads
const [memberCache, setMemberCache] = useState<{ [key: string]: User }>({});

// When loading members, add to cache
if (!memberCache[memberId]) {
  const userData = await getDoc(doc(db, 'users', memberId));
  setMemberCache(prev => ({
    ...prev,
    [memberId]: userData.data() as User
  }));
}
```

### 2. Listener Cleanup
```typescript
// Always cleanup listeners to prevent memory leaks
useEffect(() => {
  const unsubscribe = onUserGroupsChange(userId, callback);
  return () => unsubscribe(); // Cleanup on unmount
}, [dependencies]);
```

### 3. Query Optimization
```typescript
// Use specific queries instead of fetching all data
const q = query(
  collection(db, 'expenses'),
  where('participants', 'array-contains', userId),
  orderBy('createdAt', 'desc'),
  limit(50) // Limit results
);
```

---

## Troubleshooting

### Common Issues

#### 1. "Firebase: Error (auth/unauthorized-domain)"
**Solution:** Add your domain to Firebase Console:
- Go to Authentication → Settings → Authorized domains
- Add `localhost`, your Vercel/Netlify domain

#### 2. "Missing or insufficient permissions"
**Solution:** Check Firestore security rules
- Ensure user is authenticated
- Verify user is in group members/participants array

#### 3. Real-time updates not working
**Solution:**
- Check browser console for errors
- Verify listener is properly subscribed
- Ensure cleanup function is called on unmount
- Check network tab for active connections

#### 4. "FirebaseError: Missing or insufficient permissions"
**Solution:**
- User must be logged in (`request.auth != null`)
- User must be in `members` or `participants` array
- Check Firestore security rules

---

## Testing

### Manual Testing Checklist

#### Authentication
- [ ] Sign up with email/password
- [ ] Email verification email sent
- [ ] Sign in with verified account
- [ ] Sign in with Google
- [ ] Logout

#### Groups
- [ ] Create group
- [ ] Add members to group
- [ ] View group details
- [ ] Delete group (creator only)
- [ ] Join group via link/ID

#### Expenses
- [ ] Add expense in group
- [ ] Add expense without group
- [ ] View expense list
- [ ] Delete expense (payer only)
- [ ] Split calculation correct

#### Real-time Updates
- [ ] Open two browsers with different accounts
- [ ] Add expense in browser 1
- [ ] Verify it appears in browser 2 instantly
- [ ] Delete expense in browser 2
- [ ] Verify it disappears in browser 1

#### Mobile Responsiveness
- [ ] Test on 375px (mobile)
- [ ] Test on 768px (tablet)
- [ ] Test on 1024px+ (desktop)
- [ ] All buttons accessible
- [ ] Forms usable on touch devices

---

## Security Best Practices

### 1. Environment Variables
- Never commit `.env` to Git
- Use different Firebase projects for dev/prod
- Rotate API keys periodically

### 2. Firestore Rules
- Always require authentication
- Validate user permissions
- Use security rules simulator to test

### 3. Client-Side Validation
```typescript
// Validate inputs before sending to Firebase
if (!email || !password || password.length < 6) {
  throw new Error('Invalid input');
}
```

### 4. Email Verification
- Require email verification for sensitive operations
- Check `user.emailVerified` before critical actions

---

## Key Differences: Real-time Listeners vs Alternatives

| Feature | Firestore Listeners | WebSockets | Webhooks |
|---------|-------------------|------------|----------|
| **Setup** | Simple (1 function) | Complex (server required) | Complex (backend required) |
| **Reconnection** | Automatic | Manual | N/A |
| **Scaling** | Automatic | Manual | Automatic |
| **Cost** | Pay per read | Server hosting | Server hosting |
| **Latency** | ~100-500ms | ~50-100ms | Seconds to minutes |
| **Client Support** | JavaScript SDK | Any client | Server-to-server only |
| **Offline Support** | Built-in | Custom | None |
| **Use Case** | Client apps | Games, chat | Backend integrations |

---

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Real-time Updates](https://firebase.google.com/docs/firestore/query-data/listen)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## License
MIT License - See LICENSE file for details

## Contributors
- Sandeep Nitharwal (sandeep-nitharwal-3905)

---

**Last Updated:** November 23, 2025
