"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-url";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Star } from "lucide-react";
import Link from "next/link";

interface Book {
  id: number;
  name: string;
}

const STORAGE_KEY = "devi-bookmarked-books";

export default function Hero() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const [bookmarks, setBookmarks] = useState<number[]>(() => {
  if (typeof window === "undefined") return [];

  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved)
      ? saved.filter((id): id is number => typeof id === "number")
      : [];
  } catch {
    return [];
  }
});  

useEffect(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}, [bookmarks]);


// Fetch books
  useEffect(() => {
    const controller = new AbortController();

    async function fetchBooks() {
      try {
        const response = await fetch(apiUrl(`/books`), {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch books");
        }

        const data = await response.json();
        setBooks(data.books);
      } catch (error) {
        if (controller.signal.aborted) return;

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load books"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchBooks();

    return () => controller.abort();
  }, []);

function toggleBookmark(id: number) {
  setBookmarks((prev) => {
    const updated = prev.includes(id)
      ? prev.filter((bookId) => bookId !== id)
      : [...prev, id];

    return updated;
  });
}  

// Starred books appear first
  const sortedBooks = [...books].sort((a, b) => {
    const aStarred = bookmarks.includes(a.id);
    const bStarred = bookmarks.includes(b.id);

    if (aStarred !== bStarred) {
      return aStarred ? -1 : 1;
    }

    return a.id - b.id;
  });

  return (
    <section className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-20">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10">

        {/* Hero heading */}
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4" />
            <span>श्रीदेवीभागवतम्</span>
          </div>

          <h1 className="text-balance text-3xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Definitions, Not{" "}
            <span className="font-normal italic">
              Decisions.
            </span>

            <span className="mt-3 block">
              The meaning is{" "}
              <span className="text-primary">yours</span>
              {" "}to make.
            </span>
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
            Explore the Devi Bhagavatam through its original
            Sanskrit and literal word meanings.
            No interpretations. Your understanding, your journey.
          </p>
        </div>

        {/* Book selector */}
        <div className="w-full">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Select a Book
            </h2>

            <span className="text-xs text-muted-foreground">
              {books.length} books
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            {/* Table header */}
            <div className="grid grid-cols-[48px_1fr_60px] items-center border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid-cols-[56px_1fr_100px]">
              <span>Save</span>
              <span>Book</span>
              <span className="text-right">Read</span>
            </div>

            {/* Loading */}
            {loading && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Loading books...
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div role="alert" className="p-10 text-center text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Books */}
            {!loading &&
              !error &&
              sortedBooks.map((book) => {
                const starred = bookmarks.includes(book.id);

                return (
                  <div
                    key={book.id}
                    className={`grid grid-cols-[48px_1fr_60px] items-center border-b px-4 py-3 transition-colors last:border-b-0 sm:grid-cols-[56px_1fr_100px] ${
                      starred
                        ? "bg-primary/5"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Bookmark */}
                    <button
                      type="button"
                      onClick={() => toggleBookmark(book.id)}
                      aria-label={
                        starred
                          ? `Remove bookmark for ${book.name}`
                          : `Bookmark ${book.name}`
                      }
                      aria-pressed={starred}
                      className="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <Star
                        className={`size-5 transition-colors ${
                          starred
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>

                    {/* Book name */}
                    <Link
                      href={`/pages/${book.id}`}
                      className="min-w-0 py-2 font-medium transition-colors hover:text-primary"
                    >
                      {book.name}
                    </Link>

                    {/* Read button */}
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <Link href={`/pages/${book.id}`}>
                          <span className="hidden sm:inline">
                            Open
                          </span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}

            {/* Empty */}
            {!loading && !error && books.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No books available.
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && !error && books.length > 0 && (
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>
                Star a book to keep it at the top
              </span>

              <span>
                {bookmarks.filter((id) =>
                  books.some((book) => book.id === id)
                ).length}{" "}
                starred
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

