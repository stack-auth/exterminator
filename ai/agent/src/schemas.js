import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const Step = z.object({
  index: z.number(),
  action: z.enum([
    "navigate",
    "click",
    "type",
    "scroll",
    "select",
    "hover",
    "wait",
    "other",
  ]),
  description: z.string(),
  element: z.string().nullable(),
  value: z.string().nullable(),
  url: z.string(),
});

const BrowserLog = z.object({
  level: z.enum(["error", "warn", "log", "info"]),
  message: z.string(),
  source: z.string().nullable(),
  timestamp: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Reproduce agent output
// ---------------------------------------------------------------------------

export const ReproduceOutput = z.object({
  reproduced: z.boolean(),
  errorMessage: z.string().nullable(),
  steps: z.array(Step),
  browserLogs: z.array(BrowserLog),
  notes: z.string(),
});

// ---------------------------------------------------------------------------
// Fix agent output
// (Fix is a pure LLM call, not browser-use -- kept here for consistency)
// ---------------------------------------------------------------------------

export const FixOutput = z.object({
  diagnosis: z.string(),
  fixDescription: z.string(),
  changes: z.array(
    z.object({
      file: z.string(),
      originalContent: z.string(),
      updatedContent: z.string(),
    })
  ),
});

// ---------------------------------------------------------------------------
// Validate agent output
// ---------------------------------------------------------------------------

export const ValidateOutput = z.object({
  fixed: z.boolean(),
  verdict: z.enum([
    "resolved",
    "error_persists",
    "regression",
    "partial_fix",
  ]),
  verdictReason: z.string(),
  originalErrorSeen: z.boolean(),
  steps: z.array(Step),
  browserLogs: z.array(BrowserLog),
  newErrors: z.array(
    z.object({
      message: z.string(),
      source: z.string().nullable(),
      appearedAtStep: z.number().nullable(),
    })
  ),
  notes: z.string(),
});
