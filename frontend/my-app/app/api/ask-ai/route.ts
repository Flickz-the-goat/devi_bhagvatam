import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { context, type } = body ?? {};

  if (
    typeof context !== "string" ||
    !context.trim() ||
    (type !== "translate" && type !== "understand")
  ) {
    return Response.json({ error: "Invalid AI request." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API?.trim();
  if (!apiKey) {
    return Response.json({ error: "AI is unavailable." }, { status: 503 });
  }

  const instruction =
    type === "translate"
      ? "Translate each word of the shloka individually. Do not translate it as a whole."
      : "Give a short, direct definition of the Sanskrit word or word-part. Briefly correct or clarify any supplied derived definition if needed.";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: context,
      config: { candidateCount: 1, systemInstruction: instruction },
    });
    const feedback = response.text?.trim();

    if (feedback) {
      return Response.json({ feedback });
    }
  } catch {
    console.error("Gemini content generation failed.");
  }

  return Response.json(
    { error: "Unable to generate feedback." },
    { status: 502 }
  );
}
