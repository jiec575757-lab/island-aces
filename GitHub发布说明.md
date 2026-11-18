# 发布到 GitHub Pages

这是纯静态游戏。发布后访问者只需浏览器，不需要安装 Node.js、不需要登录 GitHub。最高分和音效设置保存在各自浏览器，不会同步给其他玩家。

## 推荐：源码仓库与自动发布

1. 在自己的 GitHub 账号下创建公开仓库 `island-aces`。
2. 将本目录 `air-combat` **里面的文件**上传至仓库根目录，使根目录直接包含 `index.html`、`package.json`、`src/` 和 `.github/workflows/pages.yml`。不要上传上级《黑洞》项目、旧版本或 `artifacts/`。
3. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
4. 向 `main` 推送代码，或进入 **Actions → Publish game to GitHub Pages → Run workflow**。
5. 等待构建与部署完成后，Pages 页面会显示访问地址，格式是 `https://你的用户名.github.io/island-aces/`。

仓库自带的工作流运行核心及原版画面对照测试，再生成静态站点并发布。以后更新 `main`，网页随之自动更新。项目没有 npm 依赖，不需要上传 `node_modules`，也不需要配置访问密钥到工作流。

## 仅上传网页文件

运行 `npm run build:pages`，将 `dist/github-pages` 里的文件上传到仓库根目录。也可以解压提供的 `island-aces-github-pages.zip` 后上传解压内容；GitHub 不会自动解压上传的 ZIP。

在仓库 **Settings → Pages** 中选择 **Deploy from a branch → main → /(root)** 并保存。这个方法不需要自定义工作流；`.nojekyll` 已包含在发布文件中。

## 素材与路径

网页、模块、模型和文档使用相对路径，支持 GitHub Pages 的 `/island-aces/` 子路径和 HTTPS。无需运行 `server.cjs`。发布包包含模型检视页和来源记录，游戏运行不连接 Forge 或 CDN。

原始公开运行时与素材来源继续保存在 `reference/` 和 `制作说明.md`，新增玩法、界面与模型属于本地扩展。未给原作者素材附加新的开源许可证。
