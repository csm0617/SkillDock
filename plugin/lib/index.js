/**
 * SkillDock — Host half.
 *
 * Owns the `skill-dock` settings namespace: the durable home of skill
 * categories, aliases, dock pins, and the entry-layout choice. Everything the
 * browser half renders is derived from this one section; nothing here touches
 * skill loading or invocation semantics.
 */

import Schema from '@deepseek-ai/schemastery'

export const name = 'skill-dock'

/** The settings service is optional: without it the plugin still loads, inert. */
export const inject = []

/** One user-defined category and the skills assigned to it. */
const CategorySchema = Schema.object({
  id: Schema.string().description('稳定 id（kebab-case），重命名不改 id').required(),
  name: Schema.string().description('展示名').required(),
  skills: Schema.array(Schema.string())
    .description('技能名（kebab-case）')
    .default([]),
})

export const Config = Schema.object({
  categories: Schema.array(CategorySchema)
    .description('分类定义与技能归属')
    .default([]),
  aliases: Schema.dict(Schema.string())
    .description('真名 -> 别名（仅展示与搜索，不参与调用）')
    .default({}),
  entry: Schema.object({
    layout: Schema.union([Schema.const('row'), Schema.const('chip')])
      .description("'row'=一排分类芯片（卡片上方整行，默认）；'chip'=单个总芯片（卡片内工具行右侧）")
      .default('row'),
  }).default({}),
  dock: Schema.object({
    pinned: Schema.array(Schema.string())
      .description('固定在 dock 行展示的分类 id，有序')
      .default([]),
  }).default({}),
  picker: Schema.object({
    showUncategorized: Schema.boolean().description('面板是否提供「未分类」入口').default(true),
    listLimit: Schema.number()
      .description('列表渲染上限')
      .step(1)
      .min(1)
      .default(200),
  }).default({}),
})

/** The settings namespace this plugin owns. */
export const NAMESPACE = 'skill-dock'

export function apply(ctx, config) {
  // The authoritative value: the composed entry until a settings scope attaches,
  // then whatever the settings service resolves. `setSource`/`onChange` keep this
  // thunk honest for any host-side reader.
  let source = () => config

  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NAMESPACE, Config, config, {
      setSource: (current) => {
        source = current
      },
      onChange: () => {
        // Host-side readers (none yet) would re-derive here.
        void source()
      },
    })
  })
}
