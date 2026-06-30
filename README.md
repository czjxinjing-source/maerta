# desktop-pet

基于 Electron + Vite + React + TypeScript 的 Windows 桌宠项目。桌宠角色直接使用 `public/assets/pet.png`，不会用 Canvas、SVG 或纯代码去重画角色。

## 功能

- 透明窗口、无边框、始终置顶、跳过任务栏
- 鼠标拖拽移动，并自动保存位置
- 单击随机互动动作：跳动、点头、摇晃、害羞、轻转、被戳反应
- 双击打开应用启动菜单
- 从 `apps.json` 读取应用配置
- 支持启动 `.exe`、文件夹和网址
- 路径错误时显示提示，不会崩溃
- 菜单内可切换桌宠尺寸

## 安装与运行

```bash
npm install
npm run dev
```

`npm run dev` 会先构建未打包版本，再直接启动 `dist/win-unpacked/desktop-pet.exe`。

开发运行时，应用列表读取项目根目录的 [apps.json](C:/Users/Lenovo/Documents/Codex/2026-06-27/wei/desktop-pet/apps.json)。

## 构建与打包

```bash
npm run build
npm run package
```

`npm run package` 会执行 Windows NSIS 安装包构建。

## 素材替换

角色图片路径：
[public/assets/pet.png](C:/Users/Lenovo/Documents/Codex/2026-06-27/wei/desktop-pet/public/assets/pet.png)

替换时请保持：

- 建议使用透明背景 PNG
- 保持正面站立姿态
- 尽量留出完整发饰、裙摆和鞋子

## apps.json

`apps.json` 结构如下：

```json
[
  {
    "name": "微信",
    "path": "C:\\Program Files\\Tencent\\WeChat\\WeChat.exe"
  },
  {
    "name": "下载文件夹",
    "path": "C:\\Users\\Lenovo\\Downloads"
  },
  {
    "name": "哔哩哔哩",
    "path": "https://www.bilibili.com"
  }
]
```

打包后，程序会在首次运行时把默认配置复制到：

`%APPDATA%/desktop-pet/apps.json`

后续修改这个用户配置文件即可。

## 后续想继续提升角色表现时建议补充的素材

当前项目已经能直接使用单张透明立绘完成桌宠。如果你要继续追求更接近原生宠物的表现，建议再补这些透明 PNG：

- `idle.png`
- `blink.png`
- `happy.png`
- `shy.png`
- `poke.png`
- `walk_1.png`
- `walk_2.png`

这样可以把现在的变换动画升级成逐帧动作。
