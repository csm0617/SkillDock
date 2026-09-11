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

		/** Category id of a skill under the demo rules (`undefined` when uncategorized). */
		function categoryOf(name) {
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
			},
			pillActive: {
				background: "var(--dsw-alias-state-business-tertiary)",
				borderColor: "transparent",
			},
			pillMuted: {
				background: "transparent",
				borderStyle: "dashed",
				borderColor: "var(--dsw-alias-border-l4)",
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
			list: { maxHeight: "258px", overflowY: "auto", padding: "4px 6px" },
			item: {
				display: "flex",
				alignItems: "center",
				gap: "10px",
				padding: "8px",
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
		 * The dock row + picker                                               *
		 * ------------------------------------------------------------------ */

		function SkillDockRow(props) {
			const inputActions = props.inputActions;
			const draft = (props.input && props.input.draft) || "";

			const [skills, setSkills] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [openCategory, setOpenCategory] = react.useState(undefined); // undefined = closed
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
			const known = all;

			const openPanel = (categoryId) => {
				setOpenCategory(categoryId === undefined ? null : categoryId);
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
			const chips = DEMO_CATEGORY_RULES.map((rule) =>
				h(
					"button",
					{
						key: rule.id,
						style: Object.assign({}, S.pill, openCategory === rule.id ? S.pillActive : null),
						onClick: () => (openCategory === rule.id ? closePanel() : openPanel(rule.id)),
					},
					rule.name,
				),
			);

			const strip = h(
				"div",
				{ style: S.dock },
				h("span", { style: S.dockLabel }, "技能"),
				chips,
				h("span", { style: S.spacer }),
				h(
					"button",
					{
						style: Object.assign({}, S.pill, S.pillMuted),
						onClick: () => (typeof openCategory === "string" || openCategory === null ? closePanel() : openPanel(undefined)),
					},
					"全部技能" + (inDraft.length ? " · 已选 " + inDraft.length : ""),
				),
			);

			if (openCategory === undefined) return strip;

			/* ---------------- panel ---------------- */

			let rows;
			if (error) {
				rows = h("div", { style: S.notice }, error);
			} else if (skills === null) {
				rows = h("div", { style: S.notice }, "正在加载技能…");
			} else {
				const q = query.trim().toLowerCase();
				const filtered = skills.filter((skill) => {
					if (openCategory && categoryOf(skill.name) !== openCategory) return false;
					if (!q) return true;
					const alias = DEMO_ALIASES[skill.name] || "";
					return (
						skill.name.toLowerCase().includes(q) ||
						(skill.description || "").toLowerCase().includes(q) ||
						alias.toLowerCase().includes(q)
					);
				});
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
									DEMO_ALIASES[skill.name] ? h("span", { style: S.alias }, DEMO_ALIASES[skill.name]) : null,
								);
							});
			}

			const chosenCount = chosen ? chosen.size : 0;

			return h(
				"div",
				null,
				strip,
				h(
					"div",
					{ style: S.panel },
					h(
						"div",
						{ style: S.search },
						"搜索技能",
						h("input", {
							style: S.searchInput,
							value: query,
							placeholder: "",
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
		 * Plugin body                                                         *
		 * ------------------------------------------------------------------ */

		function apply(ctx) {
			ctx.slots.inject("conversation.input.dock", () =>
				ctx.slots.register(
					{
						name: "conversation.input.dock",
						// `list` slots identify each entry by `id` (`key` is the keyed form).
						id: "skill-dock-row",
						inject: (sessionId) => ({
							sessionId,
							loadSkills: () => ctx.remote.skills.list({ sessionId }),
						}),
					},
					SkillDockRow,
				),
			);
		}

		const inject = ["slots", "remote", "remote.skills"];

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
