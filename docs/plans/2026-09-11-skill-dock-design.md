# SkillDock 设计文档：技能自定义分类与 dock 栏选择器

- 日期：2026-09-11
- 目标平台：DeepSeek Harness（DSH）Web GUI，本机核验版本 `@deepseek-ai/dsh@0.1.2-rc.1`
- 状态：待用户批准后进入实现

## 1. 目标与非目标

### 目标

1. 给技能（skill）打自定义分类（标签），**分类数据只存插件配置**，不修改任何 `SKILL.md`。
2. 在输入框工具行「工作区内修改」控件**右侧**展示分类入口；点击后弹出面板，可浏览/搜索/多选技能。
3. 被选中的技能以 `/name` token 的形式进入输入框，走 DSH 既有的确定性技能调用路径。
4. 用户可自定义「哪些分类固定在 dock 栏展示」，并控制其顺序。

### 非目标

- 不修改技能文件内容，不写入 `SKILL.md` frontmatter。
- 不新增模型可见的会话输入（因此不新增 `SessionEventMap` 事件）。
- 不替换或改造内置 `/` 技能菜单、不改造 `conversation.composer.bar` 等 single 槽位。
- 不实现技能内容的编辑、安装、卸载（那是内置技能面板的职责）。

## 2. 已核验的机制事实

以下事实来自本机实际安装的 DSH 产物，不是文档推断：

| 事实 | 出处 |
|---|---|
| `conversation.input.left` / `conversation.input.right`：`kind: 'list'`、`scope: 'session'`，输入工具行左右两侧的紧凑控件 | `dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts` |
| `conversation.input.dock`：`kind: 'list'`、`scope: 'session'`、owner props 为 `InputZone { session, input }`，渲染在 composer 卡片上方整行 | 同上 |
| `conversation.composer.dock`：`kind: 'list'`、`scope: 'session'`，渲染在卡片下方 | 同上 |
| session scope 的 slot 组件可通过标准 props 拿到 `useInput`、`inputActions`（含 `setDraft`） | `contract/slots.d.ts` 的 `SessionStandardProps` |
| 技能调用已有确定性路径：草稿中的 `/name` 字面文本由 host 的 `dsh-tool-skill` 在 pre-step 注入 `<skill_content>` | `dsh-client-ui-skill/README.md` |
| 客户端可调用 `skills/list` Remote 获取 user-invocable 技能 | `dsh-client-ui-skill/README.md` |
| 插件可注册自己的 settings namespace；浏览器半用 `settingsScope` 按 revision 读写 | `docs/cookbook/adding-a-settings-card.md` |
| 浏览器半由 `dsh.client` + `exports["./client"]` 自动上页，无需重建 Web 应用 | 同上 |

由此得出两条关键设计约束：

1. **「选择调用哪些技能」不需要新协议**——插入 `/name ` 即可，与内置菜单、手输 token 完全同路径，可重放、可手删。
2. **分类的持久化不需要自建 Remote**——settings namespace 已提供同等的服务端持久化与 revision fencing，避免复刻 Typert 生成链路。

## 3. 架构

单包双半（Host half + Client half），对应 bundle 插件分发形态。

```
skill-dock/
├─ package.json          # dsh.bundle.patch + dsh.client + exports{".","./client"}
├─ cordis.patch.yml      # 组合层：把本插件插入 profile
├─ src/
│  ├─ index.ts           # Host 半：settings namespace + Config schema
│  └─ client/
│     ├─ index.tsx       # Client 半入口：apply/inject + slot 注册
│     ├─ store.ts        # 分类视图状态与技能目录绑定
│     ├─ CategoryChip.tsx    # conversation.input.right 上的紧凑控件
│     ├─ DockRow.tsx         # conversation.input.dock 上的固定分类行
│     ├─ SkillPicker.tsx     # 弹出面板：搜索 + 分类 tab + 技能列表
│     └─ SettingsCard.tsx    # settings.plugin.item 卡片：分类管理
└─ lib/                  # 构建产物（host + client bundle）
```

### Host 半职责（薄）

- 声明 `Config`（Schemastery，**一切可调参数都必须进 schema**，禁止硬编码）。
- 通过 `ctx.settings.installSection(ctx, 'skill-dock', Config, config, { setSource, onChange })` 注册命名空间 `skill-dock`。
- `onChange` 时刷新内存源，供 host 侧读取（P3 的归类工具用）。
- 不做任何 UI、不做技能扫描（技能目录由 Client 半经 `skills/list` 获取）。

### Client 半职责（全部 UI）

| 注册位置 | 组件 | 作用 |
|---|---|---|
| `conversation.input.right` | `CategoryChip` | 工具行右侧的紧凑入口：图标 + 当前激活分类名/已选技能数；点击开面板 |
| `conversation.input.dock` | `DockRow` | 被固定（pinned）的分类行，每个分类一个 chip，点击直接展开该分类技能 |
| `settings.plugin.item` | `SettingsCard` | 分类的增删改、技能归属拖拽、dock 固定项与排序 |

全部通过 `ctx.slots.inject(key, () => ctx.slots.register({...}))` 注册；注册生命周期随 fiber，卸载自动回收。

## 4. 数据模型

单一事实来源：settings namespace `skill-dock`。

```ts
interface Category {
  id: string          // 稳定 id（kebab-case），重命名不改 id
  name: string        // 展示名（中文可）
  color?: string      // 展示色，可选
  skills: string[]    // 技能名（kebab-case），无序集合
}

interface Config {
  categories: Category[]              // 分类定义与归属
  dock: {
    pinned: string[]                  // 固定在 dock 栏的分类 id，有序
    showSelectedInChip: boolean       // 芯片是否显示已选技能数
  }
  picker: {
    showUncategorized: boolean        // 面板是否显示“未分类”分组
    searchPlaceholderLimit?: number   // 面板列表渲染上限（可调，不硬编码）
  }
}
```

设计取舍：

- **技能可属于多个分类**（`skills: string[]` 落在多个分类里），符合“打标签”的直觉；面板里按分类分组展示，同名技能出现在多个分组属预期行为。
- **未分类技能**不是分类，而是面板里的一个虚拟分组，由「全部技能 − 已归类技能」实时计算，不落盘。
- **不存在的技能名**（技能被卸载）保留在配置中但在 UI 标灰，不自动删除——避免用户重装技能后分类丢失。
- 分类数据与技能文件解耦：换机器时跟随 DSH profile 的 settings 文档迁移。

## 5. 交互规格

### 5.1 入口芯片（`conversation.input.right`）

- 默认显示：分类图标 + 当前激活分类名（默认为第一个 pinned 分类；无分类时显示「分类」占位）。
- 徽标显示当前草稿中已识别的 `/name` token 数量（读 `useInput` 的 `draft` + `occurrences`）。
- 点击打开面板；再次点击或点击面板外/Esc 关闭（`dismissPopup` 语义）。

### 5.2 弹出面板（`SkillPicker`）

- 顶部：搜索框（按技能名与描述做 `startsWith` + 子串匹配）。
- 分类横向 tab：全部分类 + 「未分类」（受 `picker.showUncategorized` 控制）。
- 技能行：名称 + 描述（截断），左侧勾选态表示该技能是否已在草稿中被引用。
- 交互对齐参考截图：搜索在上、分类切换、列表可滚动、底部保留“管理分类”入口（跳设置卡片）。
- **多选为两段式（待插入态 → 确认写入）**：点击技能行只切换「待插入」勾选，**不立即改动草稿**；面板底部常驻「已选 N 项 · 确认插入」按钮，点击后一次性把对应 `/name ` token 写入草稿，待插入态清空。
- 已写入草稿的 token 若要移除：重新打开面板时按当前草稿反显勾选态（标记为「已在输入框」），取消勾选并确认即移除该 token。
- 面板关闭（Esc / 点击外部）时丢弃未确认的待插入态，不产生副作用——避免误触直接改动用户输入。

### 5.3 写入草稿的方式

优先级（越靠前越优先）：

1. `slash/input-insert-text`（bail 事件，带 `TokenSpan` + `draftRev` CAS）——仅用于有明确插入点的场景。
2. `inputActions.setDraft(text)`——当需要按整份草稿重算时（多选切换、批量插入）。

**写入规则**：确认插入时按「草稿现存 token ∪ 待插入集合 − 待移除集合」重算并一次性写入；追加多个 token 时按面板内的勾选顺序排列，插入点默认草稿末尾（或先插入后把光标留给用户继续输入）。不触碰用户手输的其它文本。所有写入以确认时刻的 `draftRev` 为准；若期间 `draftRev` 已变化（用户正在编辑），则中止本次写入并提示用户重新确认，绝不覆盖进行中的编辑。

### 5.4 设置卡片

- 分类列表：新建、重命名、改色、删除（删除只删分类，不删技能）。
- 技能归属：从「全部技能」列表拖拽或点击加入分类；支持从分类移除。
- dock 配置：勾选哪些分类固定到 dock 栏，并支持上下排序（写入 `dock.pinned` 顺序）。
- 所有写入走 `ctx.settingsScope.bind({ namespace: 'skill-dock' })`，按读到 revision 提交。

## 6. 数据流

```
settings namespace(skill-dock)  ──读──┐
                                      ├─→ Client store ─→ slot 组件渲染
skills/list Remote ──读───────────────┘
                                             │
用户点击技能 ────────────────────────────────┘
      ↓
inputActions.setDraft / slash/input-insert-text
      ↓
草稿含 `/name` token
      ↓
用户提交 → host dsh-tool-skill pre-step 注入 <skill_content>
```

- 技能目录按 session 缓存并单飞（single-flight）取数，`connection/reset` 时清空，避免重复请求。
- 分类配置变更来自 settings 订阅，实时刷新 UI。

## 7. 错误处理

| 场景 | 处理 |
|---|---|
| `skills/list` 失败 | 面板显示降级文案（“技能列表不可用”）并保留重试按钮；不影响输入框其它功能 |
| settings 读取失败 | 使用空配置（分类为空，仅显示「未分类」分组），不阻塞输入 |
| settings 写入冲突（revision 过期） | 重新读取后重放本次变更一次；再次冲突则提示用户 |
| 配置中的技能名已不存在 | 面板标灰并加“已失效”提示，不自动清理 |
| 配置含重名分类 id | 加载期由 schema 校验拒绝（响亮失败，遵循“非法配置加载期失败”红线） |
| slot key 未声明 / 归属冲突 | 激活期即失败（框架行为），不静默降级 |

## 8. 测试与验证

### 静态与单元

- `tsc --noEmit`（tsconfig 三件套：`moduleResolution: bundler` + `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`）。
- store 的纯函数单测：分类归属计算、未分类集合推导、`/name` token 的增删与草稿重算、token 与 `draftRev` 的并发保护。
- Config schema 校验单测：重名 id、非 kebab-case 技能名、非法色值。

### 集成与人工验证

1. `dsh --profile web --dump-config`：确认 patch 行生效、无 FAILED。
2. 启动 `dsh web`，用本会话的 GUI（`http://127.0.0.1:3080`）刷新页面后核验：
   - 芯片出现在「工作区内修改」右侧（即 `conversation.input.right`）。
   - 面板可搜索、可切换分类、可多选。
   - 选中后输入框出现 `/name `，提交后 host 注入技能正文（会话里可见 `Instructions` 卡片）。
   - dock 栏固定分类后刷新页面依然存在（配置已持久化）。
3. 卸载/禁用插件后：芯片与 dock 行消失，输入框无残留，控制台无报错（effect 回收验证）。
4. 空配置、无技能、技能全部未分类三种边界场景各过一遍。

### 打包验证

- `pnpm pack` 后装入干净 `DSH_HOME` 的临时 profile，验证 host 半加载与 client bundle 上页。

## 9. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| 第三方包必须自产 lazy-CJS factory artifact（官方未发布该 preset） | 高 | Phase 0 先做**最小上页冒烟**：一个空的 `dsh.client` 插件渲染一行文本，确认 `__DSH_BOOT__` 接受该产物；参照知识库记录中同时声明 `dsh.bundle` + `dsh.client` 的社区独立包复刻格式 |
| slot 注册属激活期失败即响 | 中 | 严格 type-only 导入别家 slot 声明，不导入运行时值（bundle-purity 门禁） |
| `skills/list` 只含 user-invocable 技能 | 中 | 文档写明；`user-invocable: false` 的技能不出现，需要时另开 host 侧通道（非本期目标） |
| 草稿写入与用户输入竞争 | 中 | 一律以 `draftRev` 做 CAS + 只增删自己插入的 token |
| 面板遮挡输入框 | 低 | 使用 `conversation.input.overlay` 或 portal 定位；Phase 1 先用简单 popover |

## 10. 分期

- **Phase 0｜骨架冒烟**：包结构、`dsh.bundle` + `dsh.client`、空客户端组件上页、`--dump-config` 通过。
- **Phase 1｜配置与归类**：Host settings namespace + Config schema + 设置卡片（能建分类、归类技能）。此阶段结束即可用，只是还没有 dock 入口。
- **Phase 2｜dock 入口与选择**：`CategoryChip` + `DockRow` + `SkillPicker`，选中写入 `/name`；dock 固定项与排序生效。
- **Phase 3｜可选增强**：分类拖拽排序、批量多选、host 侧 `skill_category` 工具让模型辅助归类。

## 11. 已锁定的决策

1. **分类数据只存插件配置**（settings namespace `skill-dock`），不读不写 `SKILL.md`；不使用 frontmatter 作为种子或回退。
2. 采用单包双半架构（方案 A）；不自建 Typert Remote。
3. 技能调用复用内置 `/name` 通道，不新增模型可见输入、不新增 session 事件。
4. 通过官方 slot 扩展点注入 UI，不修改 DSH 仓库源码、不 hack DOM。
