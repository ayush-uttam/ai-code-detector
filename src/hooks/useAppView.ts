import { useState, useEffect } from "react";
import { Student } from "../types";
import { useFirebase } from "../components/FirebaseProvider";

export function useAppView(students: Student[]) {
  const { selectedStudentId, setSelectedStudentId } = useFirebase();
  const [view, setView] = useState<"students" | "report" | "code">("students");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<{ type: "single" | "all"; studentId?: string } | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [finishedNotification, setFinishedNotification] = useState<{ name: string; rollNo: string; score: number } | null>(null);

  // Set default selected student when list loads
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId, setSelectedStudentId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || null;
  const currentStudentIndex = students.findIndex((s) => s.id === selectedStudentId);

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setSelectedStudentId(students[currentStudentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex >= 0 && currentStudentIndex < students.length - 1) {
      setSelectedStudentId(students[currentStudentIndex + 1].id);
    }
  };

  // Default selected file path when selected student changes
  useEffect(() => {
    if (selectedStudent && selectedStudent.files && selectedStudent.files.length > 0) {
      setSelectedFilePath(selectedStudent.files[0].path);
    } else {
      setSelectedFilePath("");
    }
  }, [selectedStudentId, selectedStudent?.files?.length]);

  // Handle Printing
  useEffect(() => {
    if (printTarget) {
      const timer = setTimeout(() => {
        window.print();
        setPrintTarget(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [printTarget]);

  const handleSelectStudent = (id: string | null) => {
    setSelectedStudentId(id);
    if (id) {
      setView("report");
    }
  };

  return {
    selectedStudentId,
    setSelectedStudentId: handleSelectStudent,
    selectedStudent,
    currentStudentIndex,
    handlePrevStudent,
    handleNextStudent,
    view,
    setView,
    isMenuOpen,
    setIsMenuOpen,
    printTarget,
    setPrintTarget,
    selectedFilePath,
    setSelectedFilePath,
    finishedNotification,
    setFinishedNotification,
  };
}
