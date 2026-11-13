import { NextResponse } from "next/server";
import { isBase64 } from "@/lib/base64";

const endpoint =
  process.env.PHASE_TWO_ENDPOINT ??
  "https://us-central1-frontend-simplified.cloudfunctions.net/skinstricPhaseTwo";
const maxEncodedImageLength = 14_000_000;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("image" in body) ||
    typeof body.image !== "string" ||
    !body.image
  ) {
    return NextResponse.json({ error: "An image encoded as Base64 is required." }, { status: 400 });
  }

  if (body.image.length > maxEncodedImageLength) {
    return NextResponse.json({ error: "This image is too large. Choose an image under 10 MB." }, { status: 413 });
  }
  if (!isBase64(body.image)) {
    return NextResponse.json({ error: "The image must be encoded as Base64." }, { status: 400 });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: body.image }),
      cache: "no-store",
    });
    const result: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "The analysis service could not process this image.", details: result },
        { status: response.status },
      );
    }

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the analysis service. Please try again." },
      { status: 502 },
    );
  }
}
