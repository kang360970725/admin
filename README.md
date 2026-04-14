# README

`@umijs/max` 模板项目，更多功能参考 [Umi Max 简介](https://umijs.org/docs/max/introduce)

## 发布脚本

统一使用一键脚本，确保 `version-manifest.json` 与构建产物使用同一组 `APP_VERSION/APP_BUILD_ID`：

```bash
# 生产发布（示例）
yarn release:prod --version=2026.04.14 --buildId=prod-20260414173000 --notes='新增：运营成本模块上线，支持统一录入与统计口径。|优化：消息中心弱提示'
```

可选参数：

- `--forceRefresh=true|false` 默认 `true`
- `--title=版本更新说明`
- `--releasedAt=2026-04-14 17:30:00`
