"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Stars, Loader2 } from "lucide-react";

type AskAIType = "translate" | "understand";

interface AIResult {
  feedback: string;
}

export default function AskAI({
  context,
  type,
}: {
  context: string;
  type: AskAIType;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleAi = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, type }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate feedback.");
      }

      const { feedback }: AIResult = await response.json();
      setResult(feedback);
    } catch {
      setResult("Unable to generate feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        className="min-h-11 w-full gap-2"
        disabled={loading}
        onClick={handleAi}
        variant={"outline"}
      >
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Stars />
        )}
        Ask AI
      </Button>

      {result && (
        <div className="rounded-md bg-muted p-3 text-sm wrap-anywhere">
          {result}
        </div>
      )}
    </div>
  );
}
