import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookCard } from "@/components/Library/BookCard";
import type { Book } from "@/types";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 1,
    title: "Test Book",
    sort_title: "Test Book",
    subtitle: null,
    description: null,
    isbn_10: null,
    isbn_13: null,
    publisher: null,
    published_date: null,
    language: null,
    page_count: null,
    cover_image_path: null,
    file_path: "/books/test.epub",
    file_format: "epub",
    file_size: null,
    added_date: "2024-01-01T00:00:00",
    modified_date: "2024-01-01T00:00:00",
    metadata_source: null,
    metadata_confidence: null,
    series_id: null,
    series_index: null,
    is_read: false,
    is_missing: false,
    rating: null,
    authors: [],
    series: null,
    ...overrides,
  };
}

describe("BookCard", () => {
  it("renders the book title", () => {
    render(<BookCard book={makeBook({ title: "Dune" })} />);
    expect(screen.getByText("Dune")).toBeInTheDocument();
  });

  it("renders author names", () => {
    const book = makeBook({
      authors: [{ id: 1, name: "Frank Herbert", sort_name: "Herbert, Frank" }],
    });
    render(<BookCard book={book} />);
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
  });

  it("renders multiple authors comma-separated", () => {
    const book = makeBook({
      authors: [
        { id: 1, name: "Author One", sort_name: "One, Author" },
        { id: 2, name: "Author Two", sort_name: "Two, Author" },
      ],
    });
    render(<BookCard book={book} />);
    expect(screen.getByText("Author One, Author Two")).toBeInTheDocument();
  });

  it("renders the file format badge", () => {
    render(<BookCard book={makeBook({ file_format: "pdf" })} />);
    expect(screen.getByText("pdf")).toBeInTheDocument();
  });

  it("shows Missing overlay when book is missing", () => {
    render(<BookCard book={makeBook({ is_missing: true })} />);
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("does not show Missing overlay when book is present", () => {
    render(<BookCard book={makeBook({ is_missing: false })} />);
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });

  it("renders cover image when cover_image_path is set", () => {
    render(<BookCard book={makeBook({ cover_image_path: "/covers/1.jpg", id: 1 })} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/covers/1.jpg");
  });

  it("renders placeholder when cover_image_path is null", () => {
    render(<BookCard book={makeBook({ cover_image_path: null })} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BookCard book={makeBook()} onClick={onClick} />);
    await user.click(screen.getByText("Test Book"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
