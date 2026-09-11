/**
 * SkillDock — browser half (hand-written lazy-CJS factory artifact).
 *
 * The client module system materializes this file through
 * `window.__ModuleLoader__.load({ id, factory })`; the factory's return value is
 * the client plugin (`apply` / `inject`). Written by hand on purpose: no
 * published build preset exists for out-of-repo client packages, and Phase 0
 * exists to prove this exact shape boots in the page.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-skill-dock",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");

		/** Smoke row: proves the client half composed into the page. */
		function SmokeRow() {
			return react.createElement(
				"div",
				{
					style: {
						position: "fixed",
						right: "16px",
						bottom: "16px",
						zIndex: 2147483000,
						display: "inline-flex",
						alignItems: "center",
						gap: "8px",
						height: "32px",
						padding: "0 12px",
						borderRadius: "999px",
						background: "var(--dsw-alias-bg-base)",
						color: "var(--dsw-alias-label-primary)",
						boxShadow: "var(--dsw-elevation-panel)",
						fontSize: "13px",
						lineHeight: "20px",
						pointerEvents: "auto",
					},
				},
				"SkillDock smoke · 客户端插件已上页",
			);
		}

		/** Client plugin body: register the smoke row into the root overlay. */
		function apply(ctx) {
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register(
					{
						name: "shell.overlay",
						key: "skill-dock-smoke",
					},
					SmokeRow,
				),
			);
		}

		const inject = ["slots"];

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
