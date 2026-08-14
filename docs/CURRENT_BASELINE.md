# wu_wei Current Baseline

記録日: 2026-08-14 (JST)

## Git baseline

- remote default branch: `master`
- latest operational baseline: `origin/master`
- code baseline commit: `744008b82323adb168a6ad233f041d0f1909c8fc`
- subject: `Keep PageMarker page when opening PDFs`
- 記録時点の`master` ahead/behind: `0/0`
- `origin/main`は`1488e52c02fcc56df55405862029d446e8c60aba`で、記録時点では`origin/master`の祖先かつ284 commit遅れていた。
- 今回のユーザー指示により、documentation反映時は`main`を`master`までfast-forwardしてから文書commitを追加する。
- 本文書を追加するdocumentation commitは自己参照を避けるため固定値として記録しない。最新値は`git rev-parse HEAD`で確認する。

## 正式入力と主要資産

|相対パス|用途|`origin/master` SHA-256|
|---|---|---|
|`README-resource-storage-runtime-policy-2026-05-19.txt`|resource保存・runtime方針|`5DBB46BF13A6F1DE2244E18B84E740B0D066A3725296C0B38A4A584AF34A3D46`|
|`index.html`|Web entry page|`C0CAD08FC7DE3CE75320E482C593362A66E07CE0F9D4B516E1DDF872E1C86344`|
|`cgi-bin/resource_common.py`|resource共通処理|`E3A30D7C8074EF0A2F75A4B60F599DE420CF8ACEA06A70DBFFA584225D148B1A`|
|`cgi-bin/list-resource.py`|resource一覧API|`931F92DEEFF2680F78592056A81AED30BD64E87462138B933FCD3300791CA89A`|
|`cgi-bin/load-note.py`|note読込API|`EC6E8D7E1EDB9C85151191EA80F13BD7F10BA1B2E0C892CFD3272DCA5DC4C983`|
|`manual/home/wuwei_home_spec.adoc`|home仕様|`53752453FEEF2056577E75CA5063FFB14908B80C5AF6430A47F3C44070384E53`|

正式成果物はWeb UI、CGI/API、manual及び静的資産で構成する。runtime data、認証情報、問い合わせ情報、ログは含めない。

## 検証状態とWORK差分

- `origin/master`の追跡ファイル数: 2,789
- 記録作業ではWeb、CGI、外部通信、フォーム送信のテストを実施していない。
- WORK側には主要baselineファイルが不足し、存在する`index.html`も`origin/master`と異なる。
- WORKを正本としてGITへ一括同期せず、今後の機能変更では必要ファイルを個別に比較する。
