# wu_wei Handoff

更新日: 2026-08-14 (JST)

## 前回作業の結果

- 最新のoperational baselineは`origin/master`の`744008b82323adb168a6ad233f041d0f1909c8fc`である。
- PDFを開いた際にPageMarker pageを維持する変更まで反映されている。
- note、resource、upload、search、login等のWeb／CGI資産を同一repositoryで管理している。

## 現在の注意事項

- remote既定branchは`master`である一方、`main`も存在する。
- 今回は明示指示に従い`main`を`master`までfast-forwardして文書をpushするが、remote既定branchの変更は行わない。
- WORK側には主要ファイルが不足しているため、WORKだけを使った回帰確認はできない。
- 本番通信、フォーム送信、メール、DB、外部APIを無断実行しない。

## 次の作業

1. `main`と`master`の長期運用方針を決定する。
2. WORKに必要な開発対象だけを選択同期する。
3. PageMarker、note、resource、home galleryの代表回帰条件を文書化する。
4. JavaScript／Python／CGI構文、主要画面、狭幅表示、404、文字化けを確認する。

## 未完了・未確認

- remote既定branchを`main`へ変更するかは未決定。
- WORKと`origin/master`の全差分は未調査。
- 本文書作成時にブラウザー・本番検証は実施していない。
