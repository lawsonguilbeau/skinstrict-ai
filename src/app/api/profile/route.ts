import { NextResponse } from "next/server";
import { validateProfile } from "@/lib/profile";

const endpoint =
  process.env.PHASE_ONE_ENDPOINT ??
  "https://us-central1-frontend-simplified.cloudfunctions.net/skinstricPhaseOne";

export async function POST(request: Request) {
  let profile: unknown;

  try {
    profile = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!profile || typeof profile !== "object" || !("name" in profile) || !("location" in profile)) {
    return NextResponse.json({ error: "Name and location are required." }, { status: 400 });
  }

  const candidate = profile as { name: unknown; location: unknown };
  if (typeof candidate.name !== "string" || typeof candidate.location !== "string") {
    return NextResponse.json({ error: "Name and location must be text." }, { status: 400 });
  }

  const cleanProfile = {
    name: candidate.name.trim(),
    location: candidate.location.trim(),
  };
  const errors = validateProfile(cleanProfile);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: Object.values(errors)[0] }, { status: 400 });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cleanProfile),
      cache: "no-store",
    });
    const body: unknown = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: "The profile service could not save your details.", details: body },
        { status: response.status },
      );
    }

    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the profile service. Please try again." },
      { status: 502 },
    );
  }
}
