整理すると、`save/load` はサーバー保存用、`download/upload` はノートファイル受け渡し用です。対応は次の通りです。

**共通の入口**
`JavaScript` は実行環境で CGI を切り替えています。

- [wuwei.util.js](C:/Apache24/htdocs/wu_wei2/app2/misc/wuwei.util.js:3113)

- ローカル: `/wu_wei2/cgi-bin/{name}.py`

- Linux サーバー: `/wu_wei2/server/{name}.cgi`

つまり `save-note` なら、ローカルは `cgi-bin/save-note.py`、サーバーは `server/save-note.cgi` です。

**ノート保存**
| 役務 | JavaScript | ローカル Python | Linux CGI | 概要 |
|---|---|---|---|---|
| 通常保存 | [wuwei.note.js](C:/Apache24/htdocs/wu_wei2/app2/model/wuwei.note.js:927) `saveNote()` | [save-note.py](C:/Apache24/htdocs/wu_wei2/cgi-bin/save-note.py:449) | [save-note.cgi](C:/Apache24/htdocs/wu_wei2/server/save-note.cgi:2) | 現在の note JSON を `note.json` に保存。`resources[]` も保存し、thumbnail/preview は note snapshot に保存。original は通常 `upload/...` 参照のまま。 |
| 保存メニュー | [menu.note.js](C:/Apache24/htdocs/wu_wei2/app2/menu/note/menu.note.js:361) `save()` | 同上 | 同上 | UI の保存処理。保存成功後にノート名表示や snackbar を更新。 |
| 公開前保存 | [menu.publish.js](C:/Apache24/htdocs/wu_wei2/app2/menu/publish/menu.publish.js:17) | 同上 | 同上 | Publish 前に暗黙で `saveNote()` を実行して、古い版公開を防ぐ。 |

保存先は概ね次です。

```text
data/{user_uuid}/note/YYYY/MM/DD/{note_uuid}/note.json
data/{user_uuid}/note/YYYY/MM/DD/{note_uuid}/resource/{resource_uuid}/resource.json
data/{user_uuid}/note/YYYY/MM/DD/{note_uuid}/resource/{resource_uuid}/thumbnail.*
data/{user_uuid}/note/YYYY/MM/DD/{note_uuid}/resource/{resource_uuid}/preview.pdf
data/{user_uuid}/upload/YYYY/MM/DD/{uploaded_file_uuid}/{filename}
```

**ノート読み込み**
| 役務 | JavaScript | ローカル Python | Linux CGI | 概要 |
|---|---|---|---|---|
| ノート読込 | [wuwei.note.js](C:/Apache24/htdocs/wu_wei2/app2/model/wuwei.note.js:1121) `loadNote()` | [load-note.py](C:/Apache24/htdocs/wu_wei2/cgi-bin/load-note.py:1) | [load-note.cgi](C:/Apache24/htdocs/wu_wei2/server/load-note.cgi:1) | 保存済み `note.json` を探し、`json_base64` をデコードして Note JSON を返す。 |
| ノート一覧から開く | [menu.note.js](C:/Apache24/htdocs/wu_wei2/app2/menu/note/menu.note.js:535) `load()` | 同上 | 同上 | 一覧画面で選択した note_id を読み込み、`wuwei.note.updateNote()` で画面へ展開。 |
| portable bundle 生成 | [wuwei.note.js](C:/Apache24/htdocs/wu_wei2/app2/model/wuwei.note.js:1044) `exportPortableNoteText()` | [load-note.py](C:/Apache24/htdocs/wu_wei2/cgi-bin/load-note.py:90) | [load-note.cgi](C:/Apache24/htdocs/wu_wei2/server/load-note.cgi:106) | `bundle=1` 指定時、保存済みノートに `bundle.files[]` を付けて返す。 |

ここが重要で、**ダウンロード用 bundle を作るのは `load-note` 側**です。既にサーバーに保存済みのノートから、upload original と note snapshot の thumbnail/preview を読み出して、テキストファイル内に Base64 同梱します。

**ノートファイルのダウンロード**
| 役務 | JavaScript | CGI | 概要 |
|---|---|---|---|
| ダウンロード | [menu.note.js](C:/Apache24/htdocs/wu_wei2/app2/menu/note/menu.note.js:424) `downloadFile()` | まず `save-note`、次に `load-note?bundle=1` | 現在ノートを保存してから、`load-note` に `bundle=1` を渡して portable note text を取得し、ブラウザの Blob で `.txt` として保存。 |
| テキスト生成 | [wuwei.note.js](C:/Apache24/htdocs/wu_wei2/app2/model/wuwei.note.js:1044) | [load-note.py](C:/Apache24/htdocs/wu_wei2/cgi-bin/load-note.py:90) / [load-note.cgi](C:/Apache24/htdocs/wu_wei2/server/load-note.cgi:106) | `bundle.files[]` に Base64 ファイルを入れる。 |

つまりダウンロードは JavaScript だけでファイル保存していますが、**中身の portable bundle 生成はサーバーの `load-note` が担当**します。

**ノートファイルのアップロード/復元**
| 役務 | JavaScript | ローカル Python | Linux CGI | 概要 |
|---|---|---|---|---|
| ファイル選択 | [menu.note.js](C:/Apache24/htdocs/wu_wei2/app2/menu/note/menu.note.js:459) `openFile()` | なし | なし | `<input type=file>` を開く。 |
| ファイル読込 | [menu.note.js](C:/Apache24/htdocs/wu_wei2/app2/menu/note/menu.note.js:470) `importFile()` | なし | なし | ローカル `.txt` を `FileReader` で読み、JSON parse して画面へ展開。 |
| bundle 復元保存 | [menu.note.js](C:/Apache24/htdocs/wu_wei2/app2/menu/note/menu.note.js:498) | [save-note.py](C:/Apache24/htdocs/wu_wei2/cgi-bin/save-note.py:347) | [save-note.cgi](C:/Apache24/htdocs/wu_wei2/server/save-note.cgi:625) | `bundle.files[]` がある場合、`saveNote()` を呼び、サーバー側で Base64 を展開して `upload/...` と `note/resource/...` に復元。 |

ここはご指摘の通り少し名前が紛らわしいです。**読み込むのは JavaScript の `importFile()`、復元して保存するのは `save-note`** です。`load-note` は「サーバー上に既にあるノートを読む」処理なので、手元の `.txt` ファイルをサーバーへ復元する役務ではありません。

将来的により明快にするなら、`import-note.py` / `import-note.cgi` を新設し、portable bundle 復元専用に分けるのがきれいです。現状は `save-note` が「通常保存」と「portable bundle 復元保存」の両方を担当しています。