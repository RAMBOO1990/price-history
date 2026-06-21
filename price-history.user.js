// ==UserScript==
// @name         历史价格 - 慢慢买查价
// @namespace    https://github.com/ramboo1990/price-history
// @version      1.1
// @description  商品页展示历史价格曲线图（数据来源：慢慢买，需配置Cookie）
// @author       R9
// @match        https://item.jd.com/*
// @icon         https://www.jd.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @require      https://cdn.jsdelivr.net/npm/echarts@5.3.0/dist/echarts.min.js
// @connect      manmanbuy.com
// ==/UserScript==

(function () {
    'use strict';

    /* ============================================================
     *  配置
     * ============================================================ */
    const CONFIG = {
        btnSize: 46,
        btnWidth: 80,
        panelWidth: 520,
        color: '#E4393C',
        colorHover: '#C1272D',
        animDuration: 300,
    };

    const MMB_COOKIE_KEY = 'ph.mmb.cookie';
    const MMB_SECRET_KEY = 'ph.mmb.secret';
    const MMB_SECRET_TIME_KEY = 'ph.mmb.secret_time';
    const MMB_SECRET_DEFAULT = 'c5c3f201a8e8fc634d37a766a0299218';
    const BTN_HIDDEN_KEY = 'ph.btn.hidden';
    const ELEVATOR_HIDDEN_KEY = 'ph.elevator.hidden';
    const MMB_URL = 'https://tool.manmanbuy.com/HistoryLowest.aspx?url=';

    /* ============================================================
     *  平台配置
     * ============================================================ */
    var PLATFORMS = [
        {
            name: '京东',
            match: /item\.jd\.com\/\d+\.html/i,
            getCleanUrl: function () {
                var m = location.href.match(/^(https?:\/\/item\.jd\.com\/\d+\.html)/i);
                if (m) return m[1];
                return location.href.replace(/[?#].*$/, '');
            },
            elevatorSelector: '#elevator_from_common_component',
            icon: 'https://www.jd.com/favicon.ico',
        },
    ];
    var currentPlatform = null;

    /* ============================================================
     *  URL 处理
     * ============================================================ */
    function getCleanUrl() {
        if (currentPlatform && currentPlatform.getCleanUrl) {
            return currentPlatform.getCleanUrl();
        }
        return location.href.replace(/[?#].*$/, '');
    }

    /* ============================================================
     *  CSS 注入
     * ============================================================ */
    var css = [
        // ---- 遮罩 ----
        '#ph-overlay {',
            'position:fixed;top:0;left:0;width:100%;height:100%;',
            'background:rgba(0,0,0,.45);z-index:999998;',
            'opacity:0;transition:opacity ' + CONFIG.animDuration + 'ms ease;',
            'pointer-events:none;',
        '}',
        '#ph-overlay.active {',
            'opacity:1;pointer-events:auto;',
        '}',

        // ---- 浮动按钮 ----
        '#ph-btn {',
            'position:fixed;right:0;top:35%;z-index:999997;',
            'width:' + CONFIG.btnWidth + 'px;height:' + CONFIG.btnSize + 'px;',
            'background:' + CONFIG.color + ';color:#fff;',
            'border-radius:' + (CONFIG.btnSize / 2) + 'px 0 0 ' + (CONFIG.btnSize / 2) + 'px;',
            'cursor:pointer;display:flex;align-items:center;justify-content:center;',
            'font-weight:700;box-shadow:-2px 2px 6px rgba(0,0,0,.2);',
            'transition:background .2s,transform .2s;user-select:none;',
        '}',
        '#ph-btn:hover {',
            'background:' + CONFIG.colorHover + ';transform:scale(1.08);',
        '}',
        '#ph-btn .ph-btn-icon {',
            'font-size:13px;letter-spacing:1px;line-height:1;padding:0 2px;',
        '}',
        '#ph-btn .ph-btn-tip {',
            'position:absolute;right:' + (CONFIG.btnWidth + 6) + 'px;top:50%;transform:translateY(-50%);',
            'background:rgba(0,0,0,.75);color:#fff;font-size:12px;',
            'padding:4px 10px;border-radius:4px;white-space:nowrap;',
            'opacity:0;pointer-events:none;transition:opacity .2s;',
        '}',
        '#ph-btn:hover .ph-btn-tip {',
            'opacity:1;',
        '}',

        // ---- 面板 ----
        '#ph-panel {',
            'position:fixed;top:0;right:-' + CONFIG.panelWidth + 'px;',
            'width:' + CONFIG.panelWidth + 'px;height:100%;',
            'background:#fff;z-index:999999;',
            'box-shadow:-4px 0 20px rgba(0,0,0,.15);',
            'transition:right ' + CONFIG.animDuration + 'ms ease;',
            'display:flex;flex-direction:column;',
            'font-family:"Microsoft YaHei","PingFang SC",sans-serif;',
        '}',
        '#ph-panel.open { right:0; }',

        // ---- 面板头部 ----
        '#ph-header {',
            'display:flex;align-items:center;justify-content:space-between;',
            'padding:12px 16px;border-bottom:1px solid #eee;flex-shrink:0;',
        '}',
        '#ph-header .ph-header-left {',
            'display:flex;align-items:center;gap:8px;',
        '}',
        '#ph-header h3 {',
            'margin:0;font-size:15px;color:#333;font-weight:600;',
        '}',
        '#ph-header .ph-header-actions {',
            'display:flex;align-items:center;gap:6px;',
        '}',
        '#ph-header .ph-icon-btn {',
            'width:30px;height:30px;border-radius:50%;border:none;',
            'background:#f5f5f5;cursor:pointer;display:flex;',
            'align-items:center;justify-content:center;',
            'font-size:14px;color:#999;transition:all .2s;line-height:1;',
        '}',
        '#ph-header .ph-icon-btn:hover {',
            'background:' + CONFIG.color + ';color:#fff;',
        '}',

        // ---- 面板内容 ----
        '#ph-body {',
            'flex:1;overflow:auto;padding:0;',
            'display:flex;flex-direction:column;align-items:center;justify-content:center;',
        '}',
        '#ph-body .ph-body-inner {',
            'width:100%;padding:16px;box-sizing:border-box;',
        '}',
        '#ph-chart-box {',
            'width:100%;height:380px;',
        '}',

        // ---- 加载状态 ----
        '.ph-spinner {',
            'width:36px;height:36px;border:3px solid #eee;',
            'border-top-color:' + CONFIG.color + ';border-radius:50%;',
            'animation:ph-spin .8s linear infinite;',
        '}',
        '@keyframes ph-spin { to { transform:rotate(360deg); } }',
        '.ph-loading-text {',
            'margin-top:12px;color:#999;font-size:13px;',
        '}',

        // ---- 错误状态 ----
        '.ph-error {',
            'text-align:center;color:#999;padding:30px 20px;',
        '}',
        '.ph-error .ph-error-icon {',
            'font-size:40px;margin-bottom:8px;color:#ddd;',
        '}',
        '.ph-error p { margin:0 0 6px;font-size:13px; }',
        '.ph-error .ph-error-detail { font-size:12px;color:#bbb; }',
        '.ph-error .ph-btn {',
            'margin-top:12px;padding:6px 20px;border:1px solid ' + CONFIG.color + ';',
            'background:#fff;color:' + CONFIG.color + ';border-radius:4px;',
            'cursor:pointer;font-size:13px;display:inline-block;',
        '}',
        '.ph-error .ph-btn:hover { background:#fef0ef; }',

        // ---- 价格信息 ----
        '.ph-price-info {',
            'display:flex;justify-content:space-around;padding:10px 0 14px;',
            'font-size:12px;color:#666;border-bottom:1px solid #f0f0f0;margin-bottom:10px;',
        '}',
        '.ph-price-info .ph-price-item { text-align:center; }',
        '.ph-price-info .ph-price-label { color:#999;margin-bottom:2px; }',
        '.ph-price-info .ph-price-value { color:#333;font-weight:600;font-size:14px; }',
        '.ph-price-info .ph-price-value.high { color:#E4393C; }',
        '.ph-price-info .ph-price-value.low { color:#28a745; }',

        // ---- 底部链接 ----
        '#ph-footer {',
            'padding:10px 16px;border-top:1px solid #eee;text-align:center;flex-shrink:0;',
        '}',
        '#ph-footer a {',
            'color:' + CONFIG.color + ';font-size:12px;text-decoration:none;',
        '}',
        '#ph-footer a:hover { text-decoration:underline; }',

        // ---- 设置弹窗 ----
        '#ph-settings {',
            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);',
            'width:440px;max-width:90vw;background:#fff;border-radius:10px;',
            'z-index:1000000;box-shadow:0 8px 40px rgba(0,0,0,.25);',
            'padding:24px;font-family:"Microsoft YaHei","PingFang SC",sans-serif;',
            'display:none;',
        '}',
        '#ph-settings.open { display:block; }',
        '#ph-settings-header {',
            'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;',
        '}',
        '#ph-settings-header h2 { margin:0;font-size:17px;color:#333; }',
        '#ph-settings-close {',
            'width:30px;height:30px;border-radius:50%;border:none;',
            'background:#f5f5f5;cursor:pointer;display:flex;',
            'align-items:center;justify-content:center;',
            'font-size:16px;color:#999;transition:all .2s;line-height:1;flex-shrink:0;',
        '}',
        '#ph-settings-close:hover {',
            'background:' + CONFIG.color + ';color:#fff;',
        '}',
        '#ph-settings .ph-settings-desc {',
            'font-size:12px;color:#999;line-height:1.7;margin:0 0 14px;',
        '}',
        '#ph-settings .ph-settings-desc code {',
            'background:#f5f5f5;padding:1px 5px;border-radius:3px;font-size:11px;',
        '}',
        '#ph-settings textarea {',
            'width:100%;height:100px;border:1px solid #ddd;border-radius:6px;',
            'padding:10px;font-size:12px;font-family:monospace;resize:vertical;',
            'box-sizing:border-box;outline:none;transition:border-color .2s;',
        '}',
        '#ph-settings textarea:focus { border-color:' + CONFIG.color + ';}',
        '#ph-settings .ph-settings-actions {',
            'display:flex;gap:8px;margin-top:12px;',
        '}',
        '#ph-settings .ph-btn-primary {',
            'padding:7px 20px;background:' + CONFIG.color + ';color:#fff;',
            'border:none;border-radius:5px;cursor:pointer;font-size:13px;flex:1;',
        '}',
        '#ph-settings .ph-btn-primary:hover { background:' + CONFIG.colorHover + ';}',
        '#ph-settings .ph-btn-secondary {',
            'padding:7px 20px;background:#f5f5f5;color:#666;',
            'border:none;border-radius:5px;cursor:pointer;font-size:13px;',
        '}',
        '#ph-settings .ph-btn-secondary:hover { background:#e8e8e8; }',
        '#ph-settings .ph-btn-danger {',
            'padding:7px 20px;background:#fff;color:#E4393C;',
            'border:1px solid #E4393C;border-radius:5px;cursor:pointer;font-size:13px;',
        '}',
        '#ph-settings .ph-btn-danger:hover { background:#fef0ef; }',
        '#ph-settings .ph-settings-status {',
            'margin-top:10px;padding:8px 12px;border-radius:5px;font-size:12px;display:none;',
        '}',
        '#ph-settings .ph-settings-status.success {',
            'display:block;background:#e8f8e6;color:#28a745;',
        '}',
        '#ph-settings .ph-settings-status.error {',
            'display:block;background:#fef0ef;color:#E4393C;',
        '}',
        '#ph-settings .ph-settings-status.loading {',
            'display:block;background:#f0f7ff;color:#1890ff;',
        '}',

        // ---- 开关组件 ----
        '.ph-switch {',
            'position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;',
        '}',
        '.ph-switch input { opacity:0;width:0;height:0; }',
        '.ph-switch .ph-slider {',
            'position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;',
            'background:#ccc;border-radius:24px;transition:.3s;',
        '}',
        '.ph-switch .ph-slider:before {',
            'position:absolute;content:"";height:18px;width:18px;left:3px;bottom:3px;',
            'background:#fff;border-radius:50%;transition:.3s;',
        '}',
        '.ph-switch input:checked + .ph-slider { background:' + CONFIG.color + '; }',
        '.ph-switch input:checked + .ph-slider:before { transform:translateX(20px); }',
        '.ph-settings-section { margin-bottom:16px; }',
        '.ph-settings-section-title {',
            'font-size:13px;font-weight:600;color:#333;margin:0 0 8px;',
        '}',
        '.ph-settings-row {',
            'display:flex;align-items:center;justify-content:space-between;',
            'padding:8px 0;border-bottom:1px solid #f5f5f5;',
        '}',
        '.ph-settings-row:last-child { border-bottom:none; }',
        '.ph-settings-row label { font-size:13px;color:#333;cursor:pointer; }',

        // ---- 动态隐藏 JD 电梯 ----
        '#ph-elevator-style { display:none; }',

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
     *  MD5（由 js 实现，用于签名）
     * ============================================================ */
    var md5 = (function () {
        var rotateLeft = function (lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); };
        var addUnsigned = function (lX, lY) {
            var lX4, lY4, lX8, lY8, lResult;
            lX8 = (lX & 0x80000000); lY8 = (lY & 0x80000000);
            lX4 = (lX & 0x40000000); lY4 = (lY & 0x40000000);
            lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
            if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
            if (lX4 | lY4) {
                if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
                else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
            } else return (lResult ^ lX8 ^ lY8);
        };
        var _F = function (x, y, z) { return (x & y) | ((~x) & z); };
        var _G = function (x, y, z) { return (x & z) | (y & (~z)); };
        var _H = function (x, y, z) { return x ^ y ^ z; };
        var _I = function (x, y, z) { return y ^ (x | (~z)); };
        var _FF = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_F(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };
        var _GG = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_G(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };
        var _HH = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_H(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };
        var _II = function (a, b, c, d, x, s, ac) {
            a = addUnsigned(a, addUnsigned(addUnsigned(_I(b, c, d), x), ac));
            return addUnsigned(rotateLeft(a, s), b);
        };
        var convertToWordArray = function (str) {
            var lWordCount, lMessageLength = str.length, lNumberOfWords_temp1 = lMessageLength + 8,
                lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64,
                lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16, lWordArray = Array(lNumberOfWords - 1),
                lBytePosition = 0, lByteCount = 0;
            while (lByteCount < lMessageLength) {
                lWordCount = (lByteCount - (lByteCount % 4)) / 4;
                lBytePosition = (lByteCount % 4) * 8;
                lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
                lByteCount++;
            }
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
            lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
            lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
            return lWordArray;
        };
        var wordToHex = function (lValue) {
            var WordToHexValue = '', WordToHexValue_temp = '', lByte, lCount;
            for (lCount = 0; lCount <= 3; lCount++) {
                lByte = (lValue >>> (lCount * 8)) & 255;
                WordToHexValue_temp = '0' + lByte.toString(16);
                WordToHexValue += WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
            }
            return WordToHexValue;
        };
        var u = function (k) {
            var x = convertToWordArray(k), a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476,
                S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20, S31 = 4, S32 = 11, S33 = 16, S34 = 23,
                S41 = 6, S42 = 10, S43 = 15, S44 = 21;
            for (var kk = 0; kk < x.length; kk += 16) {
                var AA = a, BB = b, CC = c, DD = d;
                a = _FF(a, b, c, d, x[kk + 0], S11, 0xD76AA478); d = _FF(d, a, b, c, x[kk + 1], S12, 0xE8C7B756);
                c = _FF(c, d, a, b, x[kk + 2], S13, 0x242070DB); b = _FF(b, c, d, a, x[kk + 3], S14, 0xC1BDCEEE);
                a = _FF(a, b, c, d, x[kk + 4], S11, 0xF57C0FAF); d = _FF(d, a, b, c, x[kk + 5], S12, 0x4787C62A);
                c = _FF(c, d, a, b, x[kk + 6], S13, 0xA8304613); b = _FF(b, c, d, a, x[kk + 7], S14, 0xFD469501);
                a = _FF(a, b, c, d, x[kk + 8], S11, 0x698098D8); d = _FF(d, a, b, c, x[kk + 9], S12, 0x8B44F7AF);
                c = _FF(c, d, a, b, x[kk + 10], S13, 0xFFFF5BB1); b = _FF(b, c, d, a, x[kk + 11], S14, 0x895CD7BE);
                a = _FF(a, b, c, d, x[kk + 12], S11, 0x6B901122); d = _FF(d, a, b, c, x[kk + 13], S12, 0xFD987193);
                c = _FF(c, d, a, b, x[kk + 14], S13, 0xA679438E); b = _FF(b, c, d, a, x[kk + 15], S14, 0x49B40821);
                a = _GG(a, b, c, d, x[kk + 1], S21, 0xF61E2562); d = _GG(d, a, b, c, x[kk + 6], S22, 0xC040B340);
                c = _GG(c, d, a, b, x[kk + 11], S23, 0x265E5A51); b = _GG(b, c, d, a, x[kk + 0], S24, 0xE9B6C7AA);
                a = _GG(a, b, c, d, x[kk + 5], S21, 0xD62F105D); d = _GG(d, a, b, c, x[kk + 10], S22, 0x2441453);
                c = _GG(c, d, a, b, x[kk + 15], S23, 0xD8A1E681); b = _GG(b, c, d, a, x[kk + 4], S24, 0xE7D3FBC8);
                a = _GG(a, b, c, d, x[kk + 9], S21, 0x21E1CDE6); d = _GG(d, a, b, c, x[kk + 14], S22, 0xC33707D6);
                c = _GG(c, d, a, b, x[kk + 3], S23, 0xF4D50D87); b = _GG(b, c, d, a, x[kk + 8], S24, 0x455A14ED);
                a = _GG(a, b, c, d, x[kk + 13], S21, 0xA9E3E905); d = _GG(d, a, b, c, x[kk + 2], S22, 0xFCEFA3F8);
                c = _GG(c, d, a, b, x[kk + 7], S23, 0x676F02D9); b = _GG(b, c, d, a, x[kk + 12], S24, 0x8D2A4C8A);
                a = _HH(a, b, c, d, x[kk + 5], S31, 0xFFFA3942); d = _HH(d, a, b, c, x[kk + 8], S32, 0x8771F681);
                c = _HH(c, d, a, b, x[kk + 11], S33, 0x6D9D6122); b = _HH(b, c, d, a, x[kk + 14], S34, 0xFDE5380C);
                a = _HH(a, b, c, d, x[kk + 1], S31, 0xA4BEEA44); d = _HH(d, a, b, c, x[kk + 4], S32, 0x4BDECFA9);
                c = _HH(c, d, a, b, x[kk + 7], S33, 0xF6BB4B60); b = _HH(b, c, d, a, x[kk + 10], S34, 0xBEBFBC70);
                a = _HH(a, b, c, d, x[kk + 13], S31, 0x289B7EC6); d = _HH(d, a, b, c, x[kk + 0], S32, 0xEAA127FA);
                c = _HH(c, d, a, b, x[kk + 3], S33, 0xD4EF3085); b = _HH(b, c, d, a, x[kk + 6], S34, 0x4881D05);
                a = _HH(a, b, c, d, x[kk + 9], S31, 0xD9D4D039); d = _HH(d, a, b, c, x[kk + 12], S32, 0xE6DB99E5);
                c = _HH(c, d, a, b, x[kk + 15], S33, 0x1FA27CF8); b = _HH(b, c, d, a, x[kk + 2], S34, 0xC4AC5665);
                a = _II(a, b, c, d, x[kk + 0], S41, 0xF4292244); d = _II(d, a, b, c, x[kk + 7], S42, 0x432AFF97);
                c = _II(c, d, a, b, x[kk + 14], S43, 0xAB9423A7); b = _II(b, c, d, a, x[kk + 5], S44, 0xFC93A039);
                a = _II(a, b, c, d, x[kk + 12], S41, 0x655B59C3); d = _II(d, a, b, c, x[kk + 3], S42, 0x8F0CCC92);
                c = _II(c, d, a, b, x[kk + 10], S43, 0xFFEFF47D); b = _II(b, c, d, a, x[kk + 1], S44, 0x85845DD1);
                a = _II(a, b, c, d, x[kk + 8], S41, 0x6FA87E4F); d = _II(d, a, b, c, x[kk + 15], S42, 0xFE2CE6E0);
                c = _II(c, d, a, b, x[kk + 6], S43, 0xA3014314); b = _II(b, c, d, a, x[kk + 13], S44, 0x4E0811A1);
                a = _II(a, b, c, d, x[kk + 4], S41, 0xF7537E82); d = _II(d, a, b, c, x[kk + 11], S42, 0xBD3AF235);
                c = _II(c, d, a, b, x[kk + 2], S43, 0x2AD7D2BB); b = _II(b, c, d, a, x[kk + 9], S44, 0xEB86D391);
                a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
            }
            return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toUpperCase();
        };
        return u;
    })();

    function getSecret() { return GM_getValue(MMB_SECRET_KEY, MMB_SECRET_DEFAULT); }
    function setSecret(v) { GM_setValue(MMB_SECRET_KEY, v); GM_setValue(MMB_SECRET_TIME_KEY, Date.now()); }

    function generateToken(params) {
        var secret = getSecret();
        var p = {};
        for (var k in params) p[k] = params[k];
        p.t = Date.now();
        var keys = Object.keys(p).sort();
        var str = secret;
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (p[key] != null && p[key] !== '') {
                str += encodeURIComponent(key) + encodeURIComponent(p[key]);
            }
        }
        str += secret;
        str = str.toUpperCase();
        p.token = md5(str);
        return p;
    }

    /* ============================================================
     *  RC4 / 反混淆（用于从 customRequest.js 提取 secret）
     * ============================================================ */
    function rc4Decrypt(encoded, key) {
        var raw = atob(encoded), urlEnc = '';
        for (var i = 0; i < raw.length; i++) {
            urlEnc += '%' + ('00' + raw.charCodeAt(i).toString(16)).slice(-2);
        }
        var str = decodeURIComponent(urlEnc);
        var s = [], j = 0, t;
        for (var i = 0; i < 256; i++) s[i] = i;
        for (var i = 0; i < 256; i++) {
            j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
            t = s[i]; s[i] = s[j]; s[j] = t;
        }
        var result = '';
        for (var i = 0, j = 0, k = 0; k < str.length; k++) {
            i = (i + 1) % 256;
            j = (j + s[i]) % 256;
            t = s[i]; s[i] = s[j]; s[j] = t;
            result += String.fromCharCode(str.charCodeAt(k) ^ s[(s[i] + s[j]) % 256]);
        }
        return result;
    }

    function deobfuscateCustomRequest(jsText) {
        var m = jsText.match(/__0xa3e63\s*=\s*\[(.*?)\];/);
        if (!m) throw new Error('无法解混淆: 未找到加密数组');
        var rawElements = m[1].match(/'[^']*'/g);
        if (!rawElements) throw new Error('无法解混淆: 数组元素为空');
        var elements = rawElements.map(function(e) { return e.slice(1, -1); });
        for (var i = 0; i < 476; i++) { elements.push(elements.shift()); }
        return rc4Decrypt(elements[0], 'teCD');
    }

    function fetchSecret() {
        return new Promise(function(resolve, reject) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://mmbres.manmanbuy.com/pc_tool/customRequest.js',
                onload: function(res) {
                    try {
                        var secret = deobfuscateCustomRequest(res.responseText);
                        setSecret(secret);
                        resolve(secret);
                    } catch (e) { reject(e); }
                },
                onerror: function() { reject(new Error('请求 customRequest.js 失败')); },
            });
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
    var elevatorStyle = null;

    function applyBtnVisibility() {
        if (!btn) return;
        btn.style.display = GM_getValue(BTN_HIDDEN_KEY, false) ? 'none' : '';
    }

    function applyPlatformElevator() {
        var hidden = GM_getValue(ELEVATOR_HIDDEN_KEY, false);
        if (!elevatorStyle) {
            elevatorStyle = document.createElement('style');
            elevatorStyle.id = 'ph-elevator-style';
            document.head.appendChild(elevatorStyle);
        }
        if (hidden && currentPlatform && currentPlatform.elevatorSelector) {
            elevatorStyle.textContent = currentPlatform.elevatorSelector + '{display:none!important}';
        } else {
            elevatorStyle.textContent = '';
        }
    }

    function showSettings() {
        if (!settingsEl) {
            settingsEl = el('div', { id: 'ph-settings' }, [
                el('div', { id: 'ph-settings-header' }, [
                    el('h2', null, ['设置']),
                    el('button', { id: 'ph-settings-close', className: 'ph-icon-btn', title: '关闭' }, ['\u00d7']),
                ]),
                el('div', { className: 'ph-settings-section' }, [
                    el('div', { className: 'ph-settings-section-title' }, ['开关']),
                    el('div', { className: 'ph-settings-row' }, [
                        el('label', { htmlFor: 'ph-toggle-btn' }, ['隐藏脚本浮动按钮']),
                        el('label', { className: 'ph-switch' }, [
                            el('input', { type: 'checkbox', id: 'ph-toggle-btn' }),
                            el('span', { className: 'ph-slider' }),
                        ]),
                    ]),
                    el('div', { className: 'ph-settings-row' }, [
                        el('label', { htmlFor: 'ph-toggle-elevator' }, ['隐藏京东楼层导航']),
                        el('label', { className: 'ph-switch' }, [
                            el('input', { type: 'checkbox', id: 'ph-toggle-elevator' }),
                            el('span', { className: 'ph-slider' }),
                        ]),
                    ]),
                ]),
                el('hr', { style: 'border:none;border-top:1px solid #eee;margin:12px 0' }),
                el('div', { className: 'ph-settings-section' }, [
                    el('div', { className: 'ph-settings-section-title' }, ['Cookie']),
                    el('p', { className: 'ph-settings-desc' }, [
                        '获取方式：打开 ',
                        el('code', null, ['https://tool.manmanbuy.com']),
                        '，F12 \u2192 Console，执行 ',
                        el('code', null, ["copy(document.cookie)"]),
                        ' 粘贴到下方。',
                    ]),
                    el('textarea', { id: 'ph-cookie-input', placeholder: '粘贴 Cookie 字符串...' }),
                    el('div', { className: 'ph-settings-actions' }, [
                        el('button', { className: 'ph-btn-primary', id: 'ph-save-cookie' }, ['保存']),
                        el('button', { className: 'ph-btn-secondary', id: 'ph-clear-cookie' }, ['清除']),
                    ]),
                ]),
                el('div', { className: 'ph-settings-status', id: 'ph-settings-status' }),
                el('hr', { style: 'border:none;border-top:1px solid #eee;margin:12px 0' }),
                el('div', { className: 'ph-settings-actions' }, [
                    el('button', { className: 'ph-btn-secondary', id: 'ph-update-secret', style: 'flex:1' }, ['更新密钥']),
                ]),
                el('div', { id: 'ph-secret-info', style: 'font-size:11px;color:#aaa;text-align:center;margin-top:10px;line-height:1.6' }),
            ]);
            document.body.appendChild(settingsEl);

            settingsEl.querySelector('#ph-toggle-btn').addEventListener('change', function () {
                GM_setValue(BTN_HIDDEN_KEY, this.checked);
                applyBtnVisibility();
            });

            settingsEl.querySelector('#ph-toggle-elevator').addEventListener('change', function () {
                GM_setValue(ELEVATOR_HIDDEN_KEY, this.checked);
                applyPlatformElevator();
            });

            settingsEl.querySelector('#ph-save-cookie').addEventListener('click', function () {
                var val = settingsEl.querySelector('#ph-cookie-input').value.trim();
                if (!val) {
                    showSettingsStatus('error', '请输入 Cookie');
                    return;
                }
                setCookie(val);
                showSettingsStatus('success', 'Cookie 已保存');
                setTimeout(function () { hideSettings(); }, 1200);
            });

            settingsEl.querySelector('#ph-clear-cookie').addEventListener('click', function () {
                clearCookie();
                settingsEl.querySelector('#ph-cookie-input').value = '';
                showSettingsStatus('success', 'Cookie 已清除');
            });

            settingsEl.querySelector('#ph-settings-close').addEventListener('click', hideSettings);

            settingsEl.querySelector('#ph-update-secret').addEventListener('click', function () {
                var btn = this;
                btn.textContent = '更新中...';
                btn.disabled = true;
                fetchSecret().then(function(secret) {
                    showSettingsStatus('success', '密钥已更新');
                    refreshSecretInfo();
                    btn.textContent = '更新密钥';
                    btn.disabled = false;
                }).catch(function(err) {
                    showSettingsStatus('error', '更新失败: ' + err.message);
                    btn.textContent = '更新密钥';
                    btn.disabled = false;
                });
            });
        }

        function refreshSecretInfo() {
            var secret = getSecret();
            var time = GM_getValue(MMB_SECRET_TIME_KEY, 0);
            var timeStr = time ? dateFormat(new Date(time), 'yyyy-MM-dd HH:mm') : '未知';
            var infoEl = settingsEl.querySelector('#ph-secret-info');
            if (infoEl) infoEl.innerHTML = '密钥: ' + secret.substring(0, 16) + '...<br>更新: ' + timeStr;
        }

        refreshSecretInfo();

        var existing = getCookie();
        if (existing) {
            settingsEl.querySelector('#ph-cookie-input').value = existing;
        }
        settingsEl.querySelector('#ph-toggle-btn').checked = GM_getValue(BTN_HIDDEN_KEY, false);
        settingsEl.querySelector('#ph-toggle-elevator').checked = GM_getValue(ELEVATOR_HIDDEN_KEY, false);

        settingsEl.classList.add('open');
        if (overlay) overlay.classList.add('active');
    }

    function hideSettings() {
        if (settingsEl) settingsEl.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    function showSettingsStatus(type, msg) {
        var status = settingsEl.querySelector('#ph-settings-status');
        status.className = 'ph-settings-status ' + type;
        status.textContent = msg;
    }

    /* ============================================================
     *  状态管理
     * ============================================================ */
    var overlay, panel, btn, bodyEl, chartEl;
    var isOpen = false;
    var fetched = false;
    var isLoading = false;
    var cleanUrl = getCleanUrl();
    var currentData = null;  // 缓存的图表数据

    /* ============================================================
     *  UI 构建
     * ============================================================ */
    function buildUI() {
        overlay = el('div', { id: 'ph-overlay' });

        var iconSpan = el('span', { className: 'ph-btn-icon' }, ['历史价格']);
        var tipSpan = el('span', { className: 'ph-btn-tip' }, ['查看历史价格']);
        btn = el('div', { id: 'ph-btn' }, [iconSpan, tipSpan]);

        var closeBtn = el('button', { className: 'ph-icon-btn', title: '关闭' }, ['\u00d7']);
        var settingsBtn = el('button', { className: 'ph-icon-btn', title: '设置' }, ['\u2699']);
        var header = el('div', { id: 'ph-header' }, [
            el('div', { className: 'ph-header-left' }, [
                el('h3', null, ['历史价格走势']),
            ]),
            el('div', { className: 'ph-header-actions' }, [
                settingsBtn,
                closeBtn,
            ]),
        ]);

        bodyEl = el('div', { id: 'ph-body' });

        var footer = el('div', { id: 'ph-footer' }, [
            el('a', { href: 'https://tool.manmanbuy.com/', target: '_blank', rel: 'noopener' }, [
                '数据来源：慢慢买 \u2197'
            ]),
        ]);

        panel = el('div', { id: 'ph-panel' }, [header, bodyEl, footer]);
        document.body.appendChild(overlay);
        document.body.appendChild(panel);
        document.body.appendChild(btn);

        applyBtnVisibility();
        applyPlatformElevator();

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
            el('div', { className: 'ph-spinner' }),
            el('p', { className: 'ph-loading-text' }, ['正在查询历史价格...']),
        ]));
    }

    function showChart(rawData, meta) {
        fetched = true;
        isLoading = false;
        bodyEl.innerHTML = '';
        bodyEl.style.display = 'block';

        // 过滤无效数据
        var data = [];
        for (var i = 0; i < rawData.length; i++) {
            if (rawData[i][1] > 0) data.push([rawData[i][0], rawData[i][1], rawData[i][2] || '']);
        }

        // 价格摘要
        var prices = data.map(function(d) { return d[1]; });
        var infoHtml = '<div class="ph-price-info">';
        infoHtml += '<div class="ph-price-item"><div class="ph-price-label">当前价</div><div class="ph-price-value">¥' + meta.current + '</div></div>';
        infoHtml += '<div class="ph-price-item"><div class="ph-price-label">历史最低</div><div class="ph-price-value low">¥' + meta.lowest + '</div></div>';
        infoHtml += '<div class="ph-price-item"><div class="ph-price-label">最高</div><div class="ph-price-value high">¥' + meta.highest + '</div></div>';
        infoHtml += '</div>';

        bodyEl.innerHTML = '<div class="ph-body-inner">' + infoHtml + '<div id="ph-chart-box"></div></div>';

        var chartDom = document.getElementById('ph-chart-box');
        var myChart = echarts.init(chartDom);

        var maxPrice = Math.max.apply(null, prices);
        var minPrice = Math.min.apply(null, prices);
        var yMin = minPrice - ((minPrice + maxPrice) / 2 - minPrice);
        yMin = yMin >= 0 ? yMin : 0;
        var yMax = maxPrice + (maxPrice - minPrice) / 4;

        myChart.setOption({
            animation: false,
            tooltip: {
                trigger: 'axis',
                formatter: function(obj) {
                    if (!obj || !obj.length) return '';
                    var d = obj[0].data;
                    var date = new Date(d[0]);
                    var time = (date.getMonth() + 1) + '-' + date.getDate();
                    var html = '<div style="border-radius:10px;padding:0 10px;height:22px;line-height:22px;background:#5B5B69;color:#fff;font-size:11px;">' +
                        time + ' &yen;' + d[1] + '</div>';
                    if (d[2]) {
                        html = '<div style="border-radius:10px;padding:0 10px;height:44px;line-height:22px;background:#5B5B69;color:#fff;font-size:11px;">' +
                            time + ' &yen;' + d[1] + '<br/>' + d[2] + '</div>';
                    }
                    return html;
                },
                axisPointer: { type: 'line', lineStyle: { color: '#ec652e' } }
            },
            grid: { left: 50, right: 20, bottom: 30, top: 10 },
            xAxis: {
                type: 'time',
                boundaryGap: false,
                axisLine: { lineStyle: { color: '#F5F5F9' } },
                axisLabel: { color: '#555', fontSize: 10 },
                splitLine: { show: true, lineStyle: { color: '#F5F5F9' } },
            },
            yAxis: {
                type: 'value', scale: true,
                min: yMin, max: yMax,
                axisLine: { lineStyle: { color: '#F5F5F9' } },
                axisLabel: { color: '#555', fontSize: 10 },
                splitLine: { show: true, lineStyle: { color: '#F5F5F9' } },
            },
            series: [{
                type: 'line',
                data: data,
                smooth: true,
                showSymbol: false,
                lineStyle: { color: '#EE4D2D', width: 2 },
                areaStyle: {
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(255,103,41,0.08)' }, { offset: 1, color: 'rgba(255,103,41,0)' }] }
                },
                markLine: {
                    silent: true, symbol: 'none',
                    data: [
                        { type: 'max', label: { formatter: '{c}', color: '#999', fontSize: 10 } },
                        { type: 'min', label: { formatter: '{c}', color: '#999', fontSize: 10 } },
                    ]
                }
            }]
        });
    }

    function showError(msg, canRetry) {
        isLoading = false;
        bodyEl.innerHTML = '';
        bodyEl.style.display = 'flex';
        var children = [
            el('div', { className: 'ph-error-icon' }, ['!']),
            el('p', null, ['获取历史价格失败']),
            el('p', { className: 'ph-error-detail' }, [msg || '请稍后重试']),
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
        var errorEl = el('div', { className: 'ph-error' }, children);
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
            src: MMB_URL + encodeURIComponent(getCleanUrl()),
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
        var jdUrl = getCleanUrl();
        var cookie = getCookie();

        GM_xmlhttpRequest({
            method: 'GET',
            url: MMB_URL + encodeURIComponent(jdUrl),
            headers: { 'Cookie': cookie, 'User-Agent': navigator.userAgent },
            onload: function(pageRes) {
                if (pageRes.status !== 200) { showError('页面加载失败', true); return; }
                var html = pageRes.responseText;
                // 捕获 Set-Cookie，合并到 cookie 中
                if (pageRes.responseHeaders) {
                    var setCookieMatch = pageRes.responseHeaders.match(/set-cookie[^:]*:\s*([^\r\n]+)/i);
                    if (setCookieMatch) {
                        var extraCookies = setCookieMatch[1].split(';')[0];
                        if (cookie.indexOf(extraCookies.split('=')[0]) === -1) {
                            cookie = (cookie ? cookie + '; ' : '') + extraCookies;
                            console.log('[ph] 合并了新Cookie:', extraCookies.split('=')[0]);
                        }
                    }
                }
                // 提取 ticket
                var m = html.match(/id="ticket" value="([^"]+)"/);
                if (!m) { showError('无法获取票据，请确认Cookie是否有效', true); return; }
                var ticket = m[1];
                console.log('[ph] 原始ticket:', ticket);
                if (ticket.length > 4) ticket = ticket.substr(ticket.length - 4, 4) + ticket.substr(0, ticket.length - 4);
                console.log('[ph] 转换后ticket:', ticket);

                // 调 API
                var apiParams = generateToken({ method: 'getHistoryTrend', key: jdUrl });
                var postData = 'method=' + encodeURIComponent(apiParams.method) + '&key=' + encodeURIComponent(apiParams.key) + '&t=' + apiParams.t + '&token=' + apiParams.token;
                console.log('[ph] POST数据: t=' + apiParams.t + ' token=' + apiParams.token);
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://tool.manmanbuy.com/api.ashx',
                    data: postData,
                    headers: {
                        'Cookie': cookie,
                        'Authorization': 'BasicAuth ' + ticket,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': navigator.userAgent,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': 'https://tool.manmanbuy.com/HistoryLowest.aspx?url=' + encodeURIComponent(jdUrl),
                    },
                    onload: function(apiRes) {
                        try {
                            var ret = JSON.parse(apiRes.responseText);
                            if (ret.code !== 0 || !ret.data || !ret.data.datePrice) {
                                console.log('[ph] API 响应:', apiRes.responseText);
                                console.log('[ph] ticket:', ticket);
                                showError((ret.msg || '暂无价格数据') + ' (code=' + ret.code + ')', true);
                                return;
                            }
                            console.log('[ph] 价格数据获取成功!');
                            console.log('[ph] 商品:', ret.data.spName);
                            console.log('[ph] 当前价:', ret.data.currentPrice);
                            console.log('[ph] 历史最低:', ret.data.lowerPrice, ret.data.lowerDate);
                            console.log('[ph] 价格点数:', ret.data.datePrice.split('],[').length);
                            // 解析 datePrice: "[ts1,p1,''],[ts2,p2,'']"
                            var rawData = eval('([' + ret.data.datePrice + '])');
                            var prices = rawData.map(function(d) { return d[1]; });
                            var highest = Math.max.apply(null, prices);
                            var lowest = Math.min.apply(null, prices);
                            showChart(rawData, {
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
        GM_registerMenuCommand('⚙ 设置', function() {
            showSettings();
        });
        for (var i = 0; i < PLATFORMS.length; i++) {
            if (PLATFORMS[i].match.test(location.href)) {
                currentPlatform = PLATFORMS[i];
                break;
            }
        }
        if (!currentPlatform) return;
        buildUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
