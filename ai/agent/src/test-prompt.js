/**
 * Test harness for assembling and previewing prompts locally.
 *
 * Usage:
 *   node src/test-prompt.js reproduce
 *   node src/test-prompt.js fix
 *   node src/test-prompt.js validate
 *
 * Prints the fully-assembled prompt to stdout so you can paste it into an
 * LLM or browser-use session without needing the full infrastructure running.
 */

import { buildPrompt, listPromptVariables } from "./utils/buildPrompt.js";

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------

const STACK_TRACE = `TypeError: Cannot read properties of undefined (reading 'avatar')
    at UserProfile (UserProfile.jsx:24:38)
    at renderWithHooks (react-dom.development.js:14985:18)
    at mountIndeterminateComponent (react-dom.development.js:17811:13)
    at beginWork (react-dom.development.js:19049:16)
    at HTMLUnknownElement.callCallback (react-dom.development.js:3945:14)
    at Object.invokeGuardedCallbackDev (react-dom.development.js:3994:16)
    at invokeGuardedCallback (react-dom.development.js:4056:31)
    at beginWork$1 (react-dom.development.js:19630:7)
    at performUnitOfWork (react-dom.development.js:22448:12)
    at workLoopSync (react-dom.development.js:22424:5)`;

const SOURCE_CODE = `// src/components/UserProfile.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../hooks/useUser';

export default function UserProfile() {
  const { userId } = useParams();
  const { user, loading } = useUser(userId);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="profile">
      <img src={user.avatar} alt={user.name} />
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}

// src/hooks/useUser.js
import { useState, useEffect } from 'react';

export function useUser(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(\`/api/users/\${userId}\`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, [userId]);

  return { user, loading };
}`;

const APP_URL = "https://framework-purpose-previously-recognize.trycloudflare.com";

const APP_DESCRIPTION =
  "A user directory app. The home page shows a list of users (IDs 1, 2, 3, and 42). Clicking 'View Profile' navigates to that user's profile page via a URL hash like #profile/42. User 42 has no data defined, which triggers a crash when the profile page tries to render it.";

const REPRO_STEPS = JSON.stringify(
  [
    {
      index: 1,
      action: "navigate",
      description: "Navigate to the app homepage",
      element: null,
      value: null,
      url: "http://localhost:3000",
    },
    {
      index: 2,
      action: "click",
      description: "Click on the 'View Profile' link for user ID 42",
      element: "View Profile link in user list",
      value: null,
      url: "http://localhost:3000",
    },
    {
      index: 3,
      action: "navigate",
      description: "Page navigated to user profile route",
      element: null,
      value: null,
      url: "http://localhost:3000/profile/42",
    },
  ],
  null,
  2
);

const BROWSER_LOGS = JSON.stringify(
  [
    {
      level: "log",
      message: "Fetching user data for id: 42",
      source: "useUser.js:9",
      timestamp: "+120ms",
    },
    {
      level: "error",
      message:
        "TypeError: Cannot read properties of undefined (reading 'avatar')",
      source: "UserProfile.jsx:24",
      timestamp: "+125ms",
    },
    {
      level: "error",
      message: "The above error occurred in the <UserProfile> component",
      source: "react-dom.development.js",
      timestamp: "+126ms",
    },
  ],
  null,
  2
);

const FIX_DESCRIPTION =
  "Added a null check for the user object before rendering. When user is null (not yet loaded or failed to load), the component now renders a fallback message instead of attempting to access properties on undefined.";

// ---------------------------------------------------------------------------
// Previous attempt fixture (used to test retry logic in the fix prompt)
// ---------------------------------------------------------------------------

const PREVIOUS_ATTEMPTS = `## Previous Fix Attempts

This is attempt #2. The previous fix did not resolve the error. Here is what was tried:

### Attempt 1
**Diagnosis:** Tried adding an early return when user is null.
**What was changed:** Added \`if (!user) return null;\` before the return statement.
**What happened during validation:** The original error is gone, but the page now shows a blank screen when loading fails instead of an error message. A new console warning appeared: "Cannot update a component from inside the function body of a different component."

Take a different approach. The blank screen on error is not acceptable -- the user needs feedback.`;

// ---------------------------------------------------------------------------
// Assemble and print
// ---------------------------------------------------------------------------

const promptName = process.argv[2];
const validPrompts = ["reproduce", "fix", "validate"];

if (!promptName || !validPrompts.includes(promptName)) {
  console.error(`Usage: node src/test-prompt.js <${validPrompts.join("|")}>`);
  process.exit(1);
}

const contexts = {
  reproduce: {
    APP_URL,
    APP_DESCRIPTION,
    STACK_TRACE,
    SOURCE_CODE,
  },
  fix: {
    STACK_TRACE,
    BROWSER_LOGS,
    REPRO_STEPS,
    SOURCE_CODE,
    // Swap between empty string and PREVIOUS_ATTEMPTS to test retry path:
    PREVIOUS_ATTEMPTS: "",
  },
  validate: {
    APP_URL,
    ORIGINAL_STACK_TRACE: STACK_TRACE,
    REPRO_STEPS,
    FIX_DESCRIPTION,
  },
};

const vars = listPromptVariables(promptName);
const missing = vars.filter((v) => !(v in contexts[promptName]));
if (missing.length > 0) {
  console.warn(
    `⚠ Warning: the following variables have no fixture value and will remain as placeholders: ${missing.join(", ")}`
  );
}

const assembled = buildPrompt(promptName, contexts[promptName]);

console.log("=".repeat(72));
console.log(`PROMPT: ${promptName.toUpperCase()}`);
console.log("=".repeat(72));
console.log(assembled);
console.log("=".repeat(72));
console.log(`Total length: ${assembled.length} chars`);
