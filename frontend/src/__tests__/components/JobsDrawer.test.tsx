import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobsDrawer } from "@/components/Jobs/JobsDrawer";
import { updateJob } from "@/components/Jobs/JobsStore";

// Reset job store state between tests by overwriting with known entries
beforeEach(() => {
  // nothing — each test seeds its own state
});

describe("JobsDrawer", () => {
  it("shows empty state when no jobs exist", () => {
    render(<JobsDrawer open={true} onClose={() => {}} />);
    expect(screen.getByText("No recent jobs.")).toBeInTheDocument();
  });

  it("renders a running job with label and status badge", () => {
    updateJob({ id: "test-1", type: "library_scan", label: "Library scan", status: "running" });
    render(<JobsDrawer open={true} onClose={() => {}} />);
    expect(screen.getByText("Library scan")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("renders a completed job with completed badge", () => {
    updateJob({ id: "test-2", type: "import", label: "Import book", status: "completed" });
    render(<JobsDrawer open={true} onClose={() => {}} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("renders a failed job with error message", () => {
    updateJob({
      id: "test-3",
      type: "download",
      label: "Download failed",
      status: "failed",
      error: "Connection timed out",
    });
    render(<JobsDrawer open={true} onClose={() => {}} />);
    expect(screen.getByText("Connection timed out")).toBeInTheDocument();
  });

  it("renders job progress message when present", () => {
    updateJob({
      id: "test-4",
      type: "library_scan",
      label: "Scanning",
      status: "running",
      message: "Indexing: Author/Book.epub",
      percent: 42,
    });
    render(<JobsDrawer open={true} onClose={() => {}} />);
    expect(screen.getByText("Indexing: Author/Book.epub")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<JobsDrawer open={false} onClose={() => {}} />);
    expect(screen.queryByText("Jobs")).not.toBeInTheDocument();
  });
});
