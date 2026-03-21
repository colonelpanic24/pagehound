import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useBooks } from "@/hooks/useLibrary";
import * as booksApi from "@/api/books";
import type { Book } from "@/types";
import type { WSMessage } from "@/hooks/useWebSocket";

// ── Mock onWsEvent ─────────────────────────────────────────────────────────────
// vi.hoisted ensures wsHandlers is initialized before the hoisted vi.mock factory runs.
type Handler = (msg: WSMessage) => void
const wsHandlers = vi.hoisted(() => ({} as Record<string, Handler[]>))

vi.mock("@/hooks/useWebSocket", () => ({
  onWsEvent: (event: string, handler: Handler) => {
    if (!wsHandlers[event]) wsHandlers[event] = []
    wsHandlers[event].push(handler)
    return () => {
      wsHandlers[event] = wsHandlers[event].filter((h) => h !== handler)
    }
  },
}))

function fireWsEvent(event: string, payload: Record<string, unknown>) {
  const msg: WSMessage = { event, payload, timestamp: "" }
  wsHandlers[event]?.forEach((h) => h(msg))
}

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
    tags: [],
    ...overrides,
  }
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.restoreAllMocks()
  Object.keys(wsHandlers).forEach((k) => delete wsHandlers[k])
})

describe("useBooks", () => {
  it("returns books from the API", async () => {
    vi.spyOn(booksApi, "fetchBooks").mockResolvedValue([makeBook({ title: "Dune" })])

    const { result } = renderHook(() => useBooks(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.books).toHaveLength(1)
    expect(result.current.books[0].title).toBe("Dune")
  })

  it("returns empty array while loading", () => {
    vi.spyOn(booksApi, "fetchBooks").mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useBooks(), { wrapper: makeWrapper() })

    expect(result.current.books).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it("passes filters to fetchBooks", async () => {
    const spy = vi.spyOn(booksApi, "fetchBooks").mockResolvedValue([])

    const { result } = renderHook(() => useBooks({ format: "pdf", language: "en" }), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(spy).toHaveBeenCalledWith({ format: "pdf", language: "en" })
  })

  it("prepends a book on library.book_added WS event", async () => {
    const existing = makeBook({ id: 1, title: "Existing" })
    const added = makeBook({ id: 2, title: "Newly Added" })
    vi.spyOn(booksApi, "fetchBooks").mockResolvedValue([existing])

    const { result } = renderHook(() => useBooks(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => fireWsEvent("library.book_added", { book: added }))

    await waitFor(() => expect(result.current.books[0].title).toBe("Newly Added"))
    expect(result.current.books[1].title).toBe("Existing")
  })

  it("updates a book on library.book_updated WS event", async () => {
    const book = makeBook({ id: 1, title: "Original Title" })
    vi.spyOn(booksApi, "fetchBooks").mockResolvedValue([book])

    const { result } = renderHook(() => useBooks(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => fireWsEvent("library.book_updated", { book_id: 1, fields: { title: "Updated Title" } }))

    await waitFor(() => expect(result.current.books[0].title).toBe("Updated Title"))
  })

  it("removes a book on library.book_removed WS event", async () => {
    const book1 = makeBook({ id: 1, title: "Keep" })
    const book2 = makeBook({ id: 2, title: "Remove Me" })
    vi.spyOn(booksApi, "fetchBooks").mockResolvedValue([book1, book2])

    const { result } = renderHook(() => useBooks(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.books).toHaveLength(2))

    await act(async () => fireWsEvent("library.book_removed", { book_id: 2 }))

    await waitFor(() => expect(result.current.books).toHaveLength(1))
    expect(result.current.books[0].title).toBe("Keep")
  })
})
