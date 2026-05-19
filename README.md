# Annotation Flowchart Builder

アノテーション用のタグセット、判定フロー、上書きルールを編集し、フローチャートと実行画面として使えるブラウザアプリです。

## 開発

```bash
npm install
npm run dev
```

PowerShell の実行ポリシーで `npm` が止まる場合は、Windows では次を使えます。

```bash
npm.cmd install
npm.cmd run dev
```

## 非公開データの扱い

タグセットやアノテーションルールはアプリ本体とは分離してください。

- 画面で編集したタグセットはブラウザの `localStorage` に自動保存されます。
- 共有やバックアップが必要なときは、アプリ内メニューの `入出力` からJSONを書き出してください。
- 非公開のJSONやルール定義は `private/` に置くとGitの対象外になります。
- `src/rules.ts` は公開用の空テンプレートです。非公開ルールを直接書き込まないでください。

## 公開時の注意

GitHubに上げる前に、次の確認をしてください。

```bash
git status --short
git check-ignore -v private/example.json
```

`node_modules/`、`dist/`、`private/`、ログファイルは `.gitignore` で除外しています。
