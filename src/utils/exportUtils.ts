import * as XLSX from "xlsx";
import { Student } from "../types";

/**
 * Exports a comprehensive Excel workbook for an individual student.
 * Contains Summary metadata, Stylistic Indicators list, and Commit timeline.
 */
export function exportStudentToXLSX(student: Student) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary metadata
  const summaryData = [
    { Field: "Student Name", Value: student.name },
    { Field: "Roll / Reg Number", Value: student.rollNo },
    { Field: "GitHub Repository", Value: student.githubUrl },
    { Field: "Analysis Status", Value: student.status },
    { Field: "AI Probability", Value: student.activeReport ? `${student.activeReport.probabilityScore}%` : "N/A" },
    { Field: "Confidence Rating", Value: student.activeReport ? student.activeReport.confidenceRating : "N/A" },
    { Field: "Detection Model Used", Value: student.modelUsed || "N/A" },
    { Field: "Analyzed Filename", Value: student.analyzedFilename || "N/A" },
    { Field: "Verdict Summary", Value: student.activeReport ? student.activeReport.verdictSummary : "N/A" },
    { Field: "Report Generated At", Value: student.activeReport?.analyzedAt ? new Date(student.activeReport.analyzedAt).toLocaleString() : "N/A" }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // Sheet 2: Key Stylistic Flags
  const flagsData = student.activeReport?.evidencePoints.map((pt, idx) => ({
    "No.": idx + 1,
    "Indicator Type": pt.type,
    "Severity": pt.severity,
    "Explanation": pt.explanation,
    "Code Snippet": pt.snippet || ""
  })) || [];
  const wsFlags = XLSX.utils.json_to_sheet(flagsData.length > 0 ? flagsData : [{ Message: "No stylistic indicators detected." }]);
  XLSX.utils.book_append_sheet(wb, wsFlags, "Key Flags");

  // Sheet 3: Commit Timeline
  const commitsData = student.commits?.map((c, idx) => ({
    "No.": idx + 1,
    "Commit Message": c.message,
    "SHA": c.sha.substring(0, 7),
    "Author": c.authorName,
    "Date": c.authorDate ? new Date(c.authorDate).toLocaleString() : "",
    "Additions": c.additions || 0,
    "Deletions": c.deletions || 0,
    "File Changes": c.changedFiles || 0
  })) || [];
  const wsCommits = XLSX.utils.json_to_sheet(commitsData.length > 0 ? commitsData : [{ Message: "No commit history found." }]);
  XLSX.utils.book_append_sheet(wb, wsCommits, "Commit History");

  // Sheet 4: File Audit Breakdowns
  const filesBreakdownData = student.files?.filter(f => f.report).map((f, idx) => ({
    "No.": idx + 1,
    "File Path": f.path,
    "File Size (Bytes)": f.size || 0,
    "AI Probability": f.report ? `${f.report.probabilityScore}%` : "N/A",
    "Confidence": f.report ? f.report.confidenceRating : "N/A",
    "Verdict Summary": f.report ? f.report.verdictSummary : "N/A"
  })) || [];
  const wsFilesBreakdown = XLSX.utils.json_to_sheet(filesBreakdownData.length > 0 ? filesBreakdownData : [{ Message: "No file breakdowns available." }]);
  XLSX.utils.book_append_sheet(wb, wsFilesBreakdown, "File Breakdowns");

  // Save the Excel File
  const fileName = `${student.name.replace(/\s+/g, "_")}_audit_report.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Exports a combined classroom-wide master report to Excel.
 * Contains Master Grid registry, aggregated flags log, and combined commit history.
 */
export function exportAllStudentsToXLSX(students: Student[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Master Registry Grid
  const masterData = students.map((s, idx) => ({
    "No.": idx + 1,
    "Student Name": s.name,
    "Roll No": s.rollNo,
    "GitHub URL": s.githubUrl,
    "Status": s.status,
    "AI Probability": s.activeReport ? `${s.activeReport.probabilityScore}%` : "N/A",
    "Confidence Rating": s.activeReport ? s.activeReport.confidenceRating : "N/A",
    "Model Used": s.modelUsed || "N/A",
    "Key Flags Count": s.activeReport?.evidencePoints.length ?? 0,
    "Commits Count": s.commits?.length ?? 0,
    "Verdict Summary": s.activeReport ? s.activeReport.verdictSummary : "N/A"
  }));
  const wsMaster = XLSX.utils.json_to_sheet(masterData.length > 0 ? masterData : [{ Message: "No students in grid." }]);
  XLSX.utils.book_append_sheet(wb, wsMaster, "Master Registry");

  // Sheet 2: Combined Flags Registry
  const allFlags: any[] = [];
  students.forEach(s => {
    if (s.activeReport?.evidencePoints) {
      s.activeReport.evidencePoints.forEach(pt => {
        allFlags.push({
          "Student Name": s.name,
          "Roll No": s.rollNo,
          "Indicator Type": pt.type,
          "Severity": pt.severity,
          "Explanation": pt.explanation,
          "Code Snippet": pt.snippet || ""
        });
      });
    }
  });
  const wsAllFlags = XLSX.utils.json_to_sheet(allFlags.length > 0 ? allFlags : [{ Message: "No indicators found for any student." }]);
  XLSX.utils.book_append_sheet(wb, wsAllFlags, "All Flags");

  // Sheet 3: Combined Commits Registry
  const allCommits: any[] = [];
  students.forEach(s => {
    if (s.commits) {
      s.commits.forEach(c => {
        allCommits.push({
          "Student Name": s.name,
          "Roll No": s.rollNo,
          "Commit Message": c.message,
          "SHA": c.sha.substring(0, 7),
          "Author": c.authorName,
          "Date": c.authorDate ? new Date(c.authorDate).toLocaleString() : "",
          "Additions": c.additions || 0,
          "Deletions": c.deletions || 0,
          "File Changes": c.changedFiles || 0
        });
      });
    }
  });
  const wsAllCommits = XLSX.utils.json_to_sheet(allCommits.length > 0 ? allCommits : [{ Message: "No commits found for any student." }]);
  XLSX.utils.book_append_sheet(wb, wsAllCommits, "All Commits");

  // Save the Master Excel File
  XLSX.writeFile(wb, "Sentinel_AI_Classroom_Audit_Master.xlsx");
}
