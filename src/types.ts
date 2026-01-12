/**
 * 类型定义文件
 */

// 文档类型
export interface Doc {
  id: string           // 唯一标识
  title: string        // 文档标题
  content: string      // 文档内容（HTML格式）
  createdAt: number    // 创建时间戳
  updatedAt: number    // 更新时间戳
}

// 对话消息类型
export interface Message {
  role: 'user' | 'assistant'  // 角色：用户或AI助手
  content: string              // 消息内容
}

// AI设置类型
export interface AISettings {
  apiUrl: string        // API地址（兼容OpenAI格式）
  apiKey: string        // API密钥
  model: string         // 模型名称
  systemPrompt: string  // 自定义系统提示词
}

// 知识库分类
export type KnowledgeCategory = 
  | '人物简介' 
  | '世界观' 
  | '剧情梗概' 
  | '章节梗概' 
  | '支线伏笔' 
  | '道具物品'
  | '场景地点'
  | '时间线'
  | '写作素材'

// 人物简介详情
export interface CharacterDetails {
  basicInfo: string      // 基本信息（姓名、年龄、外貌）
  biography: string      // 生平小传
  personality: string    // 性格特征
  abilities: string      // 能力技能
  relationships: string  // 人际关系
  notes: string          // 备注
}

// 世界观详情
export interface WorldDetails {
  overview: string       // 背景概述
  history: string        // 历史沿革
  rules: string          // 规则体系
  factions: string       // 势力分布
  geography: string      // 地理环境
  glossary: string       // 术语词典
}

// 剧情梗概详情
export interface PlotDetails {
  summary: string        // 故事简介
  conflict: string       // 核心冲突
  turningPoints: string  // 主要转折点
  ending: string         // 结局走向
}

// 章节梗概详情
export interface ChapterDetails {
  chapterTitle: string   // 章节标题
  timeline: string       // 时间线
  events: string         // 主要事件
  characters: string     // 涉及人物
  transition: string     // 承上启下
}

// 支线伏笔详情
export interface ForeshadowDetails {
  description: string    // 伏笔描述
  location: string       // 埋设位置（章节）
  revelation: string     // 预期揭示
  clues: string          // 关联线索
  status: '未揭示' | '已揭示'  // 状态
}

// 道具物品详情
export interface ItemDetails {
  appearance: string     // 外观描述
  origin: string         // 来源背景
  abilities: string      // 功能能力
  owner: string          // 持有者
  significance: string   // 剧情意义
}

// 场景地点详情
export interface LocationDetails {
  description: string    // 场景描写
  atmosphere: string     // 氛围特点
  history: string        // 历史背景
  inhabitants: string    // 相关人物
  events: string         // 发生事件
}

// 时间线详情
export interface TimelineDetails {
  date: string           // 时间点
  event: string          // 事件描述
  characters: string     // 相关人物
  impact: string         // 影响结果
  chapter: string        // 所在章节
}

// 写作素材详情
export interface MaterialDetails {
  content: string        // 素材内容
  source: string         // 来源
  usage: string          // 用途说明
  tags: string           // 标签
}

// 详情类型映射
export type DetailsMap = {
  '人物简介': CharacterDetails
  '世界观': WorldDetails
  '剧情梗概': PlotDetails
  '章节梗概': ChapterDetails
  '支线伏笔': ForeshadowDetails
  '道具物品': ItemDetails
  '场景地点': LocationDetails
  '时间线': TimelineDetails
  '写作素材': MaterialDetails
}

// 知识库条目类型
export interface KnowledgeEntry {
  id: string
  category: KnowledgeCategory
  title: string
  keywords: string[]
  details: DetailsMap[KnowledgeCategory]
}

// 各分类的字段配置
export const CATEGORY_FIELDS: Record<KnowledgeCategory, { key: string; label: string }[]> = {
  '人物简介': [
    { key: 'basicInfo', label: '基本信息' },
    { key: 'biography', label: '生平小传' },
    { key: 'personality', label: '性格特征' },
    { key: 'abilities', label: '能力技能' },
    { key: 'relationships', label: '人际关系' },
    { key: 'notes', label: '备注' },
  ],
  '世界观': [
    { key: 'overview', label: '背景概述' },
    { key: 'history', label: '历史沿革' },
    { key: 'rules', label: '规则体系' },
    { key: 'factions', label: '势力分布' },
    { key: 'geography', label: '地理环境' },
    { key: 'glossary', label: '术语词典' },
  ],
  '剧情梗概': [
    { key: 'summary', label: '故事简介' },
    { key: 'conflict', label: '核心冲突' },
    { key: 'turningPoints', label: '主要转折点' },
    { key: 'ending', label: '结局走向' },
  ],
  '章节梗概': [
    { key: 'chapterTitle', label: '章节标题' },
    { key: 'timeline', label: '时间线' },
    { key: 'events', label: '主要事件' },
    { key: 'characters', label: '涉及人物' },
    { key: 'transition', label: '承上启下' },
  ],
  '支线伏笔': [
    { key: 'description', label: '伏笔描述' },
    { key: 'location', label: '埋设位置' },
    { key: 'revelation', label: '预期揭示' },
    { key: 'clues', label: '关联线索' },
    { key: 'status', label: '状态' },
  ],
  '道具物品': [
    { key: 'appearance', label: '外观描述' },
    { key: 'origin', label: '来源背景' },
    { key: 'abilities', label: '功能能力' },
    { key: 'owner', label: '持有者' },
    { key: 'significance', label: '剧情意义' },
  ],
  '场景地点': [
    { key: 'description', label: '场景描写' },
    { key: 'atmosphere', label: '氛围特点' },
    { key: 'history', label: '历史背景' },
    { key: 'inhabitants', label: '相关人物' },
    { key: 'events', label: '发生事件' },
  ],
  '时间线': [
    { key: 'date', label: '时间点' },
    { key: 'event', label: '事件描述' },
    { key: 'characters', label: '相关人物' },
    { key: 'impact', label: '影响结果' },
    { key: 'chapter', label: '所在章节' },
  ],
  '写作素材': [
    { key: 'content', label: '素材内容' },
    { key: 'source', label: '来源' },
    { key: 'usage', label: '用途说明' },
    { key: 'tags', label: '标签' },
  ],
}

// 创建空的详情对象
export function createEmptyDetails(category: KnowledgeCategory): DetailsMap[KnowledgeCategory] {
  const fields = CATEGORY_FIELDS[category]
  const details: Record<string, string> = {}
  fields.forEach(f => {
    details[f.key] = f.key === 'status' ? '未揭示' : ''
  })
  return details as unknown as DetailsMap[KnowledgeCategory]
}
