# wu_wei Decisions

更新日: 2026-08-14 (JST)

## 採用済み設計指針

### D-001 Web資産の依存関係を保つ

- HTML、CSS、JavaScript、Python／CGI、画像、template、server処理を個別に切り離して変更しない。
- DOM ID、class、event、script読込順、既存URL互換性を確認する。

### D-002 generated／minified資産を正本として直接編集しない

- 正本が不明な場合は推測せず調査する。
- 配布物を変更する場合は生成元と再生成手順を確認する。

### D-003 runtime dataと公開sourceを分離する

- `.env`、秘密情報、個人情報、問い合わせデータ、ログ、cache、backupはGitへ登録しない。
- example設定と実設定を区別する。

### D-004 本番操作を通常のコード変更から分離する

- 本番接続、upload、DB変更、cache削除、service再起動は個別承認対象とする。
- 本番公開ディレクトリで直接開発・commit・競合解消を行わない。

### D-005 branch運用を明示する

- 2026-08-14時点のremote既定branchは`master`である。
- 今回の文書はユーザー指示により`main`へ反映するため、`main`を`master`までfast-forwardする。
- remote既定branchの変更や`master`廃止は別の決定とする。

## 保留事項

- `main`／`master`の統一時期とremote既定branch。
- WORK開発コピーの再構築範囲。
