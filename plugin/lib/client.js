/**
 * SkillDock — browser half (hand-written lazy-CJS factory artifact).
 *
 * The dock strip above the composer plus the category picker panel:
 *   - the skill catalog comes from the `skills.list` Remote;
 *   - categories, aliases and dock pins are durable settings in the `changhai-skill-dock`
 *     namespace (the host half installs the section);
 *   - picks are written into the composer draft as literal `/skill-name` tokens,
 *     which is the deterministic invocation path the host already understands.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-changhai-skill-dock",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const h = react.createElement;

		/**
		 * DSH's own icon set. It rides the shell's baseline modules (other client
		 * packages require it the same way); the require is guarded so a
		 * deployment without it degrades to an inline glyph instead of failing.
		 */
		let PRIMITIVES = null;
		try {
			PRIMITIVES = require("@deepseek-ai/dsh-client-ui-primitives");
		} catch {
			PRIMITIVES = null;
		}

		/**
		 * Bumped on every bundle change so a screenshot can be tied to a build:
		 * it renders in the settings card's status line. Bump it whenever the
		 * behaviour someone is verifying changes.
		 */
		const BUILD = "b43";

		/** Style tag id: the official bundles inject CSS the same way. */
		const CSS_ID = "dsh-plugin-changhai-skill-dock/search.css";

		/**
		 * Inline styles cannot reach a native `::placeholder`, and the native
		 * placeholder is what puts the caret BEFORE the hint text (the composer
		 * behaves this way). Inject the one rule that colors it.
		 */
		function installStyles() {
			if (typeof document === "undefined") return;
			const existing = document.querySelector('style[data-plugin-css="' + CSS_ID + '"]');
			const tag = existing || document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-changhai-skill-dock";
			tag.dataset.pluginCss = CSS_ID;
			// Text is always (re)assigned, so a hot-reloaded bundle updates the
			// rules instead of keeping the first version's stylesheet.
			// Chips draw no focus ring at all: clicking one also reaches
			// `:focus-visible` in some browsers, which painted a frame around the
			// freshly selected category. Keyboard users get a background tint
			// instead. Scoped to `.skill-dock-pill`, so buttons elsewhere in the
			// plugin (the settings card) keep their normal focus behaviour.
			tag.textContent =
				".skill-dock-search-input::placeholder{color:var(--dsw-alias-label-caption);opacity:1}" +
				".skill-dock-pill:hover{background:var(--dsw-alias-interactive-bg-hover)}" +
				".skill-dock-pill:focus{outline:none}" +
				".skill-dock-pill:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover)}";
			if (!existing) document.head.appendChild(tag);
		}

		/** Search glyph: DSH's icon when available, otherwise a matching inline one. */
		function SearchGlyph() {
			if (PRIMITIVES && PRIMITIVES.IconSearchOutline16) return h(PRIMITIVES.IconSearchOutline16, { size: 14 });
			return h(
				"svg",
				{
					viewBox: "0 0 16 16",
					width: 14,
					height: 14,
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.5,
					strokeLinecap: "round",
					style: { flex: "none" },
				},
				h("circle", { cx: 7, cy: 7, r: 4.25 }),
				h("path", { d: "m10.2 10.2 3.3 3.3" }),
			);
		}

		/**
		 * The label glyph for the strip: DSH's own skill icon, which is what the
		 * harness puts in front of a skill everywhere else. Falls back to an inline
		 * copy of the same artwork (tile + sparkle) when the primitives module is
		 * not on this deployment's module graph.
		 */
		function SkillGlyph() {
			if (PRIMITIVES && PRIMITIVES.IconSkillOutline16) return h(PRIMITIVES.IconSkillOutline16, { size: 14 });
			return h(
				"svg",
				{
					viewBox: "0 0 16 16",
					width: 14,
					height: 14,
					fill: "currentColor",
					"aria-hidden": "true",
					style: { flex: "none" },
				},
				// The tile.
				h("path", {
					d:
						"M9.02246 0.546878C9.9822 0.546878 10.7564 0.545403 11.374 0.612307C12.0042 0.680586 " +
						"12.5515 0.826244 13.0273 1.17188C13.3052 1.37376 13.5501 1.61868 13.752 1.89649C14.0975 " +
						"2.37225 14.2432 2.91984 14.3115 3.54981C14.3784 4.16727 14.377 4.94206 14.377 5.90137V8.51367" +
						"C13.9611 8.29533 13.5071 8.13985 13.0273 8.06055V5.90137C13.0273 4.9121 13.0259 4.22322 " +
						"12.9688 3.69532C12.9129 3.18044 12.8098 2.89782 12.6592 2.69043C12.5406 2.52724 12.3966 " +
						"2.38326 12.2334 2.26465C12.026 2.11404 11.7437 2.0109 11.2285 1.95508C10.7005 1.89789 " +
						"10.0122 1.89649 9.02246 1.89649H6.55371C5.56395 1.89649 4.87569 1.89787 4.34766 1.95508C3.83242 " +
						"2.01092 3.55022 2.11398 3.34278 2.26465C3.17953 2.38329 3.03564 2.52719 2.91699 2.69043C2.76642 " +
						"2.89782 2.66325 3.18042 2.60742 3.69532C2.55027 4.22322 2.54883 4.9121 2.54883 5.90137V10.0986C" +
						"2.54883 11.0878 2.55031 11.7768 2.60742 12.3047C2.66326 12.8196 2.76642 13.1032 2.91699 " +
						"13.3105C3.03558 13.4736 3.17966 13.6178 3.34278 13.7363C3.5502 13.8869 3.83265 13.9901 " +
						"4.34766 14.0459C4.87568 14.1031 5.56398 14.1035 6.55371 14.1035H8.08399C8.27443 14.6025 " +
						"8.55077 15.0585 8.89551 15.4541H6.55371C5.59402 15.4541 4.81976 15.4546 4.20215 15.3877C3.57204 " +
						"15.3194 3.02468 15.1738 2.54883 14.8281C2.27111 14.6263 2.02606 14.3813 1.82422 14.1035C1.47883 " +
						"13.6278 1.33293 13.08 1.26465 12.4502C1.19783 11.8327 1.19922 11.0579 1.19922 10.0986V5.90137C" +
						"1.19922 4.94206 1.1978 4.16727 1.26465 3.54981C1.33295 2.91984 1.47867 2.37225 1.82422 " +
						"1.89649C2.02613 1.61864 2.27098 1.37379 2.54883 1.17188C3.02472 0.826181 3.57197 0.6806 " +
						"4.20215 0.612307C4.81976 0.545393 5.594 0.546877 6.55371 0.546878H9.02246ZM9.19629 9.14649H" +
						"4.5459V7.84571H9.19629V9.14649ZM11.0303 6.10645H4.5459V4.80567H11.0303V6.10645Z",
				}),
				// The sparkle at its lower-right corner.
				h("path", {
					d:
						"M12.5113 15.4067C12.4395 15.6249 12.1308 15.6249 12.059 15.4067L11.643 14.1416C11.454 " +
						"13.567 11.0033 13.1164 10.4288 12.9274L9.16369 12.5113C8.94544 12.4395 8.94544 12.1308 " +
						"9.16369 12.059L10.4288 11.643C11.0033 11.454 11.454 11.0033 11.643 10.4288L12.059 " +
						"9.16369C12.1308 8.94544 12.4395 8.94544 12.5113 9.16369L12.9274 10.4288C13.1164 11.0033 " +
						"13.567 11.454 14.1416 11.643L15.4067 12.059C15.6249 12.1308 15.6249 12.4395 15.4067 " +
						"12.5113L14.1416 12.9274C13.567 13.1164 13.1164 13.567 12.9274 14.1416L12.5113 15.4067Z",
				}),
			);
		}

		/* ------------------------------------------------------------------ *
		 * Helpers                                                             *
		 * ------------------------------------------------------------------ */

		/** Sentinel category selection meaning "every skill". */
		const ALL = "__all__";

		/**
		 * Sentinel meaning "skills in no category". It needs its own value:
		 * `undefined` already means "panel closed", so reusing it made the
		 * 未分类 chip close the panel instead of opening it.
		 */
		const NONE = "__uncategorized__";

		/**
		 * Last catalog the dock row loaded, shared inside this bundle so the
		 * settings card can offer the same skill names without a second request.
		 */
		const CATALOG = { names: [] };

		/**
		 * Match quality of one skill for a lowercased query, or -1 for no match.
		 * Ranking matters: a bare substring test over descriptions matched nearly
		 * every skill for a single letter, so name and alias lead and the
		 * description is a last-resort tier that needs at least two characters.
		 */
		function matchScore(skill, query, aliases) {
			const name = skill.name.toLowerCase();
			const alias = (aliases[skill.name] || "").toLowerCase();
			if (name.startsWith(query)) return 0;
			if (name.split("-").some((segment) => segment.startsWith(query))) return 1;
			if (alias.startsWith(query)) return 2;
			if (name.includes(query)) return 3;
			if (alias.includes(query)) return 4;
			if (query.length >= 2 && (skill.description || "").toLowerCase().includes(query)) return 5;
			return -1;
		}

		/** Escape a skill name for use inside a RegExp. */
		function escapeRe(value) {
			return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}

		/** Every `/name` token currently present in the draft, in order. */
		function tokensIn(draft, known) {
			const found = [];
			for (const name of known) {
				const re = new RegExp("(^|\\s)/" + escapeRe(name) + "(?=\\s|$)");
				if (re.test(draft)) found.push(name);
			}
			return found;
		}

		/** Drop the managed `/name` tokens from the draft, keeping the user's prose. */
		function stripTokens(draft, known) {
			let out = draft;
			for (const name of known) {
				out = out.replace(new RegExp("(^|\\s)/" + escapeRe(name) + "(?=\\s|$)", "g"), " ");
			}
			return out.replace(/\s+/g, " ").trim();
		}

		/**
		 * Compose the final draft: the user's prose, then the chosen tokens.
		 *
		 * A trailing space is deliberate. DSH resolves `/name` from the text
		 * immediately before the caret, so a final token with nothing after it is
		 * still "open" and the composer offers that skill's description while the
		 * user types. Ending on a space closes the token.
		 */
		function composeDraft(draft, chosen, known) {
			const prose = stripTokens(draft, known);
			const tokens = chosen.map((n) => "/" + n);
			const text = [prose, ...tokens].filter(Boolean).join(" ");
			return text ? text + " " : text;
		}

		/** Category id of a skill, or undefined when it belongs to none. */
		function resolveCategory(name, categories) {
			for (const category of categories) {
				if (category.skills && category.skills.indexOf(name) >= 0) return category.id;
			}
			return undefined;
		}

		/* ------------------------------------------------------------------ *
		 * Styles — DSH semantic tokens only, no literal colors                *
		 * ------------------------------------------------------------------ */

		/**
		 * Width of the alias column that leads every skill row. Fixed rather than
		 * content-sized so the English name (and the indented description) sit at
		 * the same x in every row.
		 */
		const ALIAS_COL = "96px";

		/**
		 * Width of the skill-name column inside a category card. The alias input on
		 * each skill row and the 加入分类 button in the adder both begin after this
		 * column, so the whole card reads as one left-aligned grid.
		 */
		const SKILL_COL = "200px";

		/** Horizontal gap between the alias column and the English name. */
		const NAME_GAP = "6px";

		/** Sum of two px lengths: "96px" + "6px" -> "102px". */
		function addLen(a, b) {
			return parseFloat(a) + parseFloat(b) + "px";
		}

		const S = {
			dock: {
				display: "flex",
				alignItems: "center",
				gap: "8px",
				width: "100%",
				maxWidth: "var(--dsh-composer-card-max-width)",
				margin: "0 auto var(--dsh-composer-stack-gap)",
				height: "36px",
				padding: "4px 14px",
				boxSizing: "border-box",
				// Same surface as the composer card below it. `specific-input-major`
				// is the token the official card uses; `specific-tip` looked similar
				// under the default theme but is a nearly opaque dark fill under a
				// skin (0.9 alpha vs this one's 0.08), which made the strip read as a
				// solid slab against a wallpaper.
				background: "var(--dsw-specific-input-major)",
				// The official card draws its edge via the elevation stroke color
				// rather than a literal border.
				"--dsw-elevation-stroke-color": "var(--dsw-alias-border-l2)",
				border: 0,
				borderRadius: "12px",
				cornerShape: "round",
				boxShadow: "var(--dsw-elevation-soft)",
			},
			// The label is now an icon + word, so it needs to lay out on one line.
			dockLabel: {
				display: "inline-flex",
				alignItems: "center",
				gap: "6px",
				fontSize: "13px",
				lineHeight: "20px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-secondary)",
			},
			spacer: { flex: 1 },
			// Every chip in the strip wears the same 0.5px solid hairline, selected
			// or not; selection is signalled by the fill alone. An earlier build
			// dropped the border once selected, which read as "the frame changed
			// when I clicked" — do not reintroduce that.
			pill: {
				display: "inline-flex",
				alignItems: "center",
				gap: "6px",
				height: "26px",
				padding: "0 10px",
				fontSize: "13px",
				lineHeight: "20px",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-base)",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "999px",
				cornerShape: "round",
				cursor: "pointer",
				whiteSpace: "nowrap",
				// Inline, so the browser's default focus ring cannot compete with
				// the injected stylesheet; keyboard focus is restored below.
				outline: "none",
			},
			// Selection is expressed by the fill ONLY. The border is deliberately
			// left exactly as the unselected chip has it (same 0.5px solid, same
			// colour), so every chip in the strip wears one identical hairline and
			// nothing can ever read as a thicker frame.
			pillActive: {
				background: "var(--dsw-alias-state-business-tertiary)",
			},
			// The "every skill" entry used to keep a dashed outline to mark it as
			// "not a category". Dashed hairlines render heavier than the solid
			// 0.5px border DSH uses everywhere else, which made that one chip look
			// like it had a thick frame. It now shares the very same border as the
			// category chips and is set apart only by text colour and fill.
			pillMuted: {
				background: "transparent",
				color: "var(--dsw-alias-label-tertiary)",
			},
			// The picker is a floating popover, so it must read as a solid surface
			// above the page. `--dsw-specific-menu` is the temptation here — it is
			// what DSH's own menus use — but a skin may drive that token from its
			// own "popup opacity" slider (dsh-dream-skin rewrites it to
			// rgba(bg-base, alpha) and only frosts its OWN class names), which left
			// this panel see-through with a sharp inner edge against the search
			// field. An explicit opaque layer-3 stays readable under every theme.
			panel: {
				width: "100%",
				maxWidth: "var(--dsh-composer-card-max-width)",
				margin: "0 auto var(--dsh-composer-stack-gap)",
				background: "var(--dsw-alias-bg-layer-3)",
				borderRadius: "12px",
				cornerShape: "round",
				boxShadow: "var(--dsw-elevation-panel)",
				overflow: "hidden",
			},
			// A recessed well inside the opaque panel. Uses the interactive hover
			// fill rather than `specific-tip`: that token is a near-opaque dark
			// block under a skin, which made the top of the panel read as a solid
			// slab separate from the list below it.
			search: {
				display: "flex",
				alignItems: "center",
				gap: "8px",
				margin: "10px 12px",
				padding: "7px 12px",
				background: "var(--dsw-alias-interactive-bg-hover)",
				borderRadius: "8px",
				cornerShape: "round",
				color: "var(--dsw-alias-label-caption)",
				fontSize: "13px",
			},
			searchInput: {
				flex: 1,
				border: "none",
				outline: "none",
				background: "transparent",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "13px",
				lineHeight: "20px",
			},
			// Fixed to exactly four skill rows (4 x 56px) plus the list's own
			// vertical padding, so the panel keeps one height whether the list has
			// zero, four, or forty entries; overflow scrolls inside.
			list: {
				height: "232px",
				overflowY: "auto",
				padding: "4px 6px",
				boxSizing: "border-box",
			},
			item: {
				display: "flex",
				// Top-aligned so the checkbox lines up with the NAME LINE — the row
				// that carries the alias — rather than with the vertical centre of
				// the name+description block. Centring put the box ~10px below the
				// alias, since the alias lives on the upper line.
				alignItems: "flex-start",
				gap: "10px",
				padding: "8px",
				minHeight: "56px",
				boxSizing: "border-box",
				borderRadius: "8px",
				cornerShape: "round",
				cursor: "pointer",
				outline: "none",
			},
			cbx: {
				width: "15px",
				height: "15px",
				flex: "none",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				// The row pads 8px and the 20px name line centres at +10px, so the
				// 15px box starts at +2.5px to sit centred on the alias.
				marginTop: "2.5px",
				border: "0.5px solid var(--dsw-alias-border-l4)",
				borderRadius: "4px",
				cornerShape: "round",
				fontSize: "10px",
				color: "var(--dsw-alias-label-inverted)",
			},
			cbxOn: {
				// Same accent as the composer's primary send button.
				background: "var(--dsw-alias-button-info-fill)",
				borderColor: "transparent",
			},
			body: { minWidth: 0, flex: 1 },
			// The alias leads the row in a fixed-width column, so the English name
			// begins at one constant x — and the description below is indented by
			// exactly that column plus the row gap, landing under the English name.
			name: {
				display: "flex",
				alignItems: "baseline",
				gap: NAME_GAP,
				fontSize: "13px",
				lineHeight: "20px",
				color: "var(--dsw-alias-label-primary)",
			},
			desc: {
				marginTop: "2px",
				// Indented past the alias column so the description starts directly
				// under the English name it describes.
				marginLeft: addLen(ALIAS_COL, NAME_GAP),
				fontSize: "12px",
				lineHeight: "18px",
				color: "var(--dsw-alias-label-caption)",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
				maxWidth: "420px",
			},
			// " 已在输入框" marker appended after a skill name.
			alias: {
				flex: "none",
				fontSize: "12px",
				color: "var(--dsw-alias-label-tertiary)",
				maxWidth: "110px",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			// The alias leads the row and carries the stronger text colour: people
			// scan this list by the name they gave a skill, and the canonical
			// English name below it is the supporting detail. The column is
			// fixed-width (ALIAS_COL) rather than content-sized so the English name
			// sits at the same x in every row, aliased or not; S.desc indents by
			// ALIAS_COL + the row gap.
			aliasLead: {
				flex: "none",
				width: ALIAS_COL,
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-primary)",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			// Keeps the column occupied on rows whose skill has no alias, so those
			// rows do not shift left relative to their aliased neighbours.
			aliasSpacer: { flex: "none", width: ALIAS_COL },
			// The canonical skill name: one step quieter than the alias. One colour
			// on every row, aliased or not — the alias beside it never changes how
			// strongly the name reads.
			nameSecondary: {
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-secondary)",
			},
			foot: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "10px",
				padding: "9px 14px",
				borderTop: "0.5px solid var(--dsw-alias-border-l1)",
				fontSize: "12px",
				color: "var(--dsw-alias-label-tertiary)",
			},
			// Footer buttons share one style: both cancel and confirm are plain
			// bordered buttons, so neither shouts over the other. They stay separate
			// keys because callers still name the intent, but the values are equal
			// by design — keep them in step if either changes.
			btnPrimary: {
				height: "28px",
				padding: "0 12px",
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-secondary)",
				background: "transparent",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "8px",
				cornerShape: "round",
				cursor: "pointer",
				outline: "none",
			},
			btnGhost: {
				height: "28px",
				padding: "0 12px",
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-secondary)",
				background: "transparent",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "8px",
				cornerShape: "round",
				cursor: "pointer",
				outline: "none",
			},
			notice: { padding: "12px 14px", fontSize: "13px", color: "var(--dsw-alias-label-tertiary)" },
		};

		/* ------------------------------------------------------------------ *
		 * Settings-card styles                                                *
		 *                                                                     *
		 * Mirrors the chrome DSH itself uses for plugin cards (the 子代理 /   *
		 * 网页搜索 rows in 设置 → 插件). Those values are taken from the      *
		 * official card stylesheet, not invented: 16px radius, bg-layer-3,    *
		 * 15px/600 title, 13px/1.5 tertiary description, .5px border-l2       *
		 * dividers, 34px inputs, and a body inset by 16px.                    *
		 * ------------------------------------------------------------------ */

		const C = {
			// Exactly the official card declaration: border-radius only (no
			// `corner-shape`, no `overflow`) — adding either made the 16px outline
			// render heavier than the neighbouring cards.
			card: {
				border: "0.5px solid var(--dsw-alias-border-l4)",
				background: "var(--dsw-alias-bg-layer-3)",
				borderRadius: "16px",
				listStyle: "none",
				transition: "border-color .16s,background .16s",
			},
			// Open state only lifts the background a layer. The border is left at the
			// closed value on purpose: darkening it to `label-dimmed` (what the
			// official card does) made this card's outline visibly heavier than the
			// neighbouring settings cards, which is exactly what we were asked to
			// avoid. One hairline, in both states.
			cardOpen: {
				background: "var(--dsw-alias-bg-layer-2)",
			},
			// The header is the collapse control (an official card header is a
			// <button>): full width, no chrome of its own.
			head: {
				display: "flex",
				alignItems: "center",
				gap: "12px",
				width: "100%",
				padding: "14px 16px",
				background: "transparent",
				border: "none",
				borderRadius: "12px",
				cornerShape: "round",
				font: "inherit",
				color: "inherit",
				textAlign: "left",
				cursor: "pointer",
				outline: "none",
			},
			// Text column of the header, so the chevron is pushed to the right.
			headText: { display: "flex", flexDirection: "column", flex: 1, gap: "4px", minWidth: 0 },
			headName: {
				fontSize: "15px",
				fontWeight: 600,
				lineHeight: 1.4,
				color: "var(--dsw-alias-label-primary)",
			},
			headDesc: {
				marginTop: "4px",
				fontSize: "13px",
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-tertiary)",
			},
			chevron: {
				flex: "none",
				width: 16,
				height: 16,
				color: "var(--dsw-alias-label-tertiary)",
				transition: "transform .16s",
			},
			chevronOpen: { transform: "rotate(180deg)" },
			// Collapsed cards hide the body entirely; the divider only appears when
			// the body is actually shown.
			bodyOpen: { borderTop: "0.5px solid var(--dsw-alias-border-l2)" },
			body: { padding: "0 16px 8px" },
			// A field: 12px vertical rhythm, hairline between consecutive fields.
			field: {
				display: "flex",
				flexDirection: "column",
				gap: "6px",
				padding: "12px 0",
			},
			fieldDivider: { borderTop: "0.5px solid var(--dsw-alias-border-l2)" },
			// Field label: 13px/500 primary, matching At1oFq_label.
			label: {
				fontSize: "13px",
				fontWeight: 500,
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-primary)",
			},
			// Note under a control (used by the toggle row).
			optNote: { fontSize: "12px", lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)" },
			// Toggle row: label column on the left, switch pinned right. Values are
			// the ones DSH uses for its own plugin toggles (the 子代理 card): a
			// 36x20 track with a 16px thumb that slides 16px.
			toggleRow: {
				display: "flex",
				justifyContent: "space-between",
				alignItems: "flex-start",
				gap: "16px",
				fontSize: "13px",
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-primary)",
			},
			toggleText: { flex: 1, minWidth: 0 },
			switchTrack: {
				boxSizing: "border-box",
				flex: "none",
				position: "relative",
				width: "36px",
				height: "20px",
				padding: "2px",
				background: "var(--dsw-alias-border-l3)",
				border: 0,
				borderRadius: "10px",
				cursor: "pointer",
				outline: "none",
			},
			switchTrackOn: { background: "var(--dsw-alias-brand-primary)" },
			switchThumb: {
				display: "block",
				width: "16px",
				height: "16px",
				borderRadius: "50%",
				cornerShape: "round",
				background: "var(--dsw-alias-label-primary-foreground)",
				transition: "transform .12s",
			},
			switchThumbOn: { transform: "translate(16px)" },
			cat: {
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "12px",
				cornerShape: "round",
				padding: "10px 12px",
				marginBottom: "8px",
			},
			catHead: { display: "flex", alignItems: "center", gap: "8px" },
			// The category name reads as a heading, not an input: 15px/600 primary,
			// no box. It only becomes a field once clicked (see CategoryName).
			catName: {
				flex: "0 1 auto",
				minWidth: 0,
				padding: "0",
				background: "transparent",
				border: "none",
				fontSize: "15px",
				fontWeight: 600,
				lineHeight: 1.4,
				color: "var(--dsw-alias-label-primary)",
				textAlign: "left",
				cursor: "text",
				outline: "none",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			// Same footprint as the heading, so entering edit mode does not reflow.
			catNameInput: { flex: "0 1 200px", height: "28px" },
			// 34px tall, radius 8, bg-layer-3, border-l4 — At1oFq_input exactly.
			input: {
				height: "34px",
				padding: "0 12px",
				fontSize: "13px",
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-3)",
				border: "0.5px solid var(--dsw-alias-border-l4)",
				borderRadius: "8px",
				cornerShape: "round",
				outline: "none",
			},
			aliasInput: { flex: "1 1 140px" },
			catCount: { fontSize: "12px", lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)" },
			linkBtn: {
				marginLeft: "auto",
				fontSize: "12px",
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-secondary)",
				background: "transparent",
				border: "none",
				cursor: "pointer",
				padding: "0 2px",
			},
			skillRow: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" },
			// Fixed width, not `flex: 0 1 200px`: a shrinkable column made the alias
			// input's left edge move with the skill name's length, so rows did not
			// line up with each other or with the 加入分类 button below. Alias rows
			// and the adder share this width through SKILL_COL.
			skillName: {
				flex: "none",
				width: SKILL_COL,
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary)",
				fontFamily: "ui-monospace, Consolas, monospace",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			},
			empty: { fontSize: "12px", lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)", padding: "2px 0" },
			adder: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" },
			// The adder mirrors a skill row: the select occupies the skill-name
			// column's slot (starting at the card's left edge, level with the
			// category-name input) and the button takes the alias input's slot (so it
			// lands under the alias inputs). Widths do the aligning — a marginLeft
			// would drift with the select's rendered width.
			adderSelect: { flex: "none", width: SKILL_COL },
			addBtnIndent: { flex: "none" },
			select: {
				height: "34px",
				fontSize: "13px",
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-alias-bg-layer-3)",
				border: "0.5px solid var(--dsw-alias-border-l4)",
				borderRadius: "8px",
				cornerShape: "round",
				maxWidth: "260px",
			},
			// Primary action. Background and text colour are taken from the composer's
			// send button — `button-info-fill` with white text — so the accent matches
			// DSH's own primary action exactly. Shape stays as it was (34px tall, 8px
			// radius) so the button keeps sitting level with the select and alias
			// inputs on its line; only the colours follow the send button.
			addBtn: {
				height: "34px",
				padding: "0 14px",
				fontSize: "13px",
				lineHeight: 1.5,
				fontWeight: 500,
				color: "#fff",
				background: "var(--dsw-alias-button-info-fill)",
				border: "1px solid transparent",
				borderRadius: "8px",
				cornerShape: "round",
				cursor: "pointer",
				outline: "none",
			},
			newCat: {
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: "6px",
				height: "34px",
				border: "0.5px dashed var(--dsw-alias-border-l4)",
				borderRadius: "8px",
				cornerShape: "round",
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "13px",
				lineHeight: 1.5,
				cursor: "pointer",
				background: "transparent",
				width: "100%",
			},
			pinRow: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px" },
			pinMove: {
				background: "transparent",
				border: "none",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer",
				fontSize: "12px",
			},
			status: {
				borderTop: "0.5px solid var(--dsw-alias-border-l2)",
				paddingTop: "12px",
				fontSize: "12px",
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-tertiary)",
			},
		};

		/* ------------------------------------------------------------------ *
		 * The dock row + picker                                               *
		 * ------------------------------------------------------------------ */

		function SkillDockRow(props) {
			const inputActions = props.inputActions;
			const draft = (props.input && props.input.draft) || "";

			const [skills, setSkills] = react.useState(null);
			const [error, setError] = react.useState(null);
			// undefined = closed, null = 未分类, ALL = every skill, string = that category id.
			const [openCategory, setOpenCategory] = react.useState(undefined);
			const [query, setQuery] = react.useState("");
			// Names the user wants in the draft (seeded from the draft when opening).
			const [chosen, setChosen] = react.useState(null);

			// Load the catalog once per session.
			react.useEffect(() => {
				let alive = true;
				setSkills(null);
				setError(null);
				if (!props.loadSkills) {
					setError("skills Remote 不可用");
					return () => {};
				}
				Promise.resolve(props.loadSkills())
					.then((result) => {
						if (!alive) return;
						if (result && result.ok) setSkills(result.value.skills || []);
						else setError((result && result.error && result.error.message) || "技能列表加载失败");
					})
					.catch((cause) => {
						if (alive) setError(String((cause && cause.message) || cause));
					});
				return () => {
					alive = false;
				};
			}, [props.sessionId]);

			const all = react.useMemo(() => (skills || []).map((s) => s.name), [skills]);

			// Publish the catalog for the settings card (same module, no second request).
			react.useEffect(() => {
				CATALOG.names = all;
			}, [all]);

			// Durable configuration (settings namespace `changhai-skill-dock`).
			const snapshot = props.useConfig ? props.useConfig((s) => s) : undefined;
			const config = (snapshot && snapshot.value) || {};
			const categories = config.categories || [];
			const aliases = config.aliases || {};
			const pinnedIds = (config.dock && config.dock.pinned) || [];
			const pinned = pinnedIds.length
				? pinnedIds
						.map((id) => categories.find((c) => c.id === id))
						.filter(Boolean)
				: categories;
			const showUncategorized = !(config.picker && config.picker.showUncategorized === false);
			const limited = (config.picker && config.picker.listLimit) || 200;

			const openPanel = (categoryId) => {
				setOpenCategory(categoryId);
				setQuery("");				setChosen(new Set(tokensIn(draft, all)));
			};
			const closePanel = () => setOpenCategory(undefined);

			// If the 未分类 entry is switched off while its panel is open, the panel
			// would be left with no visible chip to toggle it shut — close it.
			react.useEffect(() => {
				if (!showUncategorized && openCategory === NONE) setOpenCategory(undefined);
			}, [showUncategorized, openCategory]);

			const toggle = (name) => {
				setChosen((prev) => {
					const next = new Set(prev || []);
					if (next.has(name)) next.delete(name);
					else next.add(name);
					return next;
				});
			};

			const confirm = () => {
				const text = composeDraft(draft, Array.from(chosen || []), all);
				if (inputActions && typeof inputActions.setDraft === "function") {
					inputActions.setDraft(text);
				}
				closePanel();
			};

			/* ---------------- dock strip ---------------- */

			const inDraft = tokensIn(draft, all);
			const chips = pinned.map((category) =>
				h(
					"button",
					{
						key: category.id,
						className: "skill-dock-pill",
						style: Object.assign({}, S.pill, openCategory === category.id ? S.pillActive : null),
						onClick: () => (openCategory === category.id ? closePanel() : openPanel(category.id)),
					},
					category.name,
				),
			);
			if (showUncategorized) {
				chips.push(
					h(
						"button",
						{
							key: NONE,
							className: "skill-dock-pill",
							style: Object.assign({}, S.pill, openCategory === NONE ? S.pillActive : null),
							onClick: () => (openCategory === NONE ? closePanel() : openPanel(NONE)),
						},
						"未分类",
					),
				);
			}

			/* ---------------- entry strip ---------------- */

			const strip = h(
				"div",
				{ style: S.dock },
				h("span", { style: S.dockLabel }, h(SkillGlyph, null), "技能"),
				chips,
				h("span", { style: S.spacer }),
				h(
					"button",
					{
						className: "skill-dock-pill",
						style: Object.assign({}, S.pill, S.pillMuted, openCategory === ALL ? S.pillActive : null),
						onClick: () => (openCategory === ALL ? closePanel() : openPanel(ALL)),
					},
					"全部技能" + (inDraft.length ? " · 已选 " + inDraft.length : ""),
				),
			);

			if (openCategory === undefined) return h("div", { className: "skill-dock-root" }, strip);

			/* ---------------- panel ---------------- */

			let rows;
			if (error) {
				rows = h("div", { style: S.notice }, error);
			} else if (skills === null) {
				rows = h("div", { style: S.notice }, "正在加载技能…");
			} else {
				const q = query.trim().toLowerCase();
				const inScope = skills.filter((skill) => {
					if (openCategory === NONE) return resolveCategory(skill.name, categories) === undefined;
					if (openCategory === ALL) return true;
					return resolveCategory(skill.name, categories) === openCategory;
				});
				// Ranked, not just filtered: name hits lead, alias next, and the
				// description only contributes for queries of two characters or more.
				const scored = q
					? inScope
							.map((skill) => ({ skill, score: matchScore(skill, q, aliases) }))
							.filter((entry) => entry.score >= 0)
							.sort((a, b) => a.score - b.score || a.skill.name.localeCompare(b.skill.name))
							.map((entry) => entry.skill)
					: inScope;
				const filtered = scored.slice(0, limited);
				rows =
					filtered.length === 0
						? h("div", { style: S.notice }, "没有匹配的技能")
						: filtered.map((skill) => {
								const isChosen = !!(chosen && chosen.has(skill.name));
								const isInDraft = inDraft.indexOf(skill.name) >= 0;
								return h(
									"div",
									{ key: skill.name, style: S.item, onClick: () => toggle(skill.name) },
									h("div", { style: Object.assign({}, S.cbx, isChosen ? S.cbxOn : null) }, isChosen ? "✓" : ""),
									h(
										"div",
										{ style: S.body },
										h(
											"div",
											{ style: S.name },
											aliases[skill.name]
												? h("span", { style: S.aliasLead }, aliases[skill.name])
												: h("span", { style: S.aliasSpacer }),
											h("span", { style: S.nameSecondary }, skill.name),
											isInDraft ? h("span", { style: S.alias }, " 已在输入框") : null,
										),
										h("div", { style: S.desc }, skill.description || ""),
									),
								);
							});
			}

			const chosenCount = chosen ? chosen.size : 0;

			return h(
				"div",
				{ className: "skill-dock-root" },
				strip,
				h(
					"div",
					{ style: S.panel },
					h(
						"div",
						{ style: S.search },
						h(SearchGlyph, null),
						h("input", {
							className: "skill-dock-search-input",
							style: S.searchInput,
							value: query,
							placeholder: "搜索技能",
							"aria-label": "搜索技能",
							onChange: (event) => setQuery(event.target.value),
							autoFocus: true,
						}),
					),
					h("div", { style: S.list }, rows),
					h(
						"div",
						{ style: S.foot },
						h("span", null, "已选 " + chosenCount + " 项"),
						h(
							"span",
							{ style: { display: "flex", gap: "10px", alignItems: "center" } },
							h("button", { style: S.btnGhost, onClick: closePanel }, "取消"),
							h("button", { style: S.btnPrimary, onClick: confirm }, "确认插入"),
						),
					),
				),
			);
		}

		/* ------------------------------------------------------------------ *
		 * Settings card (settings.plugin.item, keyed by the namespace)         *
		 * ------------------------------------------------------------------ */

		/**
		 * The category's name in its card header. It reads as a heading until the
		 * user clicks it, then becomes an input — because a bare input box was
		 * indistinguishable from the alias inputs on the skill rows below it, which
		 * made it unclear which string was the category and which was an alias.
		 * Enter or blur commits; Escape reverts.
		 */
		function CategoryName(props) {
			const [editing, setEditing] = react.useState(false);
			const [value, setValue] = react.useState(props.name);

			// Keep in step when the stored name changes from elsewhere.
			react.useEffect(() => setValue(props.name), [props.name]);

			if (!editing) {
				return h(
					"button",
					{
						type: "button",
						style: C.catName,
						title: "点击重命名分类",
						onClick: () => setEditing(true),
					},
					props.name,
				);
			}

			const commit = () => {
				const next = value.trim();
				setEditing(false);
				if (next && next !== props.name) props.onRename(next);
			};

			return h("input", {
				style: Object.assign({}, C.input, C.catNameInput),
				value: value,
				autoFocus: true,
				"aria-label": "分类名称",
				onChange: (event) => setValue(event.target.value),
				onBlur: commit,
				onKeyDown: (event) => {
					if (event.key === "Enter") commit();
					if (event.key === "Escape") {
						setValue(props.name);
						setEditing(false);
					}
				},
			});
		}

		function SettingsCard(props) {
			const snapshot = props.useConfig ? props.useConfig((s) => s) : undefined;
			const config = (snapshot && snapshot.value) || {};
			const categories = config.categories || [];
			const aliases = config.aliases || {};
			const pinned = (config.dock && config.dock.pinned) || [];
			// Absent means shown: `false` is the only value that hides the entry,
			// matching the host schema's `.default(true)`.
			const showUncategorized = !(config.picker && config.picker.showUncategorized === false);
			const status = snapshot ? snapshot.status : "loading";

			/** Catalog names, plus names already referenced by the configuration. */
			const knownNames = react.useMemo(() => {
				const set = new Set(CATALOG.names);
				for (const category of categories) for (const name of category.skills || []) set.add(name);
				for (const name of Object.keys(aliases)) set.add(name);
				return Array.from(set).sort();
			}, [CATALOG.names.length, categories, aliases]);

			const write = (field, value) => {
				const scope = props.scope;
				if (!scope) return;
				Promise.resolve(scope.set(field, value)).catch(() => {});
			};

			const replaceCategory = (id, next) =>
				write(
					"categories",
					categories.map((category) => (category.id === id ? next : category)),
				);

			const newCategoryId = () => {
				let n = 1;
				while (categories.some((category) => category.id === "cat-" + n)) n += 1;
				return "cat-" + n;
			};

			const addCategory = () => {
				const id = newCategoryId();
				write("categories", categories.concat([{ id, name: "新分类", skills: [] }]));
			};

			const removeCategory = (id) =>
				write(
					"categories",
					categories.filter((category) => category.id !== id),
				);

			const renameCategory = (id, name) => {
				const current = categories.find((category) => category.id === id);
				if (current) replaceCategory(id, Object.assign({}, current, { name }));
			};

			const assignSkill = (id, name) => {
				const current = categories.find((category) => category.id === id);
				if (!current || (current.skills || []).indexOf(name) >= 0) return;
				replaceCategory(id, Object.assign({}, current, { skills: (current.skills || []).concat([name]) }));
			};

			const unassignSkill = (id, name) => {
				const current = categories.find((category) => category.id === id);
				if (!current) return;
				replaceCategory(
					id,
					Object.assign({}, current, { skills: (current.skills || []).filter((s) => s !== name) }),
				);
			};

			const setAlias = (name, value) => {
				const next = Object.assign({}, aliases);
				if (value && value.trim()) next[name] = value.trim();
				else delete next[name];
				write("aliases", next);
			};

			const togglePin = (id) =>
				write(
					"dock",
					Object.assign({}, config.dock || {}, {
						pinned: pinned.indexOf(id) >= 0 ? pinned.filter((p) => p !== id) : pinned.concat([id]),
					}),
				);

			// Collapse state is view-only: it is not configuration, so it is not
			// persisted into the settings namespace. Starts collapsed so the card
			// sits as one compact row among the other setting cards — and, because
			// the open state darkens the border, collapsing is also what keeps its
			// outline identical to theirs.
			const [open, setOpen] = react.useState(false);

			const movePin = (id, delta) => {
				const order = pinned.indexOf(id) >= 0 ? pinned.slice() : pinned.concat([id]);
				const from = order.indexOf(id);
				const to = from + delta;
				if (to < 0 || to >= order.length) return;
				order.splice(to, 0, order.splice(from, 1)[0]);
				write("dock", Object.assign({}, config.dock || {}, { pinned: order }));
			};

			/* -------- category blocks -------- */

			const nodes = [];

			categories.forEach((category) => {
				const skills = category.skills || [];
				const candidates = knownNames.filter((name) => skills.indexOf(name) < 0);
				const selectId = "skill-dock-add-" + category.id;

				const skillRows = skills.length
					? skills.map((name) =>
							h(
								"div",
								{ key: name, style: C.skillRow },
								h("span", { style: C.skillName }, name),
								h("input", {
									style: Object.assign({}, C.input, C.aliasInput),
									defaultValue: aliases[name] || "",
									placeholder: "别名（可留空）",
									onBlur: (event) => {
										if ((aliases[name] || "") !== event.target.value) setAlias(name, event.target.value);
									},
								}),
								h("button", { style: C.linkBtn, onClick: () => unassignSkill(category.id, name) }, "移除"),
							),
						)
					: [h("div", { key: "empty", style: C.empty }, "还没有技能")];

				nodes.push(
					h(
						"div",
						{ key: category.id, style: C.cat },
						h(
							"div",
							{ style: C.catHead },
							h(CategoryName, {
								name: category.name,
								onRename: (next) => renameCategory(category.id, next),
							}),
							h("span", { style: C.catCount }, skills.length + " 个技能"),
							h("button", { style: C.linkBtn, onClick: () => removeCategory(category.id) }, "删除分类"),
						),
						skillRows.length ? h("div", { style: { marginTop: "8px" } }, skillRows) : null,
						h(
							"div",
							{ style: C.adder },
							h(
								"select",
								{ id: selectId, style: Object.assign({}, C.select, C.adderSelect), defaultValue: "" },
								h("option", { value: "" }, "选择技能…"),
								candidates.map((name) => h("option", { key: name, value: name }, name)),
							),
							h(
								"button",
								{
									style: Object.assign({}, C.addBtn, C.addBtnIndent),
									onClick: () => {
										const el = document.getElementById(selectId);
										if (el && el.value) assignSkill(category.id, el.value);
									},
								},
								"加入分类",
							),
						),
					),
				);
			});

			nodes.push(
				h(
					"button",
					{ key: "__new__", style: C.newCat, onClick: addCategory },
					"＋ 新建分类",
				),
			);

			/* -------- pins -------- */

			const pinNodes = categories.length
				? categories.map((category) => {
						const on = pinned.indexOf(category.id) >= 0;
						return h(
							"div",
							{ key: category.id, style: C.pinRow },
							h("input", {
								type: "checkbox",
								checked: on,
								onChange: () => togglePin(category.id),
							}),
							h("span", null, category.name),
							on
								? h(
										"span",
										{ style: { display: "flex", gap: "6px", marginLeft: "auto" } },
										h("button", { style: C.pinMove, onClick: () => movePin(category.id, -1) }, "上移"),
										h("button", { style: C.pinMove, onClick: () => movePin(category.id, 1) }, "下移"),
									)
								: null,
						);
					})
				: [h("div", { key: "none", style: C.empty }, "还没有分类")];

			// Status line: sync state, catalog hint, and the build marker that ties a
			// screenshot to a bundle revision.
			const dashboardNote =
				(status === "ready"
					? "配置已同步到 Host" + (snapshot && snapshot.writable === false ? "（只读）" : "")
					: status === "loading"
						? "正在读取配置…"
						: "配置命名空间不可用") +
				(CATALOG.names.length === 0 ? " · 打开一个会话后会加载技能列表用于选择" : "") +
				" · " +
				BUILD;

			// Fields separated by a hairline, mirroring the official card where
			// consecutive fields carry `border-top: .5px solid border-l2`. The first
			// field drops the divider, since the header above already provides one.
			const field = (label, control, isFirst) =>
				h(
					"div",
					{ style: isFirst ? C.field : Object.assign({}, C.field, C.fieldDivider) },
					h("div", { style: C.label }, label),
					control,
				);

			// An official card is a <li> inside the section's <ul>: matching that
			// keeps list semantics valid (a <div> there is not allowed content).
			return h(
				"li",
				{
					style: open ? Object.assign({}, C.card, C.cardOpen) : C.card,
					className: "skill-dock-root",
				},
				h(
					"button",
					{
						type: "button",
						style: C.head,
						"aria-expanded": open,
						onClick: () => setOpen((prev) => !prev),
					},
					h(
						"div",
						{ style: C.headText },
						h("div", { style: C.headName }, "技能分类"),
						h(
							"div",
							{ style: C.headDesc },
							"为技能自定义分类与别名，并决定它们在 composer 上方的展示方式。",
						),
					),
					// Inline chevron: rotating the same glyph by 180deg is the
					// official open/closed signal.
					h(
						"svg",
						{
							viewBox: "0 0 16 16",
							width: 16,
							height: 16,
							fill: "none",
							stroke: "currentColor",
							strokeWidth: 1.5,
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							style: Object.assign({}, C.chevron, open ? C.chevronOpen : null),
						},
						h("path", { d: "m4 6 4 4 4-4" }),
					),
				),
				open
					? h(
							"div",
							{ style: Object.assign({}, C.body, C.bodyOpen) },
							field(
								"面板入口",
								h(
									"div",
									{ style: C.toggleRow },
									h(
										"div",
										{ style: C.toggleText },
										h("div", null, "展示「未分类」入口"),
										h("div", { style: C.optNote }, "关闭后 dock 栏不再提供未分类分类芯片"),
									),
									// A switch, not a checkbox: this matches the toggle DSH
									// uses for its own plugin settings (the 子代理 card).
									// The inner span is the sliding thumb.
									h(
										"button",
										{
											type: "button",
											role: "switch",
											"aria-checked": showUncategorized,
											"aria-label": "展示「未分类」入口",
											style: Object.assign(
												{},
												C.switchTrack,
												showUncategorized ? C.switchTrackOn : null,
											),
											onClick: () =>
												write(
													"picker",
													Object.assign({}, config.picker || {}, {
														showUncategorized: !showUncategorized,
													}),
												),
										},
										h(
											"span",
											{
												style: Object.assign(
													{},
													C.switchThumb,
													showUncategorized ? C.switchThumbOn : null,
												),
											},
										),
									),
								),
								true,
							),

					field("分类与技能（别名在技能行右侧就地编辑）", nodes),

					field("固定在 dock 栏的分类（按顺序展示）", pinNodes),

					h("div", { style: C.status }, dashboardNote),
						)
					: null,
			);
		}

		/* ------------------------------------------------------------------ *
		 * Plugin body                                                         *
		 * ------------------------------------------------------------------ */

		function apply(ctx) {
			installStyles();

			// One settings scope per plugin: the durable home of categories,
			// aliases, and dock pins.
			const scope = ctx.settingsScope.bind({ namespace: "changhai-skill-dock" });

			// The entry is the strip above the composer card. It registers once: the
			// plugin no longer offers a second entry form, so there is nothing to
			// swap at runtime.
			ctx.slots.inject("conversation.input.dock", () =>
				ctx.slots.register(
					{
						name: "conversation.input.dock",
						// `list` slots identify each entry by `id`.
						id: "skill-dock-row",
						inject: (sessionId) => ({
							sessionId,
							loadSkills: () => ctx.remote.skills.list({ sessionId }),
							hooks: { config: scope },
						}),
					},
					SkillDockRow,
				),
			);

			// The settings card is keyed by the namespace it edits, which is how
			// the plugin-configuration tab pairs Host namespace and card.
			ctx.slots.inject("settings.plugin.item", () =>
				ctx.slots.register(
					{
						name: "settings.plugin.item",
						key: "changhai-skill-dock",
						inject: () => ({ scope, hooks: { config: scope } }),
					},
					SettingsCard,
				),
			);
		}

		const inject = ["slots", "remote", "remote.skills", "settingsScope"];

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
