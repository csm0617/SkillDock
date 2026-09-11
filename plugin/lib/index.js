/**
 * SkillDock — Host half.
 *
 * Phase 0 (smoke test): prove the package loads on the host side and that the
 * browser half declared through `dsh.client` reaches the page. No settings
 * namespace, no skill scanning yet — those arrive in Phase 1.
 */

export const name = 'skill-dock'

/** No host services are required for the smoke test. */
export const inject = []

export function apply(ctx) {
  try {
    ctx.logger('skill-dock').info('skill-dock host half loaded')
  } catch {
    // A missing logger must not fail activation during the smoke test.
  }
}
