# 历史价格

Tampermonkey 用户脚本，在电商商品页右侧添加浮动按钮，点击弹出侧面板展示 ECharts 历史价格曲线图。数据来源：慢慢买（manmanbuy.com）。

## 安装

需要浏览器已安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展。

<a href="https://github.com/RAMBOO1990/price-history/raw/main/price-history.user.js">
  <img src="https://img.shields.io/badge/Install%20from-GitHub-181717?logo=github&style=for-the-badge" alt="从 GitHub 安装" height="36">
</a>

或直接点击：**[从 GitHub 安装](https://github.com/RAMBOO1990/price-history/raw/main/price-history.user.js)**

## 使用

1. 打开支持的商品页（如 `item.jd.com/xxx.html`），右侧出现红色浮动按钮
2. 点击按钮展开历史价格面板
3. 首次使用需配置 Cookie，通过 Tampermonkey 菜单「⚙ 设置」打开设置面板

### Cookie 获取

在浏览器打开 [tool.manmanbuy.com](https://tool.manmanbuy.com)，F12 → Console，执行 `copy(document.cookie)`，粘贴到脚本设置中。

## 功能

- 历史价格曲线图（ECharts）
- 当前价/历史最低/最高价摘要
- 隐藏脚本浮动按钮
- 隐藏平台楼层导航
- 可配置 Cookie 与密钥更新

## 支持平台

- 京东（`item.jd.com`）
- 天猫（`detail.tmall.com`）
- 淘宝（`item.taobao.com`）
