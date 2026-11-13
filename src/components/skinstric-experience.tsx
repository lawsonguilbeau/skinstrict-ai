"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import {
  FiArrowLeft,
  FiArrowRight,
  FiArrowUpRight,
  FiAperture,
  FiCamera,
  FiCheck,
  FiImage,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import {
  formatScore,
  parseAnalysisResponse,
  rankAllScores,
  rankScores,
  type AnalysisResponse,
  type Attribute,
} from "@/lib/analysis";
import { validateProfile, validateProfileField, type Profile } from "@/lib/profile";

type Stage =
  | "intro"
  | "name"
  | "location"
  | "profile-processing"
  | "profile-complete"
  | "upload"
  | "camera"
  | "processing"
  | "analysis"
  | "demographics"
  | "summary";

const profileStorageKey = "skinstric-profile";
const maxFileSize = 10 * 1024 * 1024;
const attributes: Attribute[] = ["race", "age", "gender"];

function getErrorMessage(value: unknown, fallback: string): string {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

async function submitProfile(profile: Profile, signal: AbortSignal) {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
    signal,
  });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(result, "Could not save your details."));
}

function waitForMinimumProcessingTime(startedAt: number, signal: AbortSignal) {
  const remaining = 2000 - (Date.now() - startedAt);
  if (remaining <= 0 || signal.aborted) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, remaining);
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function submitImage(image: string): Promise<AnalysisResponse> {
  const response = await fetch("/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(result, "Could not analyze this image."));
  return parseAnalysisResponse(result);
}

async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the selected image."));
    };
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Could not encode the selected image.");
  return dataUrl.slice(separator + 1);
}

export function SkinstricExperience() {
  const [stage, setStage] = useState<Stage>("intro");
  const [profile, setProfile] = useState<Profile>({ name: "", location: "" });
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof Profile, string>>>({});
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [actual, setActual] = useState<Record<Attribute, string>>({
    race: "",
    age: "",
    gender: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAttribute, setActiveAttribute] = useState<Attribute>("race");
  const [profileAnimationElapsed, setProfileAnimationElapsed] = useState(0);
  const [heroDestination, setHeroDestination] = useState<"left" | "right" | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLDivElement>(null);
  const profileRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const savedProfile = window.localStorage.getItem(profileStorageKey);
      if (savedProfile) {
        const parsed: unknown = JSON.parse(savedProfile);
        if (
          parsed &&
          typeof parsed === "object" &&
          "name" in parsed &&
          "location" in parsed &&
          typeof parsed.name === "string" &&
          typeof parsed.location === "string"
        ) {
          // Hydrate the client-only profile after the server-rendered initial paint.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProfile({ name: parsed.name, location: parsed.location });
        }
      }
    } catch {
      window.localStorage.removeItem(profileStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!contentRef.current) return;
    const targets = contentRef.current.querySelectorAll("[data-animate]");
    if (targets.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(targets, { clearProps: "all" });
      return;
    }
    const tween = gsap.fromTo(
      targets,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.55, stagger: 0.07, ease: "power2.out" },
    );
    return () => {
      tween.kill();
    };
  }, [stage]);

  const startFlow = useCallback(() => {
    setError("");
    setProfileErrors({});
    setHeroDestination(null);
    setStage("name");
  }, []);

  const handleNameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nameError = validateProfileField("name", profile.name);
    if (nameError) {
      setProfileErrors({ ...profileErrors, name: nameError });
      return;
    }

    setProfileErrors({ ...profileErrors, name: undefined });
    setStage("location");
  };

  const moveHeroTitle = useCallback((destination: "left" | "right" | null) => {
    const heroTitle = heroTitleRef.current;
    if (!heroTitle) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHeroDestination(null);
      gsap.set(heroTitle, { x: 0 });
      heroTitle.style.textAlign = "center";
      return;
    }

    if (!destination) {
      setHeroDestination(null);
      heroTitle.style.textAlign = "center";
      gsap.to(heroTitle, { x: 0, duration: 0.72, ease: "power3.inOut", overwrite: "auto" });
      return;
    }

    if (window.matchMedia("(max-width: 760px)").matches) {
      setHeroDestination(null);
      return;
    }

    setHeroDestination(destination);
    const bounds = heroTitle.getBoundingClientRect();
    const currentX = Number(gsap.getProperty(heroTitle, "x")) || 0;
    const originalLeft = bounds.left - currentX;
    const targetLeft =
      destination === "left" ? 32 : window.innerWidth - bounds.width - 32;

    heroTitle.style.textAlign = destination === "left" ? "left" : "right";
    gsap.to(heroTitle, {
      x: targetLeft - originalLeft,
      duration: 0.82,
      ease: "power3.inOut",
      overwrite: "auto",
    });
  }, []);

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateProfile(profile);
    setProfileErrors(validationErrors);
    setError("");
    if (Object.keys(validationErrors).length > 0) return;

    const controller = new AbortController();
    const processingStartedAt = Date.now();
    setProfileAnimationElapsed(0);
    profileRequestRef.current = controller;
    setLoading(true);
    setStage("profile-processing");
    try {
      const cleanProfile = { name: profile.name.trim(), location: profile.location.trim() };
      await submitProfile(cleanProfile, controller.signal);
      await waitForMinimumProcessingTime(processingStartedAt, controller.signal);
      if (controller.signal.aborted) return;
      window.localStorage.setItem(profileStorageKey, JSON.stringify(cleanProfile));
      setProfile(cleanProfile);
      setProfileAnimationElapsed(Date.now() - processingStartedAt);
      setStage("profile-complete");
    } catch (submitError) {
      if (controller.signal.aborted) return;
      await waitForMinimumProcessingTime(processingStartedAt, controller.signal);
      if (controller.signal.aborted) return;
      setError(submitError instanceof Error ? submitError.message : "Could not save your details.");
      setStage("location");
    } finally {
      if (profileRequestRef.current === controller) profileRequestRef.current = null;
      setLoading(false);
    }
  };

  const cancelProfileSubmission = () => {
    profileRequestRef.current?.abort();
    profileRequestRef.current = null;
    setLoading(false);
    setError("");
    setStage("location");
  };

  const goHome = () => {
    profileRequestRef.current?.abort();
    profileRequestRef.current = null;
    setLoading(false);
    setError("");
    setStage("intro");
  };

  const handleFile = async (selected: File | undefined) => {
    setError("");
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      setError("Choose an image file to continue.");
      return;
    }
    if (selected.size > maxFileSize) {
      setError("This image is too large. Choose an image under 10 MB.");
      return;
    }

    setStage("processing");
    setLoading(true);
    try {
      await handleImageSubmit(await fileToBase64(selected));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Could not read the selected image.");
      setStage("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleImageSubmit = async (image: string, errorStage: Stage = "upload") => {
    setLoading(true);
    setError("");
    setStage("processing");
    try {
      const result = await submitImage(image);
      const defaults = Object.fromEntries(
        attributes.map((attribute) => [attribute, rankScores(result.data[attribute])[0]?.label ?? ""]),
      ) as Record<Attribute, string>;
      setAnalysis(result);
      setActual(defaults);
      setStage("analysis");
      setActiveAttribute("race");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not analyze this image.");
      setStage(errorStage);
    } finally {
      setLoading(false);
    }
  };

  const landingMode =
    stage === "intro" ||
    stage === "name" ||
    stage === "location" ||
    stage === "profile-processing" ||
    stage === "profile-complete" ||
    stage === "upload";
  const analysisMode =
    stage === "analysis" || stage === "demographics" || stage === "summary";
  const cameraMode = stage === "camera";
  const compactHeaderMode = landingMode || analysisMode || cameraMode;

  return (
    <main
      className={`app-shell min-h-screen ${landingMode ? "home-mode" : ""} ${analysisMode ? "analysis-mode" : ""} ${stage === "processing" ? "processing-mode" : ""} ${cameraMode ? "camera-mode" : ""}`}
    >
      {stage !== "processing" && (
        <header className={`topbar ${compactHeaderMode ? "landing-topbar" : ""} ${cameraMode ? "camera-topbar" : ""}`}>
          {cameraMode ? (
            <div className="landing-brand">
              <button className="wordmark" onClick={() => setStage("intro")} aria-label="Skinstric home">
                SKINSTRIC
              </button>
              <button className="landing-intro" onClick={goHome}>
                [ <span>INTRO</span> ]
              </button>
            </div>
          ) : compactHeaderMode ? (
          <>
            <div className="landing-brand">
              <button className="wordmark" onClick={goHome} aria-label="Skinstric home">
                SKINSTRIC
              </button>
              <button className="landing-intro" onClick={goHome}>
                [ <span>INTRO</span> ]
              </button>
            </div>
            {(stage === "intro" || stage === "profile-complete" || analysisMode) && (
              <button className="enter-code-button" type="button" disabled>ENTER CODE</button>
            )}
          </>
          ) : (
            <>
              <button className="wordmark" onClick={goHome} aria-label="Skinstric home">
                SKINSTRIC<span>®</span>
              </button>
              <div className="topbar-right">
                <span className="topbar-note">AI SKIN ANALYSIS</span>
                <span className="topbar-divider" />
                <button className="intro-link" onClick={goHome}>
                  INTRO <FiArrowUpRight aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </header>
      )}

      <section className="workspace">
        <div className={`stage-content stage-${stage}`} ref={contentRef}>
          {stage === "intro" && (
            <section className="intro-screen">
              <div className={`hero-diamond hero-diamond-left hero-diamond-outer ${heroDestination === "left" ? "is-hidden" : ""}`} aria-hidden="true" />
              <div className={`hero-diamond hero-diamond-left hero-diamond-inner ${heroDestination === "left" ? "is-hidden" : ""}`} aria-hidden="true" />
              <div className={`hero-diamond hero-diamond-right hero-diamond-outer ${heroDestination === "right" ? "is-hidden" : ""}`} aria-hidden="true" />
              <div className={`hero-diamond hero-diamond-right hero-diamond-inner ${heroDestination === "right" ? "is-hidden" : ""}`} aria-hidden="true" />
              <div className="hero-title" ref={heroTitleRef} data-animate>
                <h1>Sophisticated<br />skincare</h1>
              </div>
              <button
                className={`hero-navigation hero-navigation-left ${heroDestination === "left" ? "is-hidden" : ""}`}
                onClick={startFlow}
                onPointerEnter={() => moveHeroTitle("right")}
                onPointerLeave={() => moveHeroTitle(null)}
                onFocus={() => moveHeroTitle("right")}
                onBlur={() => moveHeroTitle(null)}
              >
                <span className="hero-arrow-diamond"><FiArrowLeft aria-hidden="true" /></span>
                <span>DISCOVER A.I.</span>
              </button>
              <button
                className={`hero-navigation hero-navigation-right ${heroDestination === "right" ? "is-hidden" : ""}`}
                onClick={startFlow}
                onPointerEnter={() => moveHeroTitle("left")}
                onPointerLeave={() => moveHeroTitle(null)}
                onFocus={() => moveHeroTitle("left")}
                onBlur={() => moveHeroTitle(null)}
              >
                <span>TAKE TEST</span>
                <span className="hero-arrow-diamond"><FiArrowRight aria-hidden="true" /></span>
              </button>
              <p className="hero-description">
                SKINSTRIC DEVELOPED AN A.I. THAT CREATES<br />
                A HIGHLY-PERSONALISED ROUTINE TAILORED TO<br />
                WHAT YOUR SKIN NEEDS.
              </p>
            </section>
          )}

          {stage === "name" && (
            <IdentityStep
              inputId="name"
              prompt="Introduce Yourself"
              value={profile.name}
              error={profileErrors.name}
              onChange={(name) => {
                setProfile({ ...profile, name });
                setProfileErrors({ ...profileErrors, name: undefined });
              }}
              onBack={() => setStage("intro")}
              onSubmit={handleNameSubmit}
            />
          )}

          {stage === "location" && (
            <IdentityStep
              inputId="location"
              prompt="Where are you from?"
              value={profile.location}
              error={profileErrors.location || error}
              loading={loading}
              onChange={(location) => {
                setProfile({ ...profile, location });
                setProfileErrors({ ...profileErrors, location: undefined });
                setError("");
              }}
              onBack={() => { setError(""); setStage("name"); }}
              onSubmit={handleProfileSubmit}
            />
          )}

          {stage === "profile-processing" && (
            <ProfileSubmissionProcessing onBack={cancelProfileSubmission} />
          )}

          {stage === "profile-complete" && (
            <ProfileSubmissionComplete
              animationElapsed={profileAnimationElapsed}
              onBack={() => setStage("location")}
              onProceed={() => setStage("upload")}
            />
          )}

          {stage === "upload" && (
            <SourceSelection
              error={error}
              onBack={() => { setError(""); setStage("location"); }}
              onCamera={() => { setError(""); setStage("camera"); }}
              onFile={handleFile}
            />
          )}

          {stage === "camera" && (
            <CameraPanel
              error={error}
              loading={loading}
              onBack={() => { setError(""); setStage("upload"); }}
              onCapture={(image) => handleImageSubmit(image, "camera")}
            />
          )}

          {stage === "processing" && <ProcessingScreen />}

          {stage === "analysis" && analysis && (
            <AnalysisOverview
              onBack={() => setStage("upload")}
              onDemographics={() => { setActiveAttribute("race"); setStage("demographics"); }}
              onGetSummary={() => { setActiveAttribute("race"); setStage("demographics"); }}
            />
          )}

          {stage === "demographics" && analysis && (
            <DemographicsDetails
              analysis={analysis}
              actual={actual}
              activeAttribute={activeAttribute}
              onSelectAttribute={setActiveAttribute}
              onSelectActual={(attribute, value) => setActual({ ...actual, [attribute]: value })}
              onReset={() => {
                setActual(Object.fromEntries(
                  attributes.map((attribute) => [attribute, rankScores(analysis.data[attribute])[0]?.label ?? ""]),
                ) as Record<Attribute, string>);
              }}
              onGetSummary={() => setStage("summary")}
            />
          )}

          {stage === "summary" && analysis && (
            <ResultsSummary
              analysis={analysis}
              actual={actual}
              onBack={() => setStage("analysis")}
              onNewScan={() => { setError(""); setAnalysis(null); setStage("upload"); }}
            />
          )}
        </div>
      </section>

    </main>
  );
}

function IdentityStep({
  inputId,
  prompt,
  value,
  error,
  loading = false,
  onChange,
  onBack,
  onSubmit,
}: {
  inputId: "name" | "location";
  prompt: string;
  value: string;
  error?: string;
  loading?: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <section className="identity-screen">
      <p className="identity-kicker" data-animate>TO START ANALYSIS</p>
      <div className="identity-diamond identity-diamond-outer" aria-hidden="true" />
      <div className="identity-diamond identity-diamond-middle" aria-hidden="true" />
      <div className="identity-diamond identity-diamond-inner" aria-hidden="true" />
      <form
        className="identity-form"
        id={`${inputId}-form`}
        onSubmit={onSubmit}
        noValidate
        data-animate
      >
        <label className="identity-prompt" htmlFor={inputId}>CLICK TO TYPE</label>
        <input
          id={inputId}
          className={`identity-input identity-input-${inputId}`}
          type="text"
          autoComplete={inputId === "name" ? "name" : "address-level2"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={prompt}
          aria-label={prompt}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        {error && <span className="identity-error" id={`${inputId}-error`} role="alert">{error}</span>}
      </form>
      <button className="identity-back" type="button" onClick={onBack}>
        <span className="identity-back-diamond"><FiArrowLeft aria-hidden="true" /></span>
        <span>BACK</span>
      </button>
      <button
        className="identity-proceed"
        type="submit"
        form={`${inputId}-form`}
        disabled={loading}
      >
        <span>{loading ? "SAVING..." : "CONTINUE"}</span>
        <span className="identity-proceed-diamond"><FiArrowRight aria-hidden="true" /></span>
      </button>
    </section>
  );
}

function ProfileTransitionArtwork({
  animated = false,
  animationElapsed = 0,
}: {
  animated?: boolean;
  animationElapsed?: number;
}) {
  const animationDelay = animationElapsed > 0 ? `-${animationElapsed}ms` : "0ms";
  return (
    <div className={`profile-transition-artwork ${animated ? "is-animated" : ""}`} aria-hidden="true">
      <span className="profile-transition-diamond profile-transition-diamond-outer" style={{ animationDelay }} />
      <span className="profile-transition-diamond profile-transition-diamond-middle" style={{ animationDelay }} />
      <span className="profile-transition-diamond profile-transition-diamond-inner" style={{ animationDelay }} />
    </div>
  );
}

function ProfileSubmissionProcessing({ onBack }: { onBack: () => void }) {
  return (
    <section className="profile-transition-screen profile-processing-screen" role="status" aria-live="polite">
      <p className="profile-transition-kicker">TO START ANALYSIS</p>
      <ProfileTransitionArtwork animated />
      <div className="profile-transition-copy">
        <p>Processing submission</p>
        <span className="profile-submission-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <button className="identity-back profile-transition-back" type="button" onClick={onBack}>
        <span className="identity-back-diamond"><FiArrowLeft aria-hidden="true" /></span>
        <span>BACK</span>
      </button>
    </section>
  );
}

function ProfileSubmissionComplete({
  animationElapsed,
  onBack,
  onProceed,
}: {
  animationElapsed: number;
  onBack: () => void;
  onProceed: () => void;
}) {
  return (
    <section className="profile-transition-screen profile-complete-screen">
      <p className="profile-transition-kicker">TO START ANALYSIS</p>
      <ProfileTransitionArtwork animated animationElapsed={animationElapsed} />
      <div className="profile-transition-copy">
        <p>Thank you!</p>
        <span>Proceed for the next step</span>
      </div>
      <button className="identity-back profile-transition-back" type="button" onClick={onBack}>
        <span className="identity-back-diamond"><FiArrowLeft aria-hidden="true" /></span>
        <span>BACK</span>
      </button>
      <button className="identity-proceed profile-transition-proceed" type="button" onClick={onProceed}>
        <span>PROCEED</span>
        <span className="identity-proceed-diamond"><FiArrowRight aria-hidden="true" /></span>
      </button>
    </section>
  );
}

function SourceSelection({
  error,
  onBack,
  onCamera,
  onFile,
}: {
  error: string;
  onBack: () => void;
  onCamera: () => void;
  onFile: (file: File | undefined) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="source-selection">
      <div className="source-heading">
        <p className="eyebrow">TO START ANALYSIS</p>
        <h1>ALLOW A.I. TO SCAN YOUR FACE</h1>
      </div>
      <div className="source-choices">
        <div className="source-option source-camera-option">
          <div className="source-diamond source-diamond-outer" aria-hidden="true" />
          <div className="source-diamond source-diamond-inner" aria-hidden="true" />
          <button
            className="source-option-button"
            type="button"
            onClick={onCamera}
            aria-label="Allow A.I. to scan your face with the camera"
          >
            <span className="source-icon source-camera-icon"><FiAperture aria-hidden="true" /></span>
            <span className="source-callout source-camera-callout">ALLOW A.I.<br />TO SCAN YOUR FACE</span>
          </button>
        </div>
        <div className="source-option source-gallery-option">
          <div className="source-diamond source-diamond-outer" aria-hidden="true" />
          <div className="source-diamond source-diamond-inner" aria-hidden="true" />
          <button
            className="source-option-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Allow A.I. to access gallery and select a photo"
          >
            <span className="source-icon source-gallery-icon"><FiImage aria-hidden="true" /></span>
            <span className="source-callout source-gallery-callout">ALLOW A.I.<br />TO ACCESS GALLERY</span>
          </button>
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const selected = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void onFile(selected);
            }}
          />
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <button className="identity-back source-back" type="button" onClick={onBack}>
        <span className="identity-back-diamond"><FiArrowLeft aria-hidden="true" /></span>
        <span>BACK</span>
      </button>
    </section>
  );
}

function ProcessingScreen() {
  return (
    <section className="processing-screen" aria-live="polite">
      <p className="processing-kicker">PREPARING YOUR ANALYSIS</p>
      <div className="processing-orbit" aria-hidden="true">
        <span className="processing-diamond processing-diamond-outer" />
        <span className="processing-diamond processing-diamond-middle" />
        <span className="processing-diamond processing-diamond-inner" />
        <span className="processing-center"><i /><i /><i /></span>
      </div>
      <p className="processing-caption">PLEASE WAIT WHILE WE PROCESS YOUR IMAGE</p>
    </section>
  );
}

function AnalysisOverview({
  onBack,
  onDemographics,
  onGetSummary,
}: {
  onBack: () => void;
  onDemographics: () => void;
  onGetSummary: () => void;
}) {
  const categories = [
    { title: "DEMOGRAPHICS", available: true, onClick: onDemographics },
    { title: "SKIN TYPE DETAILS", available: false },
    { title: "COSMETIC CONCERNS", available: false },
    { title: "WEATHER", available: false },
  ];

  return (
    <section className="analysis-overview">
      <div className="analysis-overview-heading">
        <p className="eyebrow">A.I. ANALYSIS</p>
        <h1 className="visually-hidden">Analysis overview</h1>
        <p>A.I. HAS ESTIMATED THE FOLLOWING.<br />FIX ESTIMATED INFORMATION IF NEEDED.</p>
      </div>
      <div className="analysis-categories">
        {categories.map((category) => (
          <button
            key={category.title}
            className={`analysis-category ${category.available ? "analysis-category-available" : "analysis-category-unavailable"}`}
            type="button"
            disabled={!category.available}
            onClick={category.onClick}
          >
            <span className="analysis-category-title">{category.title}</span>
          </button>
        ))}
      </div>
      <div className="analysis-overview-actions">
        <button className="identity-back" type="button" onClick={onBack}>
          <span className="identity-back-diamond"><FiArrowLeft aria-hidden="true" /></span>
          <span>BACK</span>
        </button>
        <button className="analysis-next-button" type="button" onClick={onGetSummary}>
          <span>GET SUMMARY</span>
          <span className="identity-proceed-diamond"><FiArrowRight aria-hidden="true" /></span>
        </button>
      </div>
    </section>
  );
}

function DemographicsDetails({
  analysis,
  actual,
  activeAttribute,
  onSelectAttribute,
  onSelectActual,
  onReset,
  onGetSummary,
}: {
  analysis: AnalysisResponse;
  actual: Record<Attribute, string>;
  activeAttribute: Attribute;
  onSelectAttribute: (attribute: Attribute) => void;
  onSelectActual: (attribute: Attribute, value: string) => void;
  onReset: () => void;
  onGetSummary: () => void;
}) {
  const ranked = rankAllScores(analysis.data[activeAttribute]);
  const confidence = analysis.data[activeAttribute][actual[activeAttribute]] ?? 0;
  const title = activeAttribute === "gender" ? "SEX" : activeAttribute.toUpperCase();

  return (
    <section className="demographics-screen">
      <div className="demographics-heading">
        <p className="eyebrow">A.I. ANALYSIS</p>
        <h1>DEMOGRAPHICS</h1>
        <p>PREDICTED RACE &amp; AGE</p>
      </div>
      <div className="demographics-layout">
        <nav className="demographics-nav" aria-label="Demographic attributes">
          {attributes.map((attribute) => (
            <button
              key={attribute}
              type="button"
              className={`demographics-nav-item ${activeAttribute === attribute ? "is-active" : ""}`}
              onClick={() => onSelectAttribute(attribute)}
              aria-current={activeAttribute === attribute ? "true" : undefined}
              aria-label={`${attribute === "gender" ? "Sex" : attribute.toUpperCase()} estimate: ${actual[attribute] || "not selected"}`}
            >
              <span>{attribute === "gender" ? "SEX" : attribute.toUpperCase()}</span>
            </button>
          ))}
        </nav>

        <div className="demographics-profile">
          <div className="demographics-profile-copy">
            <span>YOUR {title}</span>
            <strong>{actual[activeAttribute] || "—"}</strong>
            <p>Review the A.I. estimate and select the option that best describes you.</p>
          </div>
          <div className="demographics-ring-wrap" aria-label={`${formatScore(confidence * 100)} percent estimated confidence`}>
            <div
              className="demographics-ring"
              style={{ background: `conic-gradient(#292929 ${Math.min(confidence * 100, 100)}%, #e5e5e5 0)` }}
            >
              <span>{formatScore(confidence * 100)}<small>%</small></span>
            </div>
          </div>
        </div>

        <div className="demographics-scores">
          <div className="demographics-scores-heading">
            <span>{title}</span>
            <span>A.I. CONFIDENCE</span>
          </div>
          <div className="demographics-score-list">
            {ranked.map((result) => (
              <button
                type="button"
                key={result.label}
                className={`demographics-score ${actual[activeAttribute] === result.label ? "is-selected" : ""}`}
                onClick={() => onSelectActual(activeAttribute, result.label)}
              >
                <span>{result.label}</span>
                <strong>{formatScore(result.score * 100)}%</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="demographics-actions">
        <button className="text-button" type="button" onClick={onReset}>RESET ESTIMATES</button>
        <button className="text-button" type="button" onClick={onGetSummary}>GET SUMMARY</button>
      </div>
    </section>
  );
}

function ResultsSummary({
  analysis,
  actual,
  onBack,
  onNewScan,
}: {
  analysis: AnalysisResponse;
  actual: Record<Attribute, string>;
  onBack: () => void;
  onNewScan: () => void;
}) {
  return (
    <section className="results-screen">
      <div className="results-heading">
        <div>
          <p className="eyebrow">A.I. ANALYSIS · SUMMARY</p>
          <h1>Your scan <i>summary.</i></h1>
          <p>These are simulated estimates, not medical findings. Estimates can be corrected in demographics.</p>
        </div>
        <button className="text-button new-scan" type="button" onClick={onNewScan}>
          <FiRefreshCw aria-hidden="true" /> NEW SCAN
        </button>
      </div>
      <div className="results-layout">
        <div className="results-list">
          {attributes.map((attribute) => (
            <section className="result-category" key={attribute}>
              <div className="category-head">
                <span>{attribute === "gender" ? "SEX" : attribute}</span>
                <strong>ACTUAL: {actual[attribute] || "—"}</strong>
              </div>
              <div className="score-list">
                {rankScores(analysis.data[attribute]).map((result) => (
                  <div className={`score-row ${actual[attribute] === result.label ? "is-selected" : ""}`} key={result.label}>
                    <span className="score-label">{result.label}</span>
                    <span className="score-bar"><i style={{ width: `${Math.min(result.score * 100, 100)}%` }} /></span>
                    <span className="score-value">{formatScore(result.score)}</span>
                    {actual[attribute] === result.label && <FiCheck className="score-check" aria-label="Selected actual attribute" />}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="actual-card">
          <span className="actual-kicker">SCAN STATUS</span>
          <span className="actual-value">COMPLETE</span>
          <span className="actual-caption">Your demographic estimates are ready.</span>
          <div className="actual-divider" />
          <p>This experience is a prototype. Results are illustrative and should not be used to make health decisions.</p>
          <span className="actual-mark">S<span>®</span></span>
        </aside>
      </div>
      <div className="results-footer">
        <button className="text-button" type="button" onClick={onBack}>
          <FiArrowLeft aria-hidden="true" /> BACK TO ANALYSIS
        </button>
        <span>{analysis.message}</span>
      </div>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="error-banner" role="alert">
      <FiX aria-hidden="true" /> {message}
    </p>
  );
}

function CameraPanel({
  error,
  loading,
  onBack,
  onCapture,
}: {
  error: string;
  loading: boolean;
  onBack: () => void;
  onCapture: (image: string) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [ready, setReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<{ image: string; preview: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not available in this browser.");
        }
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {
            if (active) setCameraError("Could not start the camera preview. Check your browser settings and try again.");
          });
        }
      })
      .catch((cameraAccessError: unknown) => {
        if (active) {
          setCameraError(
            cameraAccessError instanceof Error && cameraAccessError.message === "Camera access is not available in this browser."
              ? cameraAccessError.message
              : "Camera permission was denied or no camera was found. Check your browser settings and try again.",
          );
        }
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("The camera is still starting. Please try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture an image from this camera.");
      return;
    }
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setCapturedPhoto({ image: dataUrl.slice(dataUrl.indexOf(",") + 1), preview: dataUrl });
  };

  const usePhoto = () => {
    if (!capturedPhoto) return;
    void onCapture(capturedPhoto.image);
  };

  return (
    <section className="camera-screen">
      <div className="camera-layout">
        <div className="camera-frame">
          <video
            ref={videoRef}
            className={`camera-video ${ready ? "is-ready" : ""} ${capturedPhoto ? "is-hidden" : ""}`}
            autoPlay
            playsInline
            muted
            aria-label="Live camera preview"
            onLoadedData={() => setReady(true)}
          />
          {capturedPhoto && (
            <Image
              className="camera-captured-photo"
              src={capturedPhoto.preview}
              alt="Preview of your captured photo"
              fill
              sizes="100vw"
              unoptimized
            />
          )}
          {!ready && !cameraError && (
            <div className="camera-setup" aria-live="polite">
              <div className="camera-setup-mark" aria-hidden="true">
                <span className="camera-setup-diamond camera-setup-diamond-outer" />
                <span className="camera-setup-diamond camera-setup-diamond-middle" />
                <span className="camera-setup-diamond camera-setup-diamond-inner" />
                <FiAperture />
              </div>
              <p>SETTING UP CAMERA ...</p>
            </div>
          )}
        </div>
        {cameraError && !ready && (
          <div className="camera-failure" role="alert">
            <p className="eyebrow">CAMERA ACCESS REQUIRED</p>
            <p>{cameraError}</p>
            <button className="text-button" type="button" onClick={onBack}>
              <FiArrowLeft aria-hidden="true" /> BACK
            </button>
          </div>
        )}
        <div className="camera-side">
          {!capturedPhoto && (
            <div className="camera-instructions">
              <p className="camera-instructions-heading">TO GET BETTER RESULTS MAKE SURE TO HAVE</p>
              <div className="camera-guideline-list">
                <span>NEUTRAL EXPRESSION</span>
                <span>FRONTAL POSE</span>
                <span>ADEQUATE LIGHTING</span>
              </div>
            </div>
          )}
          {error && <ErrorBanner message={error} />}
          <p className="camera-notice">Your photo is used for this scan only and is not saved in this browser.</p>
          {capturedPhoto ? (
            <div className="camera-review-controls">
              <p>Preview</p>
              <div className="camera-review-actions">
                <button type="button" className="camera-retake-button" onClick={() => setCapturedPhoto(null)}>
                  Retake
                </button>
                <button type="button" className="camera-use-button" onClick={usePhoto} disabled={loading}>
                  Use This Photo
                </button>
              </div>
            </div>
          ) : (
            <button className="capture-button" type="button" onClick={capture} disabled={!ready || loading || Boolean(cameraError)}>
              <span>{loading ? "ANALYZING..." : "TAKE PICTURE"}</span>
              <span className="capture-button-circle"><FiCamera aria-hidden="true" /></span>
            </button>
          )}
        </div>
      </div>
      <button className="identity-back camera-back" type="button" onClick={onBack} aria-label="Go back">
        <span className="identity-back-diamond"><FiArrowLeft aria-hidden="true" /></span>
      </button>
    </section>
  );
}

