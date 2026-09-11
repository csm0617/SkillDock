/**
 * SkillDock — browser half (hand-written lazy-CJS factory artifact).
 *
 * Phase 2 (visible slice): the dock row above the composer plus the picker
 * panel. Real in this iteration:
 *   - the skill catalog comes from the `skills.list` Remote;
 *   - picks are written into the composer draft as literal `/skill-name` tokens,
 *     which is the deterministic invocation path the host already understands.
 * Temporary in this iteration:
 *   - categories and aliases are a demo constant; Phase 1 moves them into the
 *     plugin's settings namespace.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-skill-dock",
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

		/** Style tag id: the official bundles inject CSS the same way. */
		const CSS_ID = "dsh-plugin-skill-dock/search.css";

		/**
		 * Inline styles cannot reach a native `::placeholder`, and the native
		 * placeholder is what puts the caret BEFORE the hint text (the composer
		 * behaves this way). Inject the one rule that colors it.
		 */
		function installStyles() {
			if (typeof document === "undefined") return;
			const existing = document.querySelector('style[data-plugin-css="' + CSS_ID + '"]');
			const tag = existing || document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-skill-dock";
			tag.dataset.pluginCss = CSS_ID;
			// Text is always (re)assigned, so a hot-reloaded bundle updates the
			// rules instead of keeping the first version's stylesheet.
			tag.textContent =
				".skill-dock-search-input::placeholder{color:var(--dsw-alias-label-caption);opacity:1}" +
				".skill-dock-pill:hover{background:var(--dsw-alias-interactive-bg-hover)}" +
				// Official treatment: suppress the browser's default focus ring and
				// draw our own only for keyboard focus (`:focus-visible`), so a
				// mouse click on a chip no longer leaves a heavy outline.
				".skill-dock-root button:focus{outline:none}" +
				".skill-dock-root button:focus-visible{outline:2px solid var(--dsw-alias-label-tertiary);outline-offset:-2px}";
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

		/* ------------------------------------------------------------------ *
		 * Temporary demo configuration (replaced by the settings namespace)   *
		 * ------------------------------------------------------------------ */

		/** Demo aliases: real name -> display alias. */
		const DEMO_ALIASES = {
			"tencent-docs": "腾讯文档",
			"cloudstudio-deploy": "云端部署",
			"ardot-design-core": "设计规范",
			"expert-manager": "专家管理",
		};

		/** Demo category rules: first matching rule wins, else the skill is uncategorized. */
		const DEMO_CATEGORY_RULES = [
			{ id: "deploy", name: "部署运维", test: (n) => /deploy|cloud|studio|worktree/.test(n) },
			{ id: "docs", name: "文档写作", test: (n) => /doc|write|writing|readme/.test(n) },
			{ id: "design", name: "设计规范", test: (n) => /design|brand|ui|theme/.test(n) },
		];

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
		const CATALOG = { sessionId: undefined, names: [] };

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

		/** Compose the final draft: the user's prose, then the chosen tokens. */
		function composeDraft(draft, chosen, known) {
			const prose = stripTokens(draft, known);
			const tokens = chosen.map((n) => "/" + n);
			return [prose, ...tokens].filter(Boolean).join(" ");
		}

		/**
		 * Category id of a skill.
		 * Real configuration wins; the demo rules apply only while the user has
		 * not defined any category yet (removed once the settings card ships).
		 */
		function resolveCategory(name, categories, useDemo) {
			for (const category of categories) {
				if (category.skills && category.skills.indexOf(name) >= 0) return category.id;
			}
			if (!useDemo) return undefined;
			for (const rule of DEMO_CATEGORY_RULES) {
				if (rule.test(name)) return rule.id;
			}
			return undefined;
		}

		/* ------------------------------------------------------------------ *
		 * Styles — DSH semantic tokens only, no literal colors                *
		 * ------------------------------------------------------------------ */

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
				background: "var(--dsw-specific-tip)",
				border: "0.5px solid var(--dsw-alias-border-l1)",
				borderRadius: "12px",
				cornerShape: "round",
			},
			dockLabel: {
				fontSize: "13px",
				lineHeight: "20px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-secondary)",
			},
			spacer: { flex: 1 },
			// Category chips follow DSH's own composer controls (the model selector
			// trigger): borderless, unfilled, secondary label, pill radius.
			pill: {
				display: "inline-flex",
				alignItems: "center",
				gap: "4px",
				height: "28px",
				padding: "0 8px",
				fontSize: "13px",
				fontWeight: 500,
				lineHeight: "20px",
				color: "var(--dsw-alias-label-secondary)",
				background: "transparent",
				border: "none",
				borderRadius: "24px",
				cornerShape: "round",
				cursor: "pointer",
				whiteSpace: "nowrap",
			},
			pillActive: {
				background: "var(--dsw-alias-state-business-tertiary)",
				color: "var(--dsw-alias-label-primary)",
			},
			// The "every skill" entry keeps a dashed outline: it is not a category.
			pillMuted: {
				background: "transparent",
				border: "0.5px dashed var(--dsw-alias-border-l4)",
				color: "var(--dsw-alias-label-tertiary)",
			},
			panel: {
				width: "100%",
				maxWidth: "var(--dsh-composer-card-max-width)",
				margin: "0 auto var(--dsh-composer-stack-gap)",
				background: "var(--dsw-specific-menu, var(--dsw-alias-bg-base))",
				borderRadius: "12px",
				cornerShape: "round",
				boxShadow: "var(--dsw-elevation-panel)",
				overflow: "hidden",
			},
			search: {
				display: "flex",
				alignItems: "center",
				gap: "8px",
				margin: "10px 12px",
				padding: "7px 12px",
				background: "var(--dsw-specific-tip)",
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
				alignItems: "center",
				gap: "10px",
				padding: "8px",
				minHeight: "56px",
				boxSizing: "border-box",
				borderRadius: "8px",
				cornerShape: "round",
				cursor: "pointer",
			},
			cbx: {
				width: "15px",
				height: "15px",
				flex: "none",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
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
			name: { fontSize: "13px", lineHeight: "20px", color: "var(--dsw-alias-label-primary)" },
			desc: {
				marginTop: "2px",
				fontSize: "12px",
				lineHeight: "18px",
				color: "var(--dsw-alias-label-caption)",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
				maxWidth: "420px",
			},
			alias: {
				flex: "none",
				fontSize: "12px",
				color: "var(--dsw-alias-label-tertiary)",
				maxWidth: "110px",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
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
			btnPrimary: {
				height: "28px",
				padding: "0 12px",
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-inverted)",
				// Same accent as the composer's primary send button.
				background: "var(--dsw-alias-button-info-fill)",
				border: "0.5px solid transparent",
				borderRadius: "8px",
				cornerShape: "round",
				cursor: "pointer",
			},
			btnGhost: {
				height: "28px",
				padding: "0 12px",
				fontSize: "13px",
				color: "var(--dsw-alias-label-secondary)",
				background: "transparent",
				border: "0.5px solid var(--dsw-alias-border-l2)",
				borderRadius: "8px",
				cornerShape: "round",
				cursor: "pointer",
			},
			notice: { padding: "12px 14px", fontSize: "13px", color: "var(--dsw-alias-label-tertiary)" },
		};

		/* ------------------------------------------------------------------ *
		 * Settings-card styles                                                *
		 * ------------------------------------------------------------------ */

		const C = {
			card: {
				border: "0.5px solid var(--dsw-alias-border-l1)",
				borderRadius: "12px",
				cornerShape: "round",
				overflow: "hidden",
				background: "var(--dsw-alias-bg-base)",
			},
			head: {
				padding: "12px 14px",
				background: "var(--dsw-specific-tip)",
				borderBottom: "0.5px solid var(--dsw-alias-border-l1)",
				fontSize: "13px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-primary)",
			},
			body: { padding: "14px" },
			sub: {
				margin: "16px 0 8px",
				fontSize: "12px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-caption)",
			},
			subFirst: {
				margin: "0 0 8px",
				fontSize: "12px",
				fontWeight: 500,
				color: "var(--dsw-alias-label-caption)",
			},
			opt: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", fontSize: "13px" },
			optNote: { fontSize: "12px", color: "var(--dsw-alias-label-caption)" },
			cat: {
				border: "0.5px solid var(--dsw-alias-border-l1)",
				borderRadius: "9px",
				cornerShape: "round",
				padding: "10px",
				marginBottom: "8px",
			},
			catHead: { display: "flex", alignItems: "center", gap: "8px" },
			input: {
				height: "26px",
				padding: "0 8px",
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-specific-tip)",
				border: "0.5px solid transparent",
				borderRadius: "6px",
				cornerShape: "round",
				outline: "none",
			},
			nameInput: { flex: "0 1 180px" },
			aliasInput: { flex: "1 1 140px" },
			catCount: { fontSize: "12px", color: "var(--dsw-alias-label-caption)" },
			linkBtn: {
				marginLeft: "auto",
				fontSize: "12px",
				color: "var(--dsw-alias-label-tertiary)",
				background: "transparent",
				border: "none",
				cursor: "pointer",
				padding: "0 2px",
			},
			skillRow: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" },
			skillName: {
				flex: "0 1 200px",
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary)",
				fontFamily: "ui-monospace, Consolas, monospace",
			},
			empty: { fontSize: "12px", color: "var(--dsw-alias-label-caption)", padding: "2px 0" },
			adder: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" },
			select: {
				height: "26px",
				fontSize: "13px",
				color: "var(--dsw-alias-label-primary)",
				background: "var(--dsw-specific-tip)",
				border: "0.5px solid transparent",
				borderRadius: "6px",
				cornerShape: "round",
				maxWidth: "260px",
			},
			addBtn: {
				height: "26px",
				padding: "0 10px",
				fontSize: "13px",
				color: "var(--dsw-alias-label-inverted)",
				background: "var(--dsw-alias-button-info-fill)",
				border: "0.5px solid transparent",
				borderRadius: "6px",
				cornerShape: "round",
				cursor: "pointer",
			},
			newCat: {
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: "6px",
				padding: "9px",
				border: "0.5px dashed var(--dsw-alias-border-l4)",
				borderRadius: "9px",
				cornerShape: "round",
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: "12px",
				cursor: "pointer",
				background: "transparent",
				width: "100%",
			},
			pinRow: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px" },
			pinMove: {
				background: "transparent",
				border: "none",
				color: "var(--dsw-alias-label-tertiary)",
				cursor: "pointer",
				fontSize: "12px",
			},
			status: { fontSize: "12px", color: "var(--dsw-alias-label-caption)", marginTop: "10px" },
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
				CATALOG.sessionId = props.sessionId;
				CATALOG.names = all;
			}, [all, props.sessionId]);

			// Durable configuration (settings namespace `skill-dock`).
			const snapshot = props.useConfig ? props.useConfig((s) => s) : undefined;
			const config = (snapshot && snapshot.value) || {};
			const configuredCategories = config.categories || [];
			const useDemo = configuredCategories.length === 0;
			const categories = useDemo
				? DEMO_CATEGORY_RULES.map((rule) => ({ id: rule.id, name: rule.name }))
				: configuredCategories;
			const aliases = Object.keys(config.aliases || {}).length ? config.aliases : useDemo ? DEMO_ALIASES : {};
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
				setQuery("");
				setChosen(new Set(tokensIn(draft, all)));
			};
			const closePanel = () => setOpenCategory(undefined);

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

			const strip = h(
				"div",
				{ style: S.dock },
				h("span", { style: S.dockLabel }, "技能"),
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
					if (openCategory === NONE) return resolveCategory(skill.name, configuredCategories, useDemo) === undefined;
					if (openCategory === ALL) return true;
					return resolveCategory(skill.name, configuredCategories, useDemo) === openCategory;
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
											skill.name,
											isInDraft ? h("span", { style: S.alias }, " 已在输入框") : null,
										),
										h("div", { style: S.desc }, skill.description || ""),
									),
									aliases[skill.name] ? h("span", { style: S.alias }, aliases[skill.name]) : null,
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

		function SettingsCard(props) {
			const snapshot = props.useConfig ? props.useConfig((s) => s) : undefined;
			const config = (snapshot && snapshot.value) || {};
			const categories = config.categories || [];
			const aliases = config.aliases || {};
			const pinned = (config.dock && config.dock.pinned) || [];
			const layout = (config.entry && config.entry.layout) || "row";
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
							h("input", {
								style: Object.assign({}, C.input, C.nameInput),
								defaultValue: category.name,
								onBlur: (event) => {
									if (category.name !== event.target.value && event.target.value.trim())
										renameCategory(category.id, event.target.value.trim());
								},
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
								{ id: selectId, style: C.select, defaultValue: "" },
								h("option", { value: "" }, "选择技能…"),
								candidates.map((name) => h("option", { key: name, value: name }, name)),
							),
							h(
								"button",
								{
									style: C.addBtn,
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

			return h(
				"div",
				{ style: C.card, className: "skill-dock-root" },
				h("div", { style: C.head }, "SkillDock · 技能分类"),
				h(
					"div",
					{ style: C.body },
					h("div", { style: C.subFirst }, "入口形态"),
					h(
						"label",
						{ style: C.opt },
						h("input", {
							type: "radio",
							name: "skill-dock-layout",
							checked: layout === "row",
							onChange: () => write("entry", Object.assign({}, config.entry || {}, { layout: "row" })),
						}),
						"一排分类芯片",
						h("span", { style: C.optNote }, "默认 · composer 卡片上方整行"),
					),
					h(
						"label",
						{ style: C.opt },
						h("input", {
							type: "radio",
							name: "skill-dock-layout",
							checked: layout === "chip",
							onChange: () => write("entry", Object.assign({}, config.entry || {}, { layout: "chip" })),
						}),
						"单个总芯片",
						h("span", { style: C.optNote }, "composer 卡片内 · 工具行右侧"),
					),

					h("div", { style: C.sub }, "分类与技能（别名在技能行右侧就地编辑）"),
					nodes,

					h("div", { style: C.sub }, "固定在 dock 栏的分类（按顺序展示）"),
					pinNodes,

					h(
						"div",
						{ style: C.status },
						status === "ready"
							? "配置已同步到 Host" + (snapshot && snapshot.writable === false ? "（只读）" : "")
							: status === "loading"
								? "正在读取配置…"
								: "配置命名空间不可用",
						CATALOG.names.length === 0 ? " · 打开一个会话后会加载技能列表用于选择" : "",
					),
				),
			);
		}

		/* ------------------------------------------------------------------ *
		 * Plugin body                                                         *
		 * ------------------------------------------------------------------ */

		function apply(ctx) {
			installStyles();

			// One settings scope per plugin: the durable home of categories,
			// aliases, pins, and the entry layout.
			const scope = ctx.settingsScope.bind({ namespace: "skill-dock" });

			/** Registration currently mounted, so a layout change can swap it. */
			let mounted = null;
			let mountedKey = null;

			const start = (key) => {
				const dispose = ctx.slots.inject(key, () =>
					ctx.slots.register(
						{
							name: key,
							// `list` slots identify each entry by `id` (`key` is the keyed form).
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
				mounted = dispose;
				mountedKey = key;
			};

			const sync = () => {
				const layout = (scope.getSnapshot().value || {}).entry?.layout || "row";
				const key = layout === "chip" ? "conversation.input.right" : "conversation.input.dock";
				if (key === mountedKey) return;
				if (mounted) mounted();
				start(key);
			};

			ctx.effect(() => {
				sync();
				const off = scope.subscribe(sync);
				return () => {
					off();
					if (mounted) mounted();
				};
			}, "skill-dock: dock entry");

			// The settings card is keyed by the namespace it edits, which is how
			// the plugin-configuration tab pairs Host namespace and card.
			ctx.slots.inject("settings.plugin.item", () =>
				ctx.slots.register(
					{
						name: "settings.plugin.item",
						key: "skill-dock",
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
