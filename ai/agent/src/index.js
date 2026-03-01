import { buildPrompt, listPromptVariables } from "./utils/buildPrompt.js";

console.log("Exterminator agent running");
console.log("Available prompts:", ["reproduce", "fix", "validate"].join(", "));

// Quick sanity check: list variables for each prompt
for (const name of ["reproduce", "fix", "validate"]) {
  const vars = listPromptVariables(name);
  console.log(`  ${name} requires: ${vars.join(", ")}`);
}
