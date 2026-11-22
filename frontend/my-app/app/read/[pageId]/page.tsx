"use client";

import { use, useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-url";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";

// =========================================================
// TYPES
// =========================================================

interface Translation {
  id: number;
  text_id: number;
  translation: string;
}

interface TextEntry {
  id: number;
  page_id: number;
  type: "title" | "speaker" | "text";
  text: string;
  translation: Translation | null;
}

interface PageContent {
  page_id: number;
  book_id: number;
  page_number: number;
  content: TextEntry[];
}

interface BookPage {
  id: number;
  book_id: number;
  page_number: number;
}

interface Props {
  params: Promise<{ pageId: string }>;
}

// =========================================================
// TRANSLATION PARSER
// =========================================================

function parseTranslation(translation: string) {
  const sections = translation.split(/COMBINED WORDS:/i);

  const words = sections[0]
    .replace(/WORDS:/i, "")
    .trim()
    .split("\n")
    .filter((line) => line.trim());

  const combined = (sections[1] || "")
    .trim()
    .split("\n")
    .filter(
      (line) =>
        line.trim() &&
        line.trim().toLowerCase() !== "none"
    );

  return { words, combined };
}

// =========================================================
// TRANSLATION DISPLAY
// =========================================================

function TranslationPanel({
  entry,
}: {
  entry: TextEntry | null;
}) {
  if (!entry) {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
        <BookOpen className="size-8 opacity-40" />

        <p className="max-w-xs text-sm">
          Select a Sanskrit verse to explore its individual
          and combined word meanings.
        </p>
      </div>
    );
  }

  if (!entry.translation) {
    return (
      <div className="flex min-h-64 items-center justify-center text-center text-sm text-muted-foreground">
        No translation available for this verse.
      </div>
    );
  }

  const { words, combined } = parseTranslation(
    entry.translation.translation
  );

  return (
    <div className="space-y-8">
      {/* Selected verse */}
      <div className="border-b pb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Selected Verse
        </p>

        <p
          lang="sa"
          className="whitespace-pre-line text-lg leading-loose"
        >
          {entry.text}
        </p>
      </div>

      {/* Individual word meanings */}
      <div>
        <h3 className="mb-4 text-sm font-semibold">
          Individual Word Meanings
        </h3>

        <div className="space-y-2">
          {words.map((word, index) => {
            const cleaned = word.replace(/^[-•]\s*/, "");
            const separator = cleaned.indexOf("=");

            if (separator === -1) {
              return (
                <p
                  key={index}
                  className="text-sm text-muted-foreground"
                >
                  {cleaned}
                </p>
              );
            }

            const sanskrit = cleaned.slice(0, separator).trim();
            const meaning = cleaned.slice(separator + 1).trim();

            return (
              <div
                key={index}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 rounded-lg border p-3"
              >
                <span
                  lang="sa"
                  className="break-words font-medium"
                >
                  {sanskrit}
                </span>

                <span className="break-words text-sm text-muted-foreground">
                  {meaning}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Combined word meanings */}
      {combined.length > 0 && (
        <div>
          <h3 className="mb-4 text-sm font-semibold">
            Combined Word Meanings
          </h3>

          <div className="space-y-3">
            {combined.map((line, index) => {
              const cleaned = line.replace(/^[-•]\s*/, "");
              const separator = cleaned.indexOf("=");

              if (separator === -1) {
                return (
                  <p
                    key={index}
                    className="text-sm text-muted-foreground"
                  >
                    {cleaned}
                  </p>
                );
              }

              const sanskrit = cleaned
                .slice(0, separator)
                .trim();

              const meaning = cleaned
                .slice(separator + 1)
                .trim();

              return (
                <div
                  key={index}
                  className="rounded-lg bg-muted/50 p-4"
                >
                  <p
                    lang="sa"
                    className="mb-2 font-medium"
                  >
                    {sanskrit}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {meaning}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// READER PAGE
// =========================================================

export default function ReadPage({ params }: Props) {
  const { pageId } = use(params);

  const [page, setPage] = useState<PageContent | null>(null);
  const [bookPages, setBookPages] = useState<BookPage[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =======================================================
  // FETCH PAGE CONTENT + BOOK PAGES
  // =======================================================

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPage() {
      try {
        const response = await fetch(
          apiUrl(`/pages/${pageId}/content`),
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Failed to load page");
        }

        const data: PageContent = await response.json();

        if (controller.signal.aborted) return;

        setPage(data);

        // Fetch all pages for navigation
        const pagesResponse = await fetch(
          apiUrl(`/books/${data.book_id}/pages`),
          { signal: controller.signal }
        );

        if (!pagesResponse.ok) {
          throw new Error("Failed to load page navigation");
        }

        const pagesData = await pagesResponse.json();

        if (controller.signal.aborted) return;

        setBookPages(pagesData.pages);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load reader"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchPage();

    return () => controller.abort();
  }, [pageId]);

  // =======================================================
  // SELECTED VERSE
  // =======================================================

  const selectedEntry =
    page?.content.find(
      (entry) => entry.id === selectedId
    ) || null;

  // =======================================================
  // PAGE NAVIGATION
  // =======================================================

  const currentIndex = bookPages.findIndex(
    (item) => item.id === Number(pageId)
  );

  const previousPage =
    currentIndex > 0
      ? bookPages[currentIndex - 1]
      : null;

  const nextPage =
    currentIndex >= 0 &&
    currentIndex < bookPages.length - 1
      ? bookPages[currentIndex + 1]
      : null;

  // =======================================================
  // LOADING / ERROR
  // =======================================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Loading Sanskrit text...
        </p>
      </main>
    );
  }

  if (error || !page) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5">
        <p role="alert" className="text-destructive">
          {error || "Page not found"}
        </p>

        <Button variant="outline">
          <Link href="/">
            Return to Library
          </Link>
        </Button>
      </main>
    );
  }

  // =======================================================
  // UI
  // =======================================================

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8 md:px-8">
      {/* Top navigation */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <Button variant="ghost" size="sm" >
          <Link href={`/pages/${page.book_id}`}>
            <ArrowLeft className="size-4" />
            All Pages
          </Link>
        </Button>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            देवीभागवतम्
          </p>

          <h1 className="text-lg font-semibold">
            Page {page.page_number}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!previousPage}
            aria-label="Previous page"
          >
            {previousPage ? (
              <Link href={`/read/${previousPage.id}`}>
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            disabled={!nextPage}
            aria-label="Next page"
          >
            {nextPage ? (
              <Link href={`/read/${nextPage.id}`}>
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        </div>
      </header>

      {/* Main reading layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">

        {/* =========================================
            LEFT: SANSKRIT READER
        ========================================= */}

        <section className="min-w-0">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                Original Sanskrit
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Select a verse to explore its meanings
              </p>
            </div>

            <span className="text-xs text-muted-foreground">
              {
                page.content.filter(
                  (entry) => entry.type === "text"
                ).length
              }{" "}
              verses
            </span>
          </div>

          <div className="space-y-5">
            {page.content.map((entry) => {

              // -------------------------------
              // TITLE
              // -------------------------------

              if (entry.type === "title") {
                return (
                  <h3
                    key={entry.id}
                    lang="sa"
                    className="py-6 text-center text-xl font-semibold leading-relaxed"
                  >
                    {entry.text}
                  </h3>
                );
              }

              // -------------------------------
              // SPEAKER
              // -------------------------------

              if (entry.type === "speaker") {
                return (
                  <p
                    key={entry.id}
                    lang="sa"
                    className="py-2 text-center font-medium text-primary"
                  >
                    {entry.text}
                  </p>
                );
              }

              // -------------------------------
              // SHLOKA
              // -------------------------------

              const selected = selectedId === entry.id;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() =>
                    setSelectedId(entry.id)
                  }
                  aria-pressed={selected}
                  className={`w-full rounded-xl border p-5 text-left transition-all duration-200 ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <p
                    lang="sa"
                    className="whitespace-pre-line text-lg leading-[2.2] md:text-xl"
                  >
                    {entry.text}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {entry.translation
                        ? "Word meanings available"
                        : "Translation unavailable"}
                    </span>

                    <ArrowRight
                      className={`size-4 transition-transform ${
                        selected
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* =========================================
            RIGHT: TRANSLATION
        ========================================= */}

        <aside className="min-w-0">
          <div className="lg:sticky lg:top-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Word Meanings
              </h2>

              <p className="mt-1 text-xs text-muted-foreground">
                Literal definitions without interpretation
              </p>
            </div>

            <div className="max-h-none overflow-y-auto rounded-xl border bg-card p-5 md:p-6 lg:max-h-[calc(100vh-10rem)]">
              <TranslationPanel entry={selectedEntry} />
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom navigation */}
      <footer className="mt-16 flex items-center justify-between border-t py-8">
        {previousPage ? (
          <Button variant="outline" >
            <Link href={`/read/${previousPage.id}`}>
              <ChevronLeft className="size-4" />
              Previous
            </Link>
          </Button>
        ) : (
          <div />
        )}

        <span className="text-sm text-muted-foreground">
          Page {page.page_number}
        </span>

        {nextPage ? (
          <Button >
            <Link href={`/read/${nextPage.id}`}>
              Next
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </footer>
    </main>
  );
}
