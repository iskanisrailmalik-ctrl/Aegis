/**
 * Rule Registry versioning system (Main plan Section 4).
 *
 * The Bank Rule Registry and Verified Sender Registry are versioned datasets
 * that can be updated without an app release. This module handles:
 * - Version tracking (stored in Settings)
 * - Export current registry for sharing
 * - Import/merge updated rules from a JSON bundle
 * - Version comparison and patch application
 */

import { db } from "@/lib/db";
import { BANK_RULES, VERIFIED_SENDERS, REGISTRY_VERSION } from "./bank-rules";

export interface RegistryBundle {
  version: string;
  exportedAt: string;
  rules: typeof BANK_RULES;
  verifiedSenders: typeof VERIFIED_SENDERS;
}

/**
 * Get the current active registry version (from settings, defaults to bundled version).
 */
export async function getRegistryVersion(): Promise<string> {
  const setting = await db.setting.findUnique({ where: { key: "registryVersion" } });
  return setting?.value ?? REGISTRY_VERSION;
}

/**
 * Get all custom rules added by the user (stored as settings).
 */
export async function getCustomRules(): Promise<typeof BANK_RULES> {
  const setting = await db.setting.findUnique({ where: { key: "customRules" } });
  if (!setting) return [];
  try {
    return JSON.parse(setting.value);
  } catch {
    return [];
  }
}

/**
 * Add a custom bank rule (user-defined, persists across sessions).
 */
export async function addCustomRule(
  rule: typeof BANK_RULES[number]
): Promise<void> {
  const custom = await getCustomRules();
  // Check for duplicate by id
  if (custom.some((r) => r.id === rule.id)) {
    // Update existing
    const idx = custom.findIndex((r) => r.id === rule.id);
    custom[idx] = rule;
  } else {
    custom.push(rule);
  }
  await db.setting.upsert({
    where: { key: "customRules" },
    update: { value: JSON.stringify(custom) },
    create: { key: "customRules", value: JSON.stringify(custom) },
  });

  // Bump version
  const version = await getRegistryVersion();
  const newVersion = bumpVersion(version);
  await db.setting.upsert({
    where: { key: "registryVersion" },
    update: { value: newVersion },
    create: { key: "registryVersion", value: newVersion },
  });
}

/**
 * Export the full registry (bundled + custom) as a JSON bundle.
 */
export async function exportRegistry(): Promise<string> {
  const custom = await getCustomRules();
  const version = await getRegistryVersion();

  const bundle: RegistryBundle = {
    version,
    exportedAt: new Date().toISOString(),
    rules: [...BANK_RULES, ...custom],
    verifiedSenders: VERIFIED_SENDERS,
  };

  return JSON.stringify(bundle, null, 2);
}

/**
 * Import a registry bundle and merge custom rules.
 * Existing rules with the same ID are updated, new ones are added.
 */
export async function importRegistry(bundleJson: string): Promise<{
  added: number;
  updated: number;
  version: string;
}> {
  const bundle = JSON.parse(bundleJson) as RegistryBundle;
  const custom = await getCustomRules();

  let added = 0;
  let updated = 0;

  // Only import rules that aren't in the bundled set
  const bundledIds = new Set(BANK_RULES.map((r) => r.id));

  for (const rule of bundle.rules) {
    if (bundledIds.has(rule.id)) continue; // Skip bundled rules

    const existingIdx = custom.findIndex((r) => r.id === rule.id);
    if (existingIdx >= 0) {
      custom[existingIdx] = rule;
      updated++;
    } else {
      custom.push(rule);
      added++;
    }
  }

  await db.setting.upsert({
    where: { key: "customRules" },
    update: { value: JSON.stringify(custom) },
    create: { key: "customRules", value: JSON.stringify(custom) },
  });

  // Update version
  await db.setting.upsert({
    where: { key: "registryVersion" },
    update: { value: bundle.version },
    create: { key: "registryVersion", value: bundle.version },
  });

  return { added, updated, version: bundle.version };
}

/**
 * Get the combined rule set (bundled + custom) for use by the parser.
 */
export async function getActiveRules(): Promise<typeof BANK_RULES> {
  const custom = await getCustomRules();
  return [...BANK_RULES, ...custom];
}

/**
 * Bump a semver-like version string.
 */
function bumpVersion(version: string): string {
  const parts = version.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "1.0.1";
  parts[2]++;
  return parts.join(".");
}
