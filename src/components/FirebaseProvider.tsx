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
  serverTimestamp,
  deleteField 
} from "firebase/firestore";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "../firebase";
import { Student, CodeFile, CommitInfo } from "../types";
import { secureKey, resolveKey } from "../utils/crypto";

interface AuthContextType {
  user: User | null;
  mentor: any | null;
  loading: boolean;
  students: Student[];
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  saveGeminiApiKey: (key: string) => Promise<void>;
  saveOpenaiApiKey: (key: string) => Promise<void>;
  saveGrokApiKey: (key: string) => Promise<void>;
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
  const [rawStudents, setRawStudents] = useState<Student[]>([]);
  const [loadedDetails, setLoadedDetails] = useState<Record<string, { files?: CodeFile[], commits?: CommitInfo[] }>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Derive students list by combining raw database metadata with dynamically loaded details
  const students = rawStudents.map(s => {
    const cached = loadedDetails[s.id];
    return {
      ...s,
      files: cached?.files ?? s.files,
      commits: cached?.commits ?? s.commits,
    };
  });

  // Monitor auth status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const mentorRef = doc(db, "mentors", currentUser.uid);
        try {
          const mentorSnap = await getDoc(mentorRef);
          
          if (!mentorSnap.exists()) {
            const newMentor = {
              email: currentUser.email || "",
              name: currentUser.displayName || "Educator",
              geminiApiKey: "",
              openaiApiKey: "",
              grokApiKey: "",
              tutorialCompleted: false,
              createdAt: serverTimestamp(),
            };
            await setDoc(mentorRef, newMentor);
            setMentor(newMentor);
          } else {
            const data = mentorSnap.data();
            const resolvedGemini = currentUser.uid ? await resolveKey(data?.geminiApiKey || "", currentUser.uid) : (data?.geminiApiKey || "");
            const resolvedOpenai = currentUser.uid ? await resolveKey(data?.openaiApiKey || "", currentUser.uid) : (data?.openaiApiKey || "");
            const resolvedGrok = currentUser.uid ? await resolveKey(data?.grokApiKey || "", currentUser.uid) : (data?.grokApiKey || "");
            console.log("[CLIENT DIAG] getDoc - rawGemini:", data?.geminiApiKey ? data.geminiApiKey.substring(0, 6) + "..." : "empty", "resolved:", resolvedGemini ? resolvedGemini.substring(0, 6) + "..." : "empty");
            const decrypted = data ? {
              ...data,
              geminiApiKey: resolvedGemini,
              openaiApiKey: resolvedOpenai,
              grokApiKey: resolvedGrok,
            } : null;
            setMentor(decrypted);
          }
        } catch (error) {
          console.error("Error setting up mentor profile in Firestore:", error);
        }
      } else {
        setMentor(null);
        setRawStudents([]);
        setLoadedDetails({});
        setSelectedStudentId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to active Mentor changes reactively
  useEffect(() => {
    if (!user) return;
    const mentorRef = doc(db, "mentors", user.uid);
    const unsubscribe = onSnapshot(mentorRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const resolvedGemini = user.uid ? await resolveKey(data?.geminiApiKey || "", user.uid) : (data?.geminiApiKey || "");
        const resolvedOpenai = user.uid ? await resolveKey(data?.openaiApiKey || "", user.uid) : (data?.openaiApiKey || "");
        const resolvedGrok = user.uid ? await resolveKey(data?.grokApiKey || "", user.uid) : (data?.grokApiKey || "");
        console.log("[CLIENT DIAG] onSnapshot - rawGemini:", data?.geminiApiKey ? data.geminiApiKey.substring(0, 6) + "..." : "empty", "resolved:", resolvedGemini ? resolvedGemini.substring(0, 6) + "..." : "empty");
        const decrypted = data ? {
          ...data,
          geminiApiKey: resolvedGemini,
          openaiApiKey: resolvedOpenai,
          grokApiKey: resolvedGrok,
        } : null;
        setMentor(decrypted);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `mentors/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  // Real-time synchronization of Students metadata added for this Mentor
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
          files: data.files, // Fallback legacy access
          commits: data.commits, // Fallback legacy access
        });
      });
      setRawStudents(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "students");
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time listener for sub-collections of the currently selected student
  useEffect(() => {
    if (!user || !selectedStudentId) return;

    // 1. Listen to files sub-collection
    const filesCol = collection(db, "students", selectedStudentId, "files");
    const unsubscribeFiles = onSnapshot(filesCol, (snap) => {
      const files: CodeFile[] = [];
      snap.forEach(docSnap => {
        files.push(docSnap.data() as CodeFile);
      });
      if (files.length > 0) {
        setLoadedDetails(prev => ({
          ...prev,
          [selectedStudentId]: {
            ...prev[selectedStudentId],
            files,
          }
        }));
      }
    }, (error) => {
      console.error(`Error loading files for student ${selectedStudentId}:`, error);
    });

    // 2. Listen to commits sub-collection
    const commitsCol = collection(db, "students", selectedStudentId, "commits");
    const unsubscribeCommits = onSnapshot(commitsCol, (snap) => {
      const commits: CommitInfo[] = [];
      snap.forEach(docSnap => {
        commits.push(docSnap.data() as CommitInfo);
      });
      if (commits.length > 0) {
        setLoadedDetails(prev => ({
          ...prev,
          [selectedStudentId]: {
            ...prev[selectedStudentId],
            commits,
          }
        }));
      }
    }, (error) => {
      console.error(`Error loading commits for student ${selectedStudentId}:`, error);
    });

    return () => {
      unsubscribeFiles();
      unsubscribeCommits();
    };
  }, [user, selectedStudentId]);

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
    const secured = await secureKey(key, user.uid);
    console.log("[CLIENT DIAG] saveGeminiApiKey - key to save:", key ? key.substring(0, 6) + "..." : "empty", "secured:", secured ? secured.substring(0, 6) + "..." : "empty");
    try {
      await updateDoc(mentorRef, {
        geminiApiKey: secured,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mentors/${user.uid}`);
    }
  };

  const saveOpenaiApiKey = async (key: string) => {
    if (!user) return;
    const mentorRef = doc(db, "mentors", user.uid);
    const secured = await secureKey(key, user.uid);
    console.log("[CLIENT DIAG] saveOpenaiApiKey - key to save:", key ? key.substring(0, 6) + "..." : "empty", "secured:", secured ? secured.substring(0, 6) + "..." : "empty");
    try {
      await updateDoc(mentorRef, {
        openaiApiKey: secured,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `mentors/${user.uid}`);
    }
  };

  const saveGrokApiKey = async (key: string) => {
    if (!user) return;
    const mentorRef = doc(db, "mentors", user.uid);
    const secured = await secureKey(key, user.uid);
    console.log("[CLIENT DIAG] saveGrokApiKey - key to save:", key ? key.substring(0, 6) + "..." : "empty", "secured:", secured ? secured.substring(0, 6) + "..." : "empty");
    try {
      await updateDoc(mentorRef, {
        grokApiKey: secured,
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
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.rollNo !== undefined) payload.rollNo = updates.rollNo;
      if (updates.githubUrl !== undefined) payload.githubUrl = updates.githubUrl;
      if (updates.status !== undefined) payload.status = updates.status;
      
      if (updates.errorMsg !== undefined) {
        payload.errorMsg = updates.errorMsg === null ? deleteField() : updates.errorMsg;
      }
      if (updates.analyzedFilename !== undefined) {
        payload.analyzedFilename = updates.analyzedFilename === null ? deleteField() : updates.analyzedFilename;
      }
      if (updates.modelUsed !== undefined) {
        payload.modelUsed = updates.modelUsed === null ? deleteField() : updates.modelUsed;
      }
      if (updates.activeReport !== undefined) {
        payload.activeReport = updates.activeReport === null ? deleteField() : updates.activeReport;
      }

      // Intercept files and save to sub-collection to avoid 1MB Firestore limit
      if (updates.files !== undefined && updates.files !== null) {
        for (const file of updates.files) {
          const fileId = file.path.replace(/\//g, "___");
          const fileRef = doc(db, "students", studentId, "files", fileId);
          await setDoc(fileRef, file);
        }
      }

      // Intercept commits and save to sub-collection
      if (updates.commits !== undefined && updates.commits !== null) {
        for (const commit of updates.commits) {
          const commitId = commit.sha || Math.random().toString(36).substring(2, 9);
          const commitRef = doc(db, "students", studentId, "commits", commitId);
          await setDoc(commitRef, commit);
        }
      }

      // Handle explicit nulls for clearing
      if (updates.files === null) {
        const filesCol = collection(db, "students", studentId, "files");
        const snap = await getDocs(filesCol);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, "students", studentId, "files", d.id));
        }
        payload.files = deleteField();
      }

      if (updates.commits === null) {
        const commitsCol = collection(db, "students", studentId, "commits");
        const snap = await getDocs(commitsCol);
        for (const d of snap.docs) {
          await deleteDoc(doc(db, "students", studentId, "commits", d.id));
        }
        payload.commits = deleteField();
      }

      await updateDoc(studentRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!user) return;
    const studentRef = doc(db, "students", studentId);
    try {
      // Clean up sub-collections first
      const filesCol = collection(db, "students", studentId, "files");
      const filesSnap = await getDocs(filesCol);
      for (const d of filesSnap.docs) {
        await deleteDoc(doc(db, "students", studentId, "files", d.id));
      }

      const commitsCol = collection(db, "students", studentId, "commits");
      const commitsSnap = await getDocs(commitsCol);
      for (const d of commitsSnap.docs) {
        await deleteDoc(doc(db, "students", studentId, "commits", d.id));
      }

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
        const filesCol = collection(db, path, docCheck.id, "files");
        const filesSnap = await getDocs(filesCol);
        for (const d of filesSnap.docs) {
          await deleteDoc(doc(db, path, docCheck.id, "files", d.id));
        }

        const commitsCol = collection(db, path, docCheck.id, "commits");
        const commitsSnap = await getDocs(commitsCol);
        for (const d of commitsSnap.docs) {
          await deleteDoc(doc(db, path, docCheck.id, "commits", d.id));
        }

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
      selectedStudentId,
      setSelectedStudentId,
      loginWithGoogle,
      logout,
      saveGeminiApiKey,
      saveOpenaiApiKey,
      saveGrokApiKey,
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
