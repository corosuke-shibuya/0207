# Deep Dive MVP App Router実装マップ

## 1) ルーティング構成

```txt
app/
  deep-dive/
    layout.tsx              # Deep Dive専用ナビ
    page.tsx                # MVPダッシュボード
    actions.ts              # Server Actions
    timeline/page.tsx       # UC: 個人ログ蓄積
    people/page.tsx         # UC: 相手プロファイル管理
    coach/page.tsx          # UC: 事前相談/事後振り返り
    sessions/[id]/page.tsx  # UC: 相談結果詳細
    settings/
      page.tsx              # JSON export / 全削除
      reset-button.tsx      # 全削除操作

  api/deep-dive/
    coach/route.ts          # API経由で助言生成
    export/route.ts         # JSONエクスポート
    reset/route.ts          # 全削除
```

## 2) ドメイン層

```txt
lib/deep-dive/
  types.ts                  # strategy/drafts/postmortem型
  person-presets.ts         # Peopleプリセット
  store.ts                  # MVP用インメモリストア
  context.ts                # 直近ノート/類似セッション選定
  coach.ts                  # Responses API + JSON Schema
```

## 3) Server Actions

- `createNoteAction(formData)`
- `createPersonAction(formData)`
- `runCoachingAction(formData)`
- `exportAllDataAction()`
- `deleteAllDataAction()`

## 4) JSON出力仕様（UIレンダリング前提）

- `strategy`: `{ goal, principles[], do[], dont[], structure[] }`
- `drafts`: `[{ tone, message, why_it_works, risks }]`
- `expected_reactions`: `[{ reaction, how_to_respond }]`
- `postmortem` (POSTのみ): `{ what_happened, hypotheses[], next_time_plan[], micro_skill[] }`

## 5) Prismaスキーマ対応

`prisma/schema.prisma` は以下を含む形に更新済み:
- `User`
- `Note`
- `Person`
- `CoachingSession`
- `SessionContextNote`
- `Artifact`
- `SessionKind / SessionStatus / ArtifactType`

注: `store.ts` は Prisma優先で動作し、`DATABASE_URL` 未設定時はインメモリにフォールバックします。
Prisma永続化を有効化する場合は、`DATABASE_URL` を設定し `prisma db push` を実行してください。
