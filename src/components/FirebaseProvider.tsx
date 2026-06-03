import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  User, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  getDocs, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "../firebase";
import { Student } from "../types";

interface AuthContextType {
  user: User | null;
  mentor: any | null;
  loading: boolean;
  students: Student[];
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  saveGeminiApiKey: (key: string) => Promise<void>;
  saveOpenaiApiKey: (key: string) => Promise<void>;
  saveTutorialCompleted: (completed: boolean) => Promise<void>;
  addStudent: (name: string, rollNo: string, githubUrl: string) => Promise<void>;
  addStudentsBatch: (studentsList: Omit<Student, "id">[]) => Promise<void>;
  updateStudent: (studentId: string, updates: Partial<Student>) => Promise<void>;
  removeStudent: (studentId: string) => Promise<void>;
  clearAllStudents: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mentor, setMentor] = useState<any | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Monitor auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch or create Mentor profile document
        const mentorRef = doc(db, "mentors", currentUser.uid);
        try {
          const mentorSnap = await getDoc(mentorRef);
          
          if (!mentorSnap.exists()) {
            const newMentor = {
              email: currentUser.email || "",
              name: currentUser.displayName || "Educator",
              geminiApiKey: "",
              openaiApiKey: "",
              tutorialCompleted: false,
              createdAt: serverTimestamp(),
            };
            await setDoc(mentorRef, newMentor);
            setMentor(newMentor);
          } else {
            setMentor(mentorSnap.data());
          }
        } catch (error) {
          console.error("Error setting up mentor profile in Firestore:", error);
        }
      } else {
        setMentor(null);
        setStudents([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to active Mentor changes (e.g. Gemini key updates) reactively
  useEffect(() => {
    if (!user) return;
    const mentorRef = doc(db, "mentors", user.uid);
    const unsubscribe = onSnapshot(mentorRef, (snap) => {
      if (snap.exists()) {
        setMentor(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `mentors/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  // Real-time synchronization of Students added for this Mentor
  useEffect(() => {
    if (!user) return;

    const studentsCollection = collection(db, "students");
    const studentsQuery = query(
      studentsCollection, 
      where("mentorId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(studentsQuery, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name,
          rollNo: data.rollNo,
          githubUrl: data.githubUrl,
          status: data.status,
          errorMsg: data.errorMsg,
          analyzedFilename: data.analyzedFilename,
          modelUsed: data.modelUsed,
          activeReport: data.activeReport,
          files: data.files,
          commits: data.commits,
        });
      });
      setStudents(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "students");
    });

    return () => unsubscribe();
  }, [user]);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google authentication failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
      throw error;
    }
  };

  const saveGeminiApiKey = async (key: string) => {
    if (!user) return;
    const mentorRef = doc(db, "mentors", user.uid);
    try {
      await updateDoc(mentorRef, {
        geminiApiKey: key.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mentors/${user.uid}`);
    }
  };

  const saveOpenaiApiKey = async (key: string) => {
    if (!user) return;
    const mentorRef = doc(db, "mentors", user.uid);
    try {
      await updateDoc(mentorRef, {
        openaiApiKey: key.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mentors/${user.uid}`);
    }
  };

  const saveTutorialCompleted = async (completed: boolean) => {
    if (!user) return;
    const mentorRef = doc(db, "mentors", user.uid);
    try {
      await updateDoc(mentorRef, {
        tutorialCompleted: completed,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mentors/${user.uid}`);
    }
  };

  const addStudent = async (name: string, rollNo: string, githubUrl: string) => {
    if (!user) return;
    const path = "students";
    try {
      await addDoc(collection(db, path), {
        mentorId: user.uid,
        name: name,
        rollNo: rollNo,
        githubUrl: githubUrl,
        status: "pending",
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const addStudentsBatch = async (studentsList: Omit<Student, "id">[]) => {
    if (!user) return;
    const path = "students";
    try {
      for (const s of studentsList) {
        await addDoc(collection(db, path), {
          mentorId: user.uid,
          name: s.name,
          rollNo: s.rollNo,
          githubUrl: s.githubUrl,
          status: "pending",
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const updateStudent = async (studentId: string, updates: Partial<Student>) => {
    if (!user) return;
    const studentRef = doc(db, "students", studentId);
    try {
      // Create updates payload. Ensure no custom keys breach firestore.rules
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.rollNo !== undefined) payload.rollNo = updates.rollNo;
      if (updates.githubUrl !== undefined) payload.githubUrl = updates.githubUrl;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.errorMsg !== undefined) payload.errorMsg = updates.errorMsg;
      if (updates.analyzedFilename !== undefined) payload.analyzedFilename = updates.analyzedFilename;
      if (updates.modelUsed !== undefined) payload.modelUsed = updates.modelUsed;
      if (updates.activeReport !== undefined) payload.activeReport = updates.activeReport;
      if (updates.files !== undefined) payload.files = updates.files;
      if (updates.commits !== undefined) payload.commits = updates.commits;

      await updateDoc(studentRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!user) return;
    const studentRef = doc(db, "students", studentId);
    try {
      await deleteDoc(studentRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
    }
  };

  const clearAllStudents = async () => {
    if (!user) return;
    const path = "students";
    try {
      const snap = await getDocs(query(collection(db, path), where("mentorId", "==", user.uid)));
      for (const docCheck of snap.docs) {
        await deleteDoc(doc(db, path, docCheck.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      mentor,
      loading,
      students,
      loginWithGoogle,
      logout,
      saveGeminiApiKey,
      saveOpenaiApiKey,
      saveTutorialCompleted,
      addStudent,
      addStudentsBatch,
      updateStudent,
      removeStudent,
      clearAllStudents,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
}
