"use client";

import { use, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/api-url";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Page {
  id: number;
  book_id: number;
  page_number: number;
}

interface Props {
  params: Promise<{ bookId: string }>;
}

const PAGE_SIZE = 10;

export default function BookPages({ params }: Props) {
  const { bookId } = use(params);
  return <BookPageList key={bookId} bookId={bookId} />;
}

function BookPageList({ bookId }: { bookId: string }) {
  const STORAGE_KEY = `devi-bookmarks-book-${bookId}`;

  const [pages, setPages] = useState<Page[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<number[]>([]);

  // Fetch pages from FastAPI
  useEffect(() => {
    const controller = new AbortController();

    async function fetchPages() {
      try {
        const response = await fetch(
          apiUrl(`/books/${bookId}/pages`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch pages");
        }

        const data = await response.json();
        if (controller.signal.aborted) return;

        setPages(data.pages);

        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          if (Array.isArray(saved)) {
            setBookmarks(saved.filter((id): id is number => typeof id === "number"));
          }
        } catch {
          // Keep the empty bookmark list if saved data is unavailable.
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load pages"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchPages();

    return () => controller.abort();
  }, [bookId, STORAGE_KEY]);

  // Toggle bookmark
  function toggleBookmark(id: number) {
    const updated = bookmarks.includes(id)
      ? bookmarks.filter((pageId) => pageId !== id)
      : [...bookmarks, id];

    setBookmarks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  // Filter and prioritize bookmarks
  const filteredPages = useMemo(() => {
    const query = search.trim();

    return pages
      .filter((page) =>
        query === "" ||
        page.page_number.toString().includes(query)
      )
      .sort((a, b) => {
        const aStarred = bookmarks.includes(a.id);
        const bStarred = bookmarks.includes(b.id);

        if (aStarred !== bStarred) {
          return aStarred ? -1 : 1;
        }

        return a.page_number - b.page_number;
      });
  }, [pages, search, bookmarks]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPages.length / PAGE_SIZE)
  );

  const activePage = Math.min(currentPage, totalPages);

  const visiblePages = filteredPages.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 sm:px-5 sm:py-16 md:py-24">

      {/* Back */}
      <Button
        variant="ghost"
        className="mb-5 min-h-11 sm:mb-10"
        nativeButton={false}
        render={<Link href="/" />}
      >
        <ArrowLeft className="size-4" />
        Back to Books
      </Button>

      {/* Header */}
      <div className="mb-6 space-y-3 sm:mb-10">
        <h1 className="text-3xl font-bold sm:text-4xl tracking-tight md:text-5xl">
          Book {bookId}
        </h1>

        <p className="text-muted-foreground">
          Select a page to begin reading. Star pages to save
          your place.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          type="number"
          min="1"
          placeholder="Search page number..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          aria-label="Search page number"
          className="min-h-11 pl-10 text-base"
        />
      </div>

      {/* Loading */}
      {loading && (
        <p className="py-10 text-center text-muted-foreground">
          Loading pages...
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="py-10 text-center text-destructive">
          {error}
        </p>
      )}

      {/* Pages */}
      {!loading && !error && (
        <>
          <div className="overflow-hidden rounded-xl border">
            {/* Table Header */}
            <div className="grid grid-cols-[48px_minmax(0,1fr)_60px] items-center gap-x-1 border-b bg-muted/40 px-3 py-3 sm:px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Save</span>
              <span>Page</span>
              <span className="text-right">Read</span>
            </div>

            {visiblePages.map((page) => {
              const starred = bookmarks.includes(page.id);

              return (
                <div
                  key={page.id}
                  className={`grid grid-cols-[48px_minmax(0,1fr)_60px] items-center gap-x-1 border-b px-3 py-3 sm:px-4 last:border-b-0 ${
                    starred
                      ? "bg-primary/5"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* Star */}
                  <button
                    type="button"
                    onClick={() => toggleBookmark(page.id)}
                    aria-label={
                      starred
                        ? `Remove bookmark for page ${page.page_number}`
                        : `Bookmark page ${page.page_number}`
                    }
                    aria-pressed={starred}
                    className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
                  >
                    <Star
                      className={`size-5 ${
                        starred
                          ? "fill-primary text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>

                  {/* Page link */}
                  <Link
                    href={`/read/${page.id}`}
                    className="py-3 font-medium wrap-anywhere hover:text-primary"
                  >
                    Page {page.page_number}
                  </Link>

                  {/* Read */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      className="min-h-11 min-w-11"
                      nativeButton={false}
                      render={<Link href={`/read/${page.id}`} />}
                      aria-label={`Read page ${page.page_number}`}
                    >
                      Read
                    </Button>
                  </div>
                </div>
              );
            })}

            {visiblePages.length === 0 && (
              <p className="p-10 text-center text-sm text-muted-foreground">
                No pages found.
              </p>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {activePage} of {totalPages}
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  disabled={activePage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  aria-label="Previous pages"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  disabled={activePage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(totalPages, page + 1)
                    )
                  }
                  aria-label="Next pages"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
