"use client";
import { useState } from "react";
import { GoogleGenAI, Type } from "@google/genai";
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

      const ai = new GoogleGenAI({
        apiKey: "${process.env.GOOGLE_API}"
      });

      const prompt =
        type === "translate"
          ? `
          You are given a shloka, take each word and translate it dont translate the shloka
          as a whole.
          Context:
${context}`
          : `The user is trying to understand a Sanskrit word or word-part.
Give only a short, direct definition.
If they supplied a derived definition, briefly correct or clarify it if needed.

Context:
${context}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          candidateCount: 1,
       },
      });

      console.log(response.text)
      setResult(response.text?.trim() ?? "");
    } catch (error) {
      console.error(error);
      setResult("Unable to generate feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        className="w-full flex gap-2"
        size="icon"
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
        <div className="text-sm p-3 rounded-md bg-muted">
          {result}
        </div>
      )}
    </div>
  );
}
