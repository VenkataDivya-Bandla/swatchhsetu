import type { Status } from "./api";

export const STATUS: Record<Status, { label: string; hex: string; text: string; bg: string; ring: string }> = {
  verified: { label: "Verified usable", hex: "#2E7D4F", text: "text-st-verified", bg: "bg-st-verified", ring: "ring-st-verified" },
  issue: { label: "Reported issue", hex: "#C2410C", text: "text-st-issue", bg: "bg-st-issue", ring: "ring-st-issue" },
  maintenance: { label: "Maintenance in progress", hex: "#2563EB", text: "text-st-maintenance", bg: "bg-st-maintenance", ring: "ring-st-maintenance" },
  unavailable: { label: "Temporarily unavailable", hex: "#6B7280", text: "text-st-unavailable", bg: "bg-st-unavailable", ring: "ring-st-unavailable" },
  overdue: { label: "Verification overdue", hex: "#7C3AED", text: "text-st-overdue", bg: "bg-st-overdue", ring: "ring-st-overdue" },
};

export const STATE_LABEL: Record<string, string> = {
  new: "New", acknowledged: "Acknowledged", assigned: "Assigned", in_progress: "In progress",
  awaiting_verification: "Awaiting verification", closed: "Closed", reopened: "Reopened", invalid: "Invalid",
};

export const ACTION_LABEL: Record<string, string> = {
  issue_created: "Issue created", report_merged: "Another report merged", acknowledged: "Acknowledged",
  assigned: "Assigned", work_started: "Work started", resolved: "Fix submitted", verified_closed: "Verified and closed",
  verification_rejected: "Verification rejected", reopened_by_public: "Reopened by public answers",
  marked_invalid: "Marked invalid", late_submission: "Late offline submission", inspection: "Inspection",
  marked_unavailable: "Marked unavailable", reopened_facility: "Facility reopened", demo_seeded: "Demo data seeded",
};
