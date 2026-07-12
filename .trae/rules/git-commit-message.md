---
alwaysApply: true
scene: git_message
---

Git Commit 标题必须遵循 Conventional Commits 格式：

<type>(<scope>): <description>

其中：

type 类型：

- feat     新增功能
- fix      Bug 修复
- docs     文档修改
- refactor 代码重构
- perf     性能优化
- test     测试相关
- build    构建相关
- ci       CI/CD 修改
- chore    其他维护

scope 表示本次修改影响的模块或功能范围。

scope 要求：

- 必须填写，不允许省略。
- 使用英文或项目中的模块名称。
- 使用 PascalCase 或已有模块命名规范。
- 根据修改文件和功能自动判断。

例如：

feat(Function): 新增用户注册功能

fix(API): 修复接口请求异常

docs(README): 更新项目使用说明

refactor(UploadService): 重构上传服务逻辑


完整输出格式：

<type>(<scope>): <description>

- 使用中文描述本次变更。
- 每条变更使用 Markdown 无序列表。
- 不允许输出普通段落。
- 不输出额外解释。