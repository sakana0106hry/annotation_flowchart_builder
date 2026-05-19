# Annotation Flowchart Builder

アノテーション用のタグセット、判定フロー、上書きルールを作成・編集し、フローチャートと実行画面として使えるブラウザアプリです。

公開版:

https://sakana0106hry.github.io/annotation_flowchart/

## 主な機能

- 複数のタグセットを作成・切り替え
- タグ、タグ説明、系統、判定フロー、分岐、上書きルールを画面から編集
- 編集内容をブラウザの `localStorage` に自動保存
- フローチャートをSVG / PNG / Mermaidで出力
- アノテーション結果をCSVで出力
- タグセット単体またはタグセット全体をJSONで読み書き

## 使い方

1. 公開版URLを開く
2. 上部の `メニュー` を開く
3. `タグセット` で新規作成、複製、切り替えを行う
4. `基本情報`、`タグ管理`、`上書き`、左側の `ルール編集` で内容を編集する
5. 必要に応じて `入出力` からJSONを書き出す

公開版には非公開タグセットは含まれていません。必要なタグセットJSONを別途読み込んで使ってください。

## データ保存

画面上で編集した内容は、使用中のブラウザの `localStorage` に保存されます。

- 同じブラウザで再度開くと編集内容が残ります。
- 別PCや別ブラウザには自動では共有されません。
- 共有やバックアップが必要な場合は、`メニュー > 入出力 > 全体を保存` でJSONを書き出してください。
- JSONを受け取った人は、`メニュー > 入出力 > JSON読込` から読み込めます。

## 非公開データの扱い

タグセットやアノテーションルールが非公開情報の場合は、アプリ本体とは分離してください。

- 非公開のJSONやルール定義は `private/` に置くとGitの対象外になります。
- `src/rules.ts` は公開用の空テンプレートです。非公開ルールを直接書き込まないでください。
- GitHubにpushする前に `git status --short` で `private/` や非公開JSONが含まれていないことを確認してください。

## 開発

```bash
npm install
npm run dev
```

Windows PowerShell の実行ポリシーで `npm` が止まる場合:

```bash
npm.cmd install
npm.cmd run dev
```

## ビルド

通常ビルド:

```bash
npm run build
```

GitHub Pages向けビルド:

```bash
npm run build:pages
```

## デプロイ

`main` ブランチにpushすると、GitHub Actionsで自動ビルドされ、GitHub Pagesへ公開されます。

GitHub Pages:

https://sakana0106hry.github.io/annotation_flowchart/

## 公開前チェック

```bash
git status --short
git grep -n "非公開タグ名"
npm run build:pages
```

`node_modules/`、`dist/`、`private/`、ログファイルは `.gitignore` で除外しています。
