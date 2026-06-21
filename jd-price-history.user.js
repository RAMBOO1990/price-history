// ==UserScript==
// @name         京东历史价格 - 慢慢买查价
// @namespace    https://github.com/ramboo/jd-price-history
// @version      2.0
// @description  京东商品页展示历史价格曲线图（数据来源：慢慢买，需配置Cookie）
// @author       ramboo
// @match        https://item.jd.com/*
// @icon         https://www.jd.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @require      https://lf6-cdn-tos.bytecdntp.com/cdn/expire-1-M/echarts/5.3.0-rc.1/echarts.common.min.js
// @connect      manmanbuy.com
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    /* ============================================================
     *  配置
     * ============================================================ */
    const CONFIG = {
        btnSize: 46,
        panelWidth: 520,
        color: '#E4393C',
        colorHover: '#C1272D',
        animDuration: 300,
    };

    const MMB_COOKIE_KEY = 'jd-ph.mmb.cookie';
    const MMB_URL = 'https://tool.manmanbuy.com/HistoryLowest.aspx?url=';

    /* ============================================================
     *  URL 处理
     * ============================================================ */
    function getCleanJdUrl() {
        var m = location.href.match(/^(https?:\/\/item\.jd\.com\/\d+\.html)/i);
        if (m) return m[1];
        return location.href.replace(/[?#].*$/, '');
    }

    /* ============================================================
     *  CSS 注入
     * ============================================================ */
    var css = [
        // ---- 遮罩 ----
        '#jd-ph-overlay {',
            'position:fixed;top:0;left:0;width:100%;height:100%;',
            'background:rgba(0,0,0,.45);z-index:999998;',
            'opacity:0;transition:opacity ' + CONFIG.animDuration + 'ms ease;',
            'pointer-events:none;',
        '}',
        '#jd-ph-overlay.active {',
            'opacity:1;pointer-events:auto;',
        '}',

        // ---- 浮动按钮 ----
        '#jd-ph-btn {',
            'position:fixed;right:0;top:35%;z-index:999997;',
            'width:' + CONFIG.btnSize + 'px;height:' + CONFIG.btnSize + 'px;',
            'background:' + CONFIG.color + ';color:#fff;',
            'border-radius:' + (CONFIG.btnSize / 2) + 'px 0 0 ' + (CONFIG.btnSize / 2) + 'px;',
            'cursor:pointer;display:flex;align-items:center;justify-content:center;',
            'font-size:18px;font-weight:700;box-shadow:-2px 2px 6px rgba(0,0,0,.2);',
            'transition:background .2s,transform .2s;user-select:none;',
        '}',
        '#jd-ph-btn:hover {',
            'background:' + CONFIG.colorHover + ';transform:scale(1.08);',
        '}',
        '#jd-ph-btn .jd-ph-btn-icon {',
            'writing-mode:vertical-lr;letter-spacing:2px;font-size:14px;line-height:1.3;',
        '}',
        '#jd-ph-btn .jd-ph-btn-tip {',
            'position:absolute;right:52px;top:50%;transform:translateY(-50%);',
            'background:rgba(0,0,0,.75);color:#fff;font-size:12px;',
            'padding:4px 10px;border-radius:4px;white-space:nowrap;',
            'opacity:0;pointer-events:none;transition:opacity .2s;',
        '}',
        '#jd-ph-btn:hover .jd-ph-btn-tip {',
            'opacity:1;',
        '}',

        // ---- 面板 ----
        '#jd-ph-panel {',
            'position:fixed;top:0;right:-' + CONFIG.panelWidth + 'px;',
            'width:' + CONFIG.panelWidth + 'px;height:100%;',
            'background:#fff;z-index:999999;',
            'box-shadow:-4px 0 20px rgba(0,0,0,.15);',
            'transition:right ' + CONFIG.animDuration + 'ms ease;',
            'display:flex;flex-direction:column;',
            'font-family:"Microsoft YaHei","PingFang SC",sans-serif;',
        '}',
        '#jd-ph-panel.open { right:0; }',

        // ---- 面板头部 ----
        '#jd-ph-header {',
            'display:flex;align-items:center;justify-content:space-between;',
            'padding:12px 16px;border-bottom:1px solid #eee;flex-shrink:0;',
        '}',
        '#jd-ph-header .jd-ph-header-left {',
            'display:flex;align-items:center;gap:8px;',
        '}',
        '#jd-ph-header h3 {',
            'margin:0;font-size:15px;color:#333;font-weight:600;',
        '}',
        '#jd-ph-header .jd-ph-header-actions {',
            'display:flex;align-items:center;gap:6px;',
        '}',
        '#jd-ph-header .jd-ph-icon-btn {',
            'width:30px;height:30px;border-radius:50%;border:none;',
            'background:#f5f5f5;cursor:pointer;display:flex;',
            'align-items:center;justify-content:center;',
            'font-size:14px;color:#999;transition:all .2s;line-height:1;',
        '}',
        '#jd-ph-header .jd-ph-icon-btn:hover {',
            'background:' + CONFIG.color + ';color:#fff;',
        '}',

        // ---- 面板内容 ----
        '#jd-ph-body {',
            'flex:1;overflow:auto;padding:0;',
            'display:flex;flex-direction:column;align-items:center;justify-content:center;',
        '}',
        '#jd-ph-body .jd-ph-body-inner {',
            'width:100%;padding:16px;box-sizing:border-box;',
        '}',
        '#jd-ph-chart-box {',
            'width:100%;height:380px;',
        '}',

        // ---- 加载状态 ----
        '.jd-ph-spinner {',
            'width:36px;height:36px;border:3px solid #eee;',
            'border-top-color:' + CONFIG.color + ';border-radius:50%;',
            'animation:jd-ph-spin .8s linear infinite;',
        '}',
        '@keyframes jd-ph-spin { to { transform:rotate(360deg); } }',
        '.jd-ph-loading-text {',
            'margin-top:12px;color:#999;font-size:13px;',
        '}',

        // ---- 错误状态 ----
        '.jd-ph-error {',
            'text-align:center;color:#999;padding:30px 20px;',
        '}',
        '.jd-ph-error .jd-ph-error-icon {',
            'font-size:40px;margin-bottom:8px;color:#ddd;',
        '}',
        '.jd-ph-error p { margin:0 0 6px;font-size:13px; }',
        '.jd-ph-error .jd-ph-error-detail { font-size:12px;color:#bbb; }',
        '.jd-ph-error .jd-ph-btn {',
            'margin-top:12px;padding:6px 20px;border:1px solid ' + CONFIG.color + ';',
            'background:#fff;color:' + CONFIG.color + ';border-radius:4px;',
            'cursor:pointer;font-size:13px;display:inline-block;',
        '}',
        '.jd-ph-error .jd-ph-btn:hover { background:#fef0ef; }',

        // ---- 价格信息 ----
        '.jd-ph-price-info {',
            'display:flex;justify-content:space-around;padding:10px 0 14px;',
            'font-size:12px;color:#666;border-bottom:1px solid #f0f0f0;margin-bottom:10px;',
        '}',
        '.jd-ph-price-info .jd-ph-price-item { text-align:center; }',
        '.jd-ph-price-info .jd-ph-price-label { color:#999;margin-bottom:2px; }',
        '.jd-ph-price-info .jd-ph-price-value { color:#333;font-weight:600;font-size:14px; }',
        '.jd-ph-price-info .jd-ph-price-value.high { color:#E4393C; }',
        '.jd-ph-price-info .jd-ph-price-value.low { color:#28a745; }',

        // ---- 底部链接 ----
        '#jd-ph-footer {',
            'padding:10px 16px;border-top:1px solid #eee;text-align:center;flex-shrink:0;',
        '}',
        '#jd-ph-footer a {',
            'color:' + CONFIG.color + ';font-size:12px;text-decoration:none;',
        '}',
        '#jd-ph-footer a:hover { text-decoration:underline; }',

        // ---- 设置弹窗 ----
        '#jd-ph-settings {',
            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);',
            'width:440px;max-width:90vw;background:#fff;border-radius:10px;',
            'z-index:1000000;box-shadow:0 8px 40px rgba(0,0,0,.25);',
            'padding:24px;font-family:"Microsoft YaHei","PingFang SC",sans-serif;',
            'display:none;',
        '}',
        '#jd-ph-settings.open { display:block; }',
        '#jd-ph-settings h2 {',
            'margin:0 0 6px;font-size:17px;color:#333;',
        '}',
        '#jd-ph-settings .jd-ph-settings-desc {',
            'font-size:12px;color:#999;line-height:1.7;margin:0 0 14px;',
        '}',
        '#jd-ph-settings .jd-ph-settings-desc code {',
            'background:#f5f5f5;padding:1px 5px;border-radius:3px;font-size:11px;',
        '}',
        '#jd-ph-settings textarea {',
            'width:100%;height:100px;border:1px solid #ddd;border-radius:6px;',
            'padding:10px;font-size:12px;font-family:monospace;resize:vertical;',
            'box-sizing:border-box;outline:none;transition:border-color .2s;',
        '}',
        '#jd-ph-settings textarea:focus { border-color:' + CONFIG.color + ';}',
        '#jd-ph-settings .jd-ph-settings-actions {',
            'display:flex;gap:8px;margin-top:12px;',
        '}',
        '#jd-ph-settings .jd-ph-btn-primary {',
            'padding:7px 20px;background:' + CONFIG.color + ';color:#fff;',
            'border:none;border-radius:5px;cursor:pointer;font-size:13px;flex:1;',
        '}',
        '#jd-ph-settings .jd-ph-btn-primary:hover { background:' + CONFIG.colorHover + ';}',
        '#jd-ph-settings .jd-ph-btn-secondary {',
            'padding:7px 20px;background:#f5f5f5;color:#666;',
            'border:none;border-radius:5px;cursor:pointer;font-size:13px;',
        '}',
        '#jd-ph-settings .jd-ph-btn-secondary:hover { background:#e8e8e8; }',
        '#jd-ph-settings .jd-ph-btn-danger {',
            'padding:7px 20px;background:#fff;color:#E4393C;',
            'border:1px solid #E4393C;border-radius:5px;cursor:pointer;font-size:13px;',
        '}',
        '#jd-ph-settings .jd-ph-btn-danger:hover { background:#fef0ef; }',
        '#jd-ph-settings .jd-ph-settings-status {',
            'margin-top:10px;padding:8px 12px;border-radius:5px;font-size:12px;display:none;',
        '}',
        '#jd-ph-settings .jd-ph-settings-status.success {',
            'display:block;background:#e8f8e6;color:#28a745;',
        '}',
        '#jd-ph-settings .jd-ph-settings-status.error {',
            'display:block;background:#fef0ef;color:#E4393C;',
        '}',
        '#jd-ph-settings .jd-ph-settings-status.loading {',
            'display:block;background:#f0f7ff;color:#1890ff;',
        '}',

    ].join('\n');

    GM_addStyle(css);

    /* ============================================================
     *  DOM 工具
     * ============================================================ */
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                if (k === 'className') node.className = attrs[k];
                else if (k === 'style') node.style.cssText = attrs[k];
                else if (k === 'htmlFor') node.htmlFor = attrs[k];
                else node.setAttribute(k, attrs[k]);
            });
        }
        if (children) {
            (Array.isArray(children) ? children : [children]).forEach(function (c) {
                if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
            });
        }
        return node;
    }

    /* ============================================================
     *  通用工具
     * ============================================================ */
    function dateFormat(date, fmt) {
        var o = {
            'M+': date.getMonth() + 1,
            'd+': date.getDate(),
            'H+': date.getHours(),
            'm+': date.getMinutes(),
            's+': date.getSeconds(),
        };
        if (/(y+)/.test(fmt))
            fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp('(' + k + ')').test(fmt))
                fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
        return fmt;
    }

    function syncRequest(opt) {
        return new Promise(function (resolve, reject) {
            opt.onload = function (res) { resolve(res); };
            opt.onerror = function (res) { reject(res); };
            opt.ontimeout = function (res) { reject(res); };
            GM_xmlhttpRequest(opt);
        });
    }

    /* ============================================================
     *  Cookie 管理
     * ============================================================ */
    function getCookie() { return GM_getValue(MMB_COOKIE_KEY, ''); }
    function setCookie(c) { GM_setValue(MMB_COOKIE_KEY, c); }
    function clearCookie() { GM_deleteValue(MMB_COOKIE_KEY); }

    /* ============================================================
     *  设置弹窗
     * ============================================================ */
    var settingsEl = null;

    function showSettings() {
        if (!settingsEl) {
            settingsEl = el('div', { id: 'jd-ph-settings' }, [
                el('h2', null, ['Cookie 设置']),
                el('p', { className: 'jd-ph-settings-desc' }, [
                    '请粘贴从慢慢买网站获取的 Cookie 字符串。',
                    el('br'),
                    '获取方式：在浏览器打开 ',
                    el('code', null, ['https://tool.manmanbuy.com']),
                    '，F12 \u2192 Application \u2192 Cookies，复制所有 Cookie 值。',
                ]),
                el('textarea', { id: 'jd-ph-cookie-input', placeholder: '粘贴 Cookie 字符串...' }),
                el('div', { className: 'jd-ph-settings-actions' }, [
                    el('button', { className: 'jd-ph-btn-primary', id: 'jd-ph-save-cookie' }, ['保存']),
                    el('button', { className: 'jd-ph-btn-secondary', id: 'jd-ph-clear-cookie' }, ['清除']),
                    el('button', { className: 'jd-ph-btn-secondary', id: 'jd-ph-close-settings' }, ['取消']),
                ]),
                el('div', { className: 'jd-ph-settings-status', id: 'jd-ph-settings-status' }),
            ]);
            document.body.appendChild(settingsEl);

            settingsEl.querySelector('#jd-ph-save-cookie').addEventListener('click', function () {
                var val = settingsEl.querySelector('#jd-ph-cookie-input').value.trim();
                if (!val) {
                    showSettingsStatus('error', '请输入 Cookie');
                    return;
                }
                setCookie(val);
                showSettingsStatus('success', 'Cookie 已保存');
                setTimeout(function () { hideSettings(); }, 1200);
            });

            settingsEl.querySelector('#jd-ph-clear-cookie').addEventListener('click', function () {
                clearCookie();
                settingsEl.querySelector('#jd-ph-cookie-input').value = '';
                showSettingsStatus('success', 'Cookie 已清除');
            });

            settingsEl.querySelector('#jd-ph-close-settings').addEventListener('click', hideSettings);
        }

        var existing = getCookie();
        if (existing) {
            settingsEl.querySelector('#jd-ph-cookie-input').value = existing;
        }
        settingsEl.classList.add('open');
        overlay.classList.add('active');
    }

    function hideSettings() {
        if (settingsEl) settingsEl.classList.remove('open');
        overlay.classList.remove('active');
    }

    function showSettingsStatus(type, msg) {
        var status = settingsEl.querySelector('#jd-ph-settings-status');
        status.className = 'jd-ph-settings-status ' + type;
        status.textContent = msg;
    }

    /* ============================================================
     *  状态管理
     * ============================================================ */
    var overlay, panel, btn, bodyEl, chartEl;
    var isOpen = false;
    var fetched = false;
    var isLoading = false;
    var cleanUrl = getCleanJdUrl();
    var currentData = null;  // 缓存的图表数据

    /* ============================================================
     *  UI 构建
     * ============================================================ */
    function buildUI() {
        overlay = el('div', { id: 'jd-ph-overlay' });

        var iconSpan = el('span', { className: 'jd-ph-btn-icon' }, ['历\n史\n价\n格']);
        var tipSpan = el('span', { className: 'jd-ph-btn-tip' }, ['查看历史价格']);
        btn = el('div', { id: 'jd-ph-btn' }, [iconSpan, tipSpan]);

        var closeBtn = el('button', { className: 'jd-ph-icon-btn', title: '关闭' }, ['\u00d7']);
        var settingsBtn = el('button', { className: 'jd-ph-icon-btn', title: 'Cookie设置' }, ['\u2699']);
        var header = el('div', { id: 'jd-ph-header' }, [
            el('div', { className: 'jd-ph-header-left' }, [
                el('h3', null, ['历史价格走势']),
            ]),
            el('div', { className: 'jd-ph-header-actions' }, [
                settingsBtn,
                closeBtn,
            ]),
        ]);

        bodyEl = el('div', { id: 'jd-ph-body' });

        var footer = el('div', { id: 'jd-ph-footer' }, [
            el('a', { href: 'https://tool.manmanbuy.com/', target: '_blank', rel: 'noopener' }, [
                '数据来源：慢慢买 \u2197'
            ]),
        ]);

        panel = el('div', { id: 'jd-ph-panel' }, [header, bodyEl, footer]);
        document.body.appendChild(overlay);
        document.body.appendChild(panel);
        document.body.appendChild(btn);

        btn.addEventListener('click', togglePanel);
        overlay.addEventListener('click', closePanel);
        closeBtn.addEventListener('click', closePanel);
        settingsBtn.addEventListener('click', function() { showSettings(); });
    }


    /* ============================================================
     *  面板开关
     * ============================================================ */
    function togglePanel() {
        isOpen ? closePanel() : openPanel();
    }

    function openPanel() {
        isOpen = true;
        overlay.classList.add('active');
        panel.classList.add('open');
        // 没有 Cookie 时弹出设置
        if (!getCookie()) {
            showSettings();
            return;
        }
        if (!fetched && !isLoading) {
            fetchChart();
        }
    }

    function closePanel() {
        isOpen = false;
        overlay.classList.remove('active');
        panel.classList.remove('open');
    }

    /* ============================================================
     *  展示状态
     * ============================================================ */
    function showLoading() {
        isLoading = true;
        bodyEl.innerHTML = '';
        bodyEl.style.display = 'flex';
        bodyEl.appendChild(el('div', { style: 'text-align:center;' }, [
            el('div', { className: 'jd-ph-spinner' }),
            el('p', { className: 'jd-ph-loading-text' }, ['正在查询历史价格...']),
        ]));
    }

    function showChart(categories, prices, meta) {
        fetched = true;
        isLoading = false;
        bodyEl.innerHTML = '';
        bodyEl.style.display = 'block';

        // 价格摘要
        var infoHtml = '<div class="jd-ph-price-info">';
        infoHtml += '<div class="jd-ph-price-item"><div class="jd-ph-price-label">当前价</div><div class="jd-ph-price-value">¥' + meta.current + '</div></div>';
        infoHtml += '<div class="jd-ph-price-item"><div class="jd-ph-price-label">历史最低</div><div class="jd-ph-price-value low">¥' + meta.lowest + '</div></div>';
        infoHtml += '<div class="jd-ph-price-item"><div class="jd-ph-price-label">最高</div><div class="jd-ph-price-value high">¥' + meta.highest + '</div></div>';
        infoHtml += '</div>';

        bodyEl.innerHTML = '<div class="jd-ph-body-inner">' + infoHtml + '<div id="jd-ph-chart-box"></div></div>';

        var chartDom = document.getElementById('jd-ph-chart-box');
        var myChart = echarts.init(chartDom);
        myChart.setOption({
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'time', boundaryGap: false },
            yAxis: { type: 'value', min: function(v) { return v.min - 50; } },
            series: [{
                type: 'line', data: prices, smooth: true,
                lineStyle: { color: '#E4393C', width: 2 },
                areaStyle: { color: 'rgba(228,57,60,0.1)' },
                showSymbol: false,
            }]
        });
    }

    function showError(msg, canRetry) {
        isLoading = false;
        bodyEl.innerHTML = '';
        bodyEl.style.display = 'flex';
        var children = [
            el('div', { className: 'jd-ph-error-icon' }, ['!']),
            el('p', null, ['获取历史价格失败']),
            el('p', { className: 'jd-ph-error-detail' }, [msg || '请稍后重试']),
        ];
        if (canRetry) {
            var retryBtn = el('button', {
                style: [
                    'margin-top:16px;padding:8px 24px;border:1px solid ' + CONFIG.color + ';',
                    'background:#fff;color:' + CONFIG.color + ';border-radius:4px;',
                    'cursor:pointer;font-size:14px;'
                ].join(''),
            }, ['重试']);
            children.push(retryBtn);
        }
        var errorEl = el('div', { className: 'jd-ph-error' }, children);
        bodyEl.appendChild(errorEl);

        if (canRetry) {
            errorEl.querySelector('button').addEventListener('click', function () {
                fetchChart();
            });
        }
    }

    function showFallback() {
        fetched = true;
        isLoading = false;
        bodyEl.innerHTML = '';
        bodyEl.style.display = 'block';
        var iframe = el('iframe', {
            src: MMB_URL + encodeURIComponent(getCleanJdUrl()),
            style: 'width:100%;flex:1;border:none;border-radius:6px;min-height:500px;',
            sandbox: 'allow-scripts allow-same-origin',
        });
        bodyEl.appendChild(iframe);
    }

    /* ============================================================
     *  数据获取与解析
     * ============================================================ */
    function fetchChart() {
        showLoading();
        var jdUrl = getCleanJdUrl();
        var cookie = getCookie();

        GM_xmlhttpRequest({
            method: 'GET',
            url: MMB_URL + encodeURIComponent(jdUrl),
            headers: { 'Cookie': cookie, 'User-Agent': navigator.userAgent },
            onload: function(pageRes) {
                if (pageRes.status !== 200) { showError('页面加载失败', true); return; }
                var html = pageRes.responseText;
                // 提取 ticket
                var m = html.match(/id="ticket" value="([^"]+)"/);
                if (!m) { showError('无法获取票据，请确认Cookie是否有效', true); return; }
                var ticket = m[1];
                if (ticket.length > 4) ticket = ticket.substr(ticket.length - 4, 4) + ticket.substr(0, ticket.length - 4);

                // 调 API
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://tool.manmanbuy.com/api.ashx',
                    data: 'method=getHistoryTrend&key=' + encodeURIComponent(jdUrl),
                    headers: {
                        'Cookie': cookie,
                        'Authorization': 'Basic ' + ticket,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': navigator.userAgent,
                    },
                    onload: function(apiRes) {
                        try {
                            var ret = JSON.parse(apiRes.responseText);
                            if (ret.code !== 0 || !ret.data || !ret.data.datePrice) {
                                showError(ret.msg || '暂无价格数据', true);
                                return;
                            }
                            // 解析 datePrice: "[ts1,p1,''],[ts2,p2,'']"
                            var rawData = eval('([' + ret.data.datePrice + '])');
                            var categories = rawData.map(function(d) { return new Date(d[0]); });
                            var prices = rawData.map(function(d) { return d[1]; });
                            var highest = Math.max.apply(null, prices);
                            var lowest = Math.min.apply(null, prices);
                            showChart(categories, prices, {
                                current: prices[prices.length - 1],
                                highest: highest,
                                lowest: lowest
                            });
                        } catch(e) {
                            showError('数据解析失败: ' + e.message, true);
                        }
                    },
                    onerror: function() { showError('API请求失败，尝试iframe降级', false); showFallback(); },
                });
            },
            onerror: function() { showError('页面请求失败，请检查Cookie', true); },
            ontimeout: function() { showError('请求超时', true); },
        });
    }



    /* ============================================================
     *  初始化
     * ============================================================ */
    function init() {
        // 确认是商品详情页（包含数字ID + .html）
        if (!/item\.jd\.com\/\d+\.html/i.test(location.href)) return;
        buildUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
