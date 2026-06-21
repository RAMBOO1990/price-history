# 京东历史价格油猴脚本 — 技术方案

## 项目概述

Tampermonkey 用户脚本，在京东商品页右侧添加浮动按钮，点击弹出滑出面板，展示 ECharts 历史价格曲线图。数据源：慢慢买（manmanbuy.com）。

## 技术栈

- Tampermonkey API（GM_xmlhttpRequest, GM_setValue 等）
- ECharts 5.3.0（@require CDN）
- 内联 MD5 实现（无外部依赖）
- 内联 RC4 实现（用于反混淆 customRequest.js）

## API 认证流程

```
用户提供 Cookie → GM_setValue 存储
  → GET tool.manmanbuy.com/HistoryLowest.aspx?url=<京东链接>
    → 自动捕获 Set-Cookie 合并到 Cookie 字符串
    → 提取 <input id="ticket" value="hex串">
    → ticket 变换：最后4字符移到最前
    → 计算 token 签名
    → POST /api.ashx
       参数: method=getHistoryTrend&key=<京东URL>&t=<时间戳>&token=<MD5>
       Header: Cookie + Authorization: BasicAuth <变换后ticket>
```

## token 签名算法

来源：`customRequest.js` 反混淆

```
secret = GM_getValue('jd-ph.mmb.secret', 'c5c3f201a8e8fc634d37a766a0299218')
params.t = Date.now()
排序所有 key（字母序）
构建字符串：secret + encodeURI(k1) + encodeURI(v1) + ... + secret
全大写 → MD5 → 全大写 = token
```

密钥硬编码在 `customRequest.js` 中，所有人相同。如失效可通过设置面板「更新密钥」按钮在线重新提取。

## 关键实现细节

### Authorization 头

**必须是 `BasicAuth` 而不是 `Basic`。** 浏览器 Network 中观察到实际请求头为：
```
Authorization: BasicAuth D8DD2812A942...
```

### 图表渲染

参考 `https://mmbres.manmanbuy.com/pc_tool/echartsTrend.js`

数据格式：`[[timestamp, price, note], ...]`

ECharts 配置要点：
- `xAxis: { type: 'time', boundaryGap: false }`
- `series.data` 为 `[ts, price, note]` 三元组
- tooltip 显示日期、价格、优惠备注
- markLine 标记最高/最低价

### ECharts CDN

当前使用 `https://cdn.jsdelivr.net/npm/echarts@5.3.0/dist/echarts.min.js`。如被墙需更换。

## 密钥更新机制

从 `https://mmbres.manmanbuy.com/pc_tool/customRequest.js` 在线提取：

1. 正则提取 `__0xa3e63` 混淆数组
2. 执行 476 次 shift 洗牌
3. RC4 解密 `elements[0]`（密钥 `teCD`）
4. 存入 `GM_setValue('jd-ph.mmb.secret', secret)`

## 关键文件

- `jd-price-history.user.js` — 唯一源文件（~900 行）
- `AGENTS.md` — 本文档

## 调试

F12 Console 中 `[jd-ph]` 前缀日志包含：ticket、转换后 ticket、POST 数据(token)、价格摘要、错误信息。
