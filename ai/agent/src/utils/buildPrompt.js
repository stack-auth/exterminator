import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "../prompts");

/**
 * Loads a prompt template from the prompts/ directory and replaces
 * {{VARIABLE_NAME}} placeholders with values from the provided context object.
 *
 * Missing variables in context are left as-is (so the caller can spot them).
 *
 * @param {string} promptName - filename without extension, e.g. "reproduce"
 * @param {Record<string, string>} context - key/value pairs to interpolate
 * @returns {string} the assembled prompt
 */
export function buildPrompt(promptName, context = {}) {
  const filePath = join(PROMPTS_DIR, `${promptName}.md`);
  let template = readFileSync(filePath, "utf-8");

  for (const [key, value] of Object.entries(context)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    template = template.replace(placeholder, value ?? "");
  }

  return template;
}

/**
 * Lists the placeholder variables found in a prompt template.
 * Useful for validating that all required inputs are provided.
 *
 * @param {string} promptName - filename without extension
 * @returns {string[]} array of variable names (without the {{ }} brackets)
 */
export function listPromptVariables(promptName) {
  const filePath = join(PROMPTS_DIR, `${promptName}.md`);
  const template = readFileSync(filePath, "utf-8");
  const matches = [...template.matchAll(/\{\{([A-Z_]+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}
