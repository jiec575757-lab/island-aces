# 界面像素字体

游戏中的中英文按钮、增益卡片、设置、通知、结算及模型检视页使用 **Fusion Pixel / 缝合像素字体**。保留原始 WOFF2 文件，通过本地 `@font-face` 加载；无需安装字体，不访问外部字体服务。

- 项目与作者：[TakWolf / Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)，Copyright (c) 2022, TakWolf。
- 版本：2026.11.10，12px proportional，简体中文 `zh_hans` 与 `latin` 字形。
- 原始发行包：[fusion-pixel-font-12px-proportional-otf.woff2-v2026.11.10.zip](https://github.com/TakWolf/fusion-pixel-font/releases/download/2026.11.10/fusion-pixel-font-12px-proportional-otf.woff2-v2026.11.10.zip)。
- 字体许可：SIL Open Font License 1.1，见 [OFL.txt](OFL.txt)。发行包附带的上游许可也完整保留：[Ark Pixel](ark-pixel-OFL.txt)、[Cubic 11](cubic-11-OFL.txt)、[Galmuri](galmuri-LICENSE.txt)。
- 原始下载地址、版本及 SHA256 见 [source.json](source.json)。字体文件未裁剪或修改；CSS 中的 `Island Pixel` 仅为应用内字体别名。

飞行状态 HUD 继续使用原有自绘 5×7 点阵字；两者均为像素风格。浏览器自身的地址栏、系统菜单与原生提示由浏览器控制。
