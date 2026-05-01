# Note / Resource CGI 役割分担

WuWei の Note 保存とファイル受け渡しは、次の方針で分離する。

- ノート保存 = Note JSON と参照情報を保存する。
- ノート読み込み = 保存済み Note JSON を返す。
- ノートダウンロード = 保存済み Note JSON の参照先 upload ディレクトリを収集して ZIP 化する。
- ノートアップロード = ZIP 内の upload ディレクトリを復元し、Note JSON を保存する。

この分離により、通常の `save-note` は大きなファイルコピーを行わず、アップロード済みコンテンツの実体は `upload/` 配下の正本を参照する。

## 共通の CGI 入口

JavaScript は実行環境により CGI の配置を切り替える。

- ローカル: `/wu_wei2/cgi-bin/{name}.py`
- Linux サーバー: `/wu_wei2/server/{name}.cgi`

たとえば `save-note` は、ローカルでは `cgi-bin/save-note.py`、Linux サーバーでは `server/save-note.cgi` を呼ぶ。

## ノート保存

| 役務 | JavaScript | ローカル Python | Linux CGI | 概要 |
|---|---|---|---|---|
| 通常保存 | `wuwei.note.saveNote()` | `cgi-bin/save-note.py` | `server/save-note.cgi` | 現在の Note JSON を `note/YYYY/MM/DD/{note_uuid}/note.json` に保存する。upload 本体やサムネイルを note 配下へ複製しない。 |
| 保存メニュー | `menu.note.js save()` | 同上 | 同上 | UI の保存処理。保存成功後にノート名表示と snackbar を更新する。 |
| 公開前保存 | `menu.publish.js` | 同上 | 同上 | Publish 前に `saveNote()` を実行し、古い版の公開を防ぐ。 |

保存される Note JSON には、ノード、リンク、グループ、ページ、`resources[]` の参照定義を含める。アップロード済み Resource は `storage.files[]` の `area` と `path` で実体を参照する。

```text
data/{user_uuid}/note/YYYY/MM/DD/{note_uuid}/note.json
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/manifest.json
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/{original_file}
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/thumbnail.jpg
data/{user_uuid}/upload/YYYY/MM/DD/{upload_uuid}/preview.pdf
```

`preview.pdf` は Office 文書から LibreOffice/OpenOffice が生成する PDF プレビューであり、存在する場合だけ作成する。`thumbnail.jpg` は PDF、画像、または `preview.pdf` の先頭ページから作成する。

## ノート読み込み

| 役務 | JavaScript | ローカル Python | Linux CGI | 概要 |
|---|---|---|---|---|
| ノート読込 | `wuwei.note.loadNote()` | `cgi-bin/load-note.py` | `server/load-note.cgi` | 保存済み `note.json` を探し、`json_base64` をデコードして plain Note JSON を返す。 |
| ノート一覧 | `wuwei.note.listNote()` | `cgi-bin/list-note.py` | `server/list-note.cgi` | `json_base64` または `json` を持つ有効な `note.json` だけを一覧対象にする。 |
| ノート削除 | `wuwei.note.removeNote()` | `cgi-bin/remove-note.py` | `server/remove-note.cgi` | 指定 Note を削除または trash へ移動する。存在しない Note は一覧に出さない。 |

`load-note` は ZIP や Base64 bundle を生成しない。通常の画面復元に必要な Note JSON だけを返す。

## ノートダウンロード

| 役務 | JavaScript | ローカル Python | Linux CGI | 概要 |
|---|---|---|---|---|
| ダウンロード開始 | `menu.note.js downloadFile()` | `cgi-bin/export-note.py` | `server/export-note.cgi` | 現在ノートを保存してから、保存済み Note を ZIP として取得する。 |
| ZIP 生成 | `export-note` | `cgi-bin/export-note.py` | `server/export-note.cgi` | `note.json` と、Note JSON が参照する `upload/YYYY/MM/DD/{upload_uuid}/...` を ZIP に収集する。 |

ZIP の基本構造は次の通り。

```text
note.json
upload/YYYY/MM/DD/{upload_uuid}/manifest.json
upload/YYYY/MM/DD/{upload_uuid}/{original_file}
upload/YYYY/MM/DD/{upload_uuid}/thumbnail.jpg
upload/YYYY/MM/DD/{upload_uuid}/preview.pdf
```

ダウンロード時だけ参照先ファイルを収集するため、通常保存時に重いコピー処理を行わない。

## ノートアップロード/インポート

| 役務 | JavaScript | ローカル Python | Linux CGI | 概要 |
|---|---|---|---|---|
| ファイル選択 | `menu.note.js openFile()` | なし | なし | `<input type=file>` で `.zip`、`.json`、`.txt` などを選択する。 |
| ZIP インポート | `menu.note.js importZipFile()` | `cgi-bin/import-note.py` | `server/import-note.cgi` | ZIP 内の `upload/` を現在ユーザーの upload 配下へ復元し、`note.json` を保存して画面に展開する。 |
| JSON インポート | `menu.note.js importFile()` | `cgi-bin/import-note.py` またはブラウザ読込 | `server/import-note.cgi` | plain Note JSON を受け取り、Note として保存する。 |

インポート時は Note JSON 内の `user_uuid` を保存データの正本として扱わない。保存先ユーザーは実行時のログインユーザー、またはローカル開発環境の `guest` で決定する。

## アップロード Resource の manifest.json

アップロードごとの `manifest.json` は、アップロードディレクトリ内の実ファイル一覧と検証情報を持つ。

```json
{
  "id": "_upload_uuid",
  "type": "UploadManifest",
  "title": "表示名",
  "created_at": "2026-05-01T12:34:56+0900",
  "original": {
    "file": "original.docx",
    "display_name": "original.docx",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 41725,
    "sha256": "..."
  },
  "thumbnail": {
    "file": "thumbnail.jpg",
    "mime": "image/jpeg",
    "size": 10998,
    "sha256": "...",
    "display_size": "141x200"
  },
  "preview": {
    "file": "preview.pdf",
    "mime": "application/pdf",
    "size": 46918,
    "sha256": "...",
    "generated_by": "LibreOffice"
  }
}
```

`original.sha256` は同一ファイル判定に使う。既に同じ sha256 の upload が存在する場合、新しい upload 本体を重複保存せず、既存 upload ディレクトリを再利用する。

Resource JSON 側にも `storage.files[]` として同じ `sha256`、`area`、`path` を保存する。画面描画やダウンロードは Resource JSON を主に参照し、`manifest.json` は upload ディレクトリ単位の正本メタデータとして扱う。

## 保護ファイル配信

画面表示、Office/PDF プレビュー、サムネイル表示、ダウンロードは `data/` を直接公開せず、`load-file` を経由する。

```text
server/load-file.cgi?area=upload&path=YYYY/MM/DD/{upload_uuid}/thumbnail.jpg
cgi-bin/load-file.py?area=upload&path=YYYY/MM/DD/{upload_uuid}/preview.pdf
```

Linux サーバーでは `load-file.cgi` が認証、`area` 検証、相対パス検証、存在確認を行い、`X-Accel-Redirect` で nginx の internal location から実ファイルを配信する。
