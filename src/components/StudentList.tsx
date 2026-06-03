import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Student } from "../types";
import { useFirebase } from "./FirebaseProvider";
import { 
  FileSpreadsheet, 
  Upload, 
  Plus, 
  Trash2, 
  Edit2,
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  FileCode,
  UserCheck,
  Search,
  Filter,
  BarChart2
} from "lucide-react";

interface StudentListProps {
  students: Student[];
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  onAnalyzeStudent: (student: Student, forceRefetch?: boolean) => void;
  onAnalyzeAll: () => void;
}

export default function StudentList({
  students,
  selectedStudentId,
  setSelectedStudentId,
  onAnalyzeStudent,
  onAnalyzeAll,
}: StudentListProps) {
  const { 
    addStudent, 
    addStudentsBatch, 
    removeStudent: firestoreRemoveStudent, 
    clearAllStudents: firestoreClearAllStudents,
    updateStudent
  } = useFirebase();
  const [dragActive, setDragActive] = useState(false);
  const [filterStr, setFilterStr] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low" | "pending">( "all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Manual adding state
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualRoll, setManualRoll] = useState("");
  const [manualRepo, setManualRepo] = useState("");
  const [manualError, setManualError] = useState("");

  // Statistics calculation
  const totalStudents = students.length;
  const analyzedCount = students.filter(s => s.status === "analyzed").length;
  const highRiskCount = students.filter(
    s => s.status === "analyzed" && s.activeReport && s.activeReport.probabilityScore >= 70
  ).length;
  const mediumRiskCount = students.filter(
    s => s.status === "analyzed" && s.activeReport && s.activeReport.probabilityScore >= 30 && s.activeReport.probabilityScore < 70
  ).length;
  const lowRiskCount = students.filter(
    s => s.status === "analyzed" && s.activeReport && s.activeReport.probabilityScore < 30
  ).length;

  // Average AI probability score
  const analyzedStudentsWithScores = students.filter(s => s.status === "analyzed" && s.activeReport);
  const averageProbability = analyzedStudentsWithScores.length > 0
    ? Math.round(analyzedStudentsWithScores.reduce((acc, s) => acc + (s.activeReport?.probabilityScore || 0), 0) / analyzedStudentsWithScores.length)
    : 0;

  // Handle excel parser
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read as array of arrays to find correct headers easily
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          alert("The Excel sheet is empty or has too few rows!");
          return;
        }

        // Find header row or match columns intelligently
        const headers = rows[0].map(h => String(h || "").trim().toLowerCase());
        
        let nameIdx = headers.findIndex(h => h.includes("name") || h === "student" || h.includes("nama"));
        let rollIdx = headers.findIndex(h => h.includes("roll") || h.includes("no") || h.includes("id") || h.includes("nim") || h.includes("register"));
        let repoIdx = headers.findIndex(h => h.includes("git") || h.includes("repo") || h.includes("url") || h.includes("link") || h.includes("address"));

        // Backups if not found
        if (nameIdx === -1) nameIdx = 0;
        if (rollIdx === -1) rollIdx = 1;
        if (repoIdx === -1) repoIdx = 2;

        const importedStudents: Omit<Student, "id">[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const name = String(row[nameIdx] || "").trim();
          const rollNo = String(row[rollIdx] || "").trim();
          const githubUrl = String(row[repoIdx] || "").trim();

          if (name || githubUrl) {
            importedStudents.push({
              name: name || "Unnamed Student",
              rollNo: rollNo || `N/A`,
              githubUrl: githubUrl,
              status: "pending",
            });
          }
        }

        if (importedStudents.length > 0) {
          await addStudentsBatch(importedStudents);
        } else {
          alert("Could not extract any student records. Ensure the Excel has column values for Student Name, Roll No, and GitHub Repository.");
        }
      } catch (err: any) {
        console.error("Excel parse fail:", err);
        alert(`Error parsing file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleEditClick = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStudentId(student.id);
    setManualName(student.name);
    setManualRoll(student.rollNo);
    setManualRepo(student.githubUrl);
    setManualError("");
    setShowManualForm(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError("");

    if (!manualName.trim()) {
      setManualError("Student Name is required.");
      return;
    }
    if (!manualRepo.trim()) {
      setManualError("GitHub Repository URL is required.");
      return;
    }
    if (!manualRepo.includes("github.com")) {
      setManualError("Must be a valid github.com domain URL.");
      return;
    }

    try {
      if (editingStudentId) {
        const studentToEdit = students.find(s => s.id === editingStudentId);
        if (studentToEdit) {
          const isRepoChanged = studentToEdit.githubUrl !== manualRepo.trim();
          const updates: Partial<Student> = {
            name: manualName.trim(),
            rollNo: manualRoll.trim(),
            githubUrl: manualRepo.trim(),
          };

          if (isRepoChanged) {
            updates.status = "pending";
            updates.errorMsg = null as any;
            updates.files = null as any;
            updates.commits = null as any;
            updates.activeReport = null as any;
            updates.analyzedFilename = null as any;
            updates.modelUsed = null as any;
          }

          await updateStudent(editingStudentId, updates);
        }
      } else {
        await addStudent(manualName.trim(), manualRoll.trim(), manualRepo.trim());
      }
      // Clear status
      setManualName("");
      setManualRoll("");
      setManualRepo("");
      setEditingStudentId(null);
      setShowManualForm(false);
    } catch (err: any) {
      console.error(err);
      setManualError(err.message || "Could not save student.");
    }
  };

  const handleDeleteRow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await firestoreRemoveStudent(id);
      if (selectedStudentId === id) {
        const remaining = students.filter((s) => s.id !== id);
        setSelectedStudentId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllStudentsClick = async () => {
    if (window.confirm("Are you sure you want to delete all students from this dashboard?")) {
      try {
        await firestoreClearAllStudents();
        setSelectedStudentId(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    const sName = s.name.toLowerCase();
    const sRoll = s.rollNo.toLowerCase();
    const sRepo = s.githubUrl.toLowerCase();
    const matchText = sName.includes(filterStr.toLowerCase()) || 
                      sRoll.includes(filterStr.toLowerCase()) || 
                      sRepo.includes(filterStr.toLowerCase());
                      
    if (!matchText) return false;

    if (riskFilter === "high") {
      return s.status === "analyzed" && s.activeReport && s.activeReport.probabilityScore >= 70;
    }
    if (riskFilter === "medium") {
      return s.status === "analyzed" && s.activeReport && s.activeReport.probabilityScore >= 30 && s.activeReport.probabilityScore < 70;
    }
    if (riskFilter === "low") {
      return s.status === "analyzed" && s.activeReport && s.activeReport.probabilityScore < 30;
    }
    if (riskFilter === "pending") {
      return s.status !== "analyzed";
    }
    return true;
  });

  return (
    <div id="student-list-container" className="flex flex-col h-full bg-zinc-900 border border-white/10 rounded-xl shadow-lg overflow-hidden">
      
      {/* 1. Header with Upload Options */}
      <div className="p-4 border-b border-white/10 bg-zinc-950/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-sky-400" />
            <h2 className="font-display font-semibold text-white text-base">Student Repositories</h2>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              id="add-manual-toggle"
              onClick={() => {
                if (showManualForm) {
                  setShowManualForm(false);
                  setEditingStudentId(null);
                  setManualName("");
                  setManualRoll("");
                  setManualRepo("");
                  setManualError("");
                } else {
                  setShowManualForm(true);
                  setEditingStudentId(null);
                  setManualName("");
                  setManualRoll("");
                  setManualRepo("");
                  setManualError("");
                }
              }}
              className="py-1 px-2.5 text-xs font-semibold border border-white/10 hover:bg-white/5 text-zinc-300 bg-zinc-950 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showManualForm && editingStudentId ? "Add Student instead" : "Add Student"}</span>
            </button>
            {students.length > 0 && (
              <button
                id="clear-all-btn"
                onClick={clearAllStudentsClick}
                className="py-1 px-2 text-xs font-semibold border border-rose-950 hover:bg-rose-950/20 text-rose-400 bg-zinc-950 rounded-lg transition-colors cursor-pointer"
              >
                Clear List
              </button>
            )}
          </div>
        </div>

        {/* Drag and Drop Box */}
        {!showManualForm ? (
          <div
            id="excel-drop-zone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
            className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              dragActive
                ? "border-sky-500 bg-sky-950/20"
                : "border-white/10 hover:border-sky-550 bg-zinc-950"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-zinc-300">Upload Student Excel Sheet</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop or click to browse (.xlsx, .xls, .csv)</p>
          </div>
        ) : (
          /* Manual Add Form */
          <form id="manual-student-form" onSubmit={handleManualSubmit} className="bg-zinc-950 border border-white/10 rounded-lg p-3 space-y-2.5 text-xs animate-fadeIn">
            <h3 className="font-semibold text-sky-400 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>{editingStudentId ? "Edit Student Details" : "Add Student Repository"}</span>
            </h3>
            
            {manualError && (
              <div className="text-[10px] text-rose-300 bg-rose-950/40 border border-rose-900/30 p-1.5 rounded-md">
                {manualError}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Name</label>
                <input
                  id="student-name-input"
                  type="text"
                  placeholder="e.g. Rachel Green"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">Roll / Reg No</label>
                <input
                  id="student-roll-input"
                  type="text"
                  placeholder="e.g. CS2026-089"
                  value={manualRoll}
                  onChange={(e) => setManualRoll(e.target.value)}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs text-white placeholder:text-zinc-600 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 mb-0.5">GitHub Repository Link</label>
              <input
                id="student-repo-input"
                type="text"
                placeholder="e.g. https://github.com/rachel/chat-app"
                value={manualRepo}
                onChange={(e) => setManualRepo(e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs text-white focus:ring-1 focus:ring-sky-500 focus:outline-none placeholder:text-zinc-700"
              />
            </div>

            <div className="flex justify-end gap-1.5 pt-1.5">
              <button
                id="cancel-manual-btn"
                type="button"
                onClick={() => {
                  setShowManualForm(false);
                  setEditingStudentId(null);
                  setManualName("");
                  setManualRoll("");
                  setManualRepo("");
                  setManualError("");
                }}
                className="py-1 px-2.5 border border-white/10 rounded hover:bg-white/5 text-zinc-400 transition-colors cursor-pointer text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                id="submit-manual-btn"
                type="submit"
                className="py-1 px-3 bg-sky-500 rounded text-white hover:bg-sky-400 transition-colors font-semibold flex items-center gap-1 cursor-pointer text-xs shadow"
              >
                {editingStudentId ? "Save Changes" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Micro Dashboard Stats (Visible only if students exist) */}
      {totalStudents > 0 && (
        <div className="p-3 border-b border-white/10 bg-sky-950/10 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-zinc-950 border border-white/10 p-2 rounded-lg">
            <span className="block text-[10px] text-zinc-400 font-medium">Loaded</span>
            <span className="text-sm font-semibold text-zinc-250">{totalStudents}</span>
          </div>
          <div className="bg-zinc-950 border border-white/10 p-2 rounded-lg">
            <span className="block text-[10px] text-zinc-400 font-medium">Checked</span>
            <span className="text-sm font-semibold text-sky-400">{analyzedCount}</span>
          </div>
          <div className="bg-zinc-950 border border-white/10 p-2 rounded-lg">
            <span className="block text-[10px] text-zinc-400 font-medium">Avg Risk</span>
            <span className={`text-sm font-bold ${
              averageProbability >= 70 ? "text-rose-450" : averageProbability >= 30 ? "text-amber-400" : "text-emerald-450"
            }`}>{averageProbability}%</span>
          </div>
          <div className="bg-zinc-950 border border-white/10 p-2 rounded-lg">
            <span className="block text-[10px] text-zinc-400 font-medium">High Risk</span>
            <span className="text-sm font-bold text-rose-450">{highRiskCount}</span>
          </div>
        </div>
      )}

      {/* 3. Search & Filter Bar */}
      {totalStudents > 0 && (
        <div id="student-filters" className="p-3 border-b border-white/10 flex gap-1.5 items-center bg-zinc-900/60">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              id="student-search-input"
              type="text"
              placeholder="Search students..."
              value={filterStr}
              onChange={(e) => setFilterStr(e.target.value)}
              className="w-full pl-8 pr-2 py-1 bg-zinc-950 border border-white/10 rounded text-xs text-white focus:ring-1 focus:ring-sky-505 focus:outline-none"
            />
          </div>
          <div className="relative">
            <select
              id="student-risk-filter-select"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
              className="py-1 px-2 bg-zinc-950 border border-white/10 rounded text-xs font-semibold text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="high">High ({highRiskCount})</option>
              <option value="medium">Medium ({mediumRiskCount})</option>
              <option value="low">Low ({lowRiskCount})</option>
              <option value="pending">Pending ({totalStudents - analyzedCount})</option>
            </select>
          </div>
        </div>
      )}

      {/* 4. Student List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            {students.length === 0 ? (
              <>
                <FileCode className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-400">No students registered yet.</p>
                <p className="text-[10px] mt-1 max-w-xs mx-auto text-zinc-550 leading-relaxed">
                  Upload an Excel sheet or add student details manually to start analyzing AI-generated content probability!
                </p>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-400">No results match your filters.</p>
              </>
            )}
          </div>
        ) : (
          filteredStudents.map((student) => {
            const isSelected = selectedStudentId === student.id;
            const score = student.activeReport?.probabilityScore ?? null;
            
            let statusBadge = null;
            let percentBadge = null;

            if (student.status === "fetching") {
              statusBadge = (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 bg-sky-950/40 px-1.5 py-0.5 rounded-full border border-sky-500/10">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Fetching</span>
                </span>
              );
            } else if (student.status === "analyzing") {
              statusBadge = (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-450 bg-sky-955/35 px-1.5 py-0.5 rounded-full border border-sky-500/10">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Analyzing</span>
                </span>
              );
            } else if (student.status === "error") {
              statusBadge = (
                <span className="text-[10px] font-semibold text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded-full flex items-center gap-1 border border-rose-500/10">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Error</span>
                </span>
              );
            } else if (student.status === "fetched") {
              statusBadge = (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-550/10">
                  Files Loaded
                </span>
              );
            } else if (student.status === "analyzed" && score !== null) {
              if (score >= 70) {
                percentBadge = (
                  <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3 h-3 text-rose-455" />
                    <span>{score}% AI</span>
                  </span>
                );
              } else if (score >= 30) {
                percentBadge = (
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 shrink-0">
                    <span>{score}% AI</span>
                  </span>
                );
              } else {
                percentBadge = (
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 shrink-0">
                    <CheckCircle className="w-3 h-3 text-emerald-455" />
                    <span>{score}% AI</span>
                  </span>
                );
              }
            } else {
              statusBadge = (
                <span className="text-[10px] font-semibold text-zinc-450 bg-zinc-950 px-1.5 py-0.5 rounded-full border border-white/5">
                  Pending
                </span>
              );
            }

            return (
              <div
                id={`student-row-${student.id}`}
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`p-3 cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isSelected 
                    ? "bg-sky-500/10 border-l-4 border-sky-500" 
                    : "hover:bg-white/5 border-l-4 border-transparent"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-xs text-white truncate leading-tight">
                      {student.name}
                    </h3>
                    <span className="text-[10px] font-mono font-medium text-zinc-400 shrink-0 bg-zinc-850 px-1 rounded">
                      {student.rollNo}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono truncate mb-1">
                    {student.githubUrl}
                  </p>
                  
                  {student.errorMsg && (
                    <p className="text-[10px] text-rose-500 font-medium line-clamp-1">
                      {student.errorMsg}
                    </p>
                  )}
                  
                  {statusBadge && <div className="mt-1">{statusBadge}</div>}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0 self-center">
                  {percentBadge}
                  
                  <div className="flex items-center gap-1">
                    <button
                      id={`analyze-student-${student.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyzeStudent(student, true);
                      }}
                      disabled={student.status === "fetching" || student.status === "analyzing"}
                      className="py-1 px-1.5 text-[10px] font-semibold bg-zinc-800 text-zinc-300 rounded hover:bg-sky-500 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {student.status === "analyzed" ? "Re-Run" : "Analyze"}
                    </button>
                    
                    <button
                      id={`edit-student-${student.id}`}
                      onClick={(e) => handleEditClick(student, e)}
                      title="Edit Student"
                      className="p-1 text-zinc-550 hover:text-sky-400 rounded hover:bg-white/5 transition-colors cursor-pointer animate-fadeIn"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`delete-student-${student.id}`}
                      onClick={(e) => handleDeleteRow(student.id, e)}
                      title="Remove Student"
                      className="p-1 text-zinc-550 hover:text-rose-455 rounded hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Footer Run All Actions */}
      {students.length > 0 && (
        <div className="p-3 bg-zinc-950 border-t border-white/10 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-zinc-500">
            Total of {totalStudents} Student{totalStudents !== 1 ? "s" : ""}
          </span>
          <button
            id="analyze-all-btn"
            onClick={onAnalyzeAll}
            disabled={students.every((s) => s.status === "analyzing" || s.status === "fetching")}
            className="py-1.5 px-3 bg-sky-500 text-white font-semibold text-xs rounded-lg hover:bg-sky-400 transition-all shadow-md shadow-sky-950/40 flex items-center gap-1.5 cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-550"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Analyze Grid Repos</span>
          </button>
        </div>
      )}
    </div>
  );
}
