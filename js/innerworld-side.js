(function() {
    'use strict';

    const CLICK_TIMEOUT = 2000; // 2秒内点击3次
    const REQUIRED_CLICKS = 3;
    const INNER_WORLD_PATH = '/innerworld/';
    const ANIMATION_DURATION = 2000; // 动画时长2秒
    const AUTH_TIMEOUT = 30 * 60 * 1000; // 30分钟有效期
    const STORAGE_KEY = 'innerworld_key';

    let clickCount = 0;
    let clickTimer = null;
    let clickTimestamps = [];

    // 检测是否在里世界页面
    function isInnerWorldPage() {
        return window.location.pathname.startsWith(INNER_WORLD_PATH);
    }

    // 生成密钥
    function generateKey() {
        return clickTimestamps.join('|');
    }

    // 验证密钥格式
    function verifyKey(key) {
        if (!key) return false;
        const parts = key.split('|');
        if (parts.length !== REQUIRED_CLICKS) return false;
        
        const timestamps = parts.map(Number);
        if (timestamps.some(isNaN)) return false;
        
        // 检查严格递增
        for (let i = 1; i < timestamps.length; i++) {
            if (timestamps[i] <= timestamps[i - 1]) return false;
            if (timestamps[i] - timestamps[i - 1] > CLICK_TIMEOUT) return false;
        }
        
        // 检查是否在有效期内
        const lastClick = timestamps[timestamps.length - 1];
        if (Date.now() - lastClick > AUTH_TIMEOUT) return false;
        
        return true;
    }

    // 获取主内容容器
    function getMainContainer() {
        return document.querySelector('main') 
            || document.querySelector('.page') 
            || document.querySelector('.wrapper')
            || document.querySelector('#wrapper')
            || document.body;
    }

    // 创建提示文字（独立元素，在body上层）
    function createHint(text) {
        const hint = document.createElement('div');
        hint.className = 'innerworld-hint';
        hint.textContent = text;
        document.body.appendChild(hint);
        
        setTimeout(() => {
            hint.remove();
        }, 2000);
    }

    // 创建裂缝动画遮罩
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'innerworld-overlay';
        overlay.id = 'innerworld-overlay';
        
        const left = document.createElement('div');
        left.className = 'crack-left';
        
        const right = document.createElement('div');
        right.className = 'crack-right';
        
        overlay.appendChild(left);
        overlay.appendChild(right);
        document.body.appendChild(overlay);
        
        return overlay;
    }

    // 应用模糊到主内容
    function applyBlur() {
        const container = getMainContainer();
        container.classList.add('innerworld-blur-active');
    }

    // 移除模糊
    function removeBlur() {
        const container = getMainContainer();
        container.classList.remove('innerworld-blur-active');
    }

    // 移除遮罩
    function removeOverlay() {
        const overlay = document.getElementById('innerworld-overlay');
        if (overlay) {
            overlay.remove();
        }
        removeBlur();
        document.body.classList.remove('innerworld-animating');
    }

    // 进入里世界动画 - 黑色从两侧吞噬当前页面
    function playEnterAnimation(callback) {
        document.body.classList.add('innerworld-animating');
        applyBlur();
        createHint('正在进入里世界...');
        
        const overlay = createOverlay();
        overlay.classList.add('enter');
        
        // 强制重排
        void overlay.offsetWidth;
        
        // 触发动画
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // 动画完成后跳转
        setTimeout(() => {
            if (callback) callback();
        }, ANIMATION_DURATION);
    }

    // 退出里世界动画 - 亮色从两侧吞噬里世界页面
    function playExitAnimation(callback) {
        document.body.classList.add('innerworld-animating');
        applyBlur();
        
        createHint('正在回到表世界...');
        
        const overlay = createOverlay();
        overlay.classList.add('exit');
        
        // 强制重排
        void overlay.offsetWidth;
        
        // 触发动画
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // 动画完成后跳转
        setTimeout(() => {
            if (callback) callback();
        }, ANIMATION_DURATION);
    }

    // 里世界页面进入欢迎动画
    function playWelcomeAnimation() {
        const main = document.querySelector('main') || document.querySelector('.page') || document.body;
        if (main) {
            main.classList.add('innerworld-welcome');
            setTimeout(() => {
                main.classList.remove('innerworld-welcome');
            }, 1500);
        }
    }

    // 显示未授权提示
    function showUnauthorized() {
        const main = getMainContainer();
        main.innerHTML = `
            <div class="innerworld-unauthorized">
                <h1>里世界不欢迎未授权的灵魂</h1>
                <p>只有被选中者才能窥见真相</p>
                <p>在表世界找到入口，以正确的节奏叩击三次</p>
            </div>
        `;
        document.title = '未授权 - ' + document.title;
    }

    // 显示过期提示并返回表世界
    function showExpired() {
        const main = getMainContainer();
        main.innerHTML = `
            <div class="innerworld-expired">
                <h1>时间已耗尽，通道正在关闭...</h1>
                <p>正在回到表世界...</p>
            </div>
        `;
        
        // 播放退出动画
        setTimeout(() => {
            playExitAnimation(() => {
                clearKey();
                window.location.href = '/';
            });
        }, 1500);
    }

    // 存储密钥
    function storeKey(key) {
        sessionStorage.setItem(STORAGE_KEY, key);
    }

    // 获取密钥
    function getKey() {
        return sessionStorage.getItem(STORAGE_KEY);
    }

    // 清除密钥
    function clearKey() {
        sessionStorage.removeItem(STORAGE_KEY);
    }

    // 检查访问权限
    function checkAccess() {
        const key = getKey();
        return verifyKey(key);
    }

    // 处理里世界页面
    function handleInnerWorldPage() {
        if (!checkAccess()) {
            const key = getKey();
            if (key) {
                // 有过期的密钥
                showExpired();
            } else {
                // 完全没有密钥
                showUnauthorized();
            }
            return;
        }
        
        // 密钥有效，播放欢迎动画
        const wasEntering = sessionStorage.getItem('innerworldEntering') === 'true';
        if (wasEntering) {
            sessionStorage.removeItem('innerworldEntering');
            setTimeout(() => {
                playWelcomeAnimation();
            }, 100);
        }
    }

    // 处理头像点击
    function handleAvatarClick(e) {
        e.preventDefault();
        
        clickCount++;
        clickTimestamps.push(Date.now());
        
        if (!clickTimer) {
            clickTimer = setTimeout(() => {
                clickCount = 0;
                clickTimestamps = [];
                clickTimer = null;
            }, CLICK_TIMEOUT);
        }
        
        if (clickCount >= REQUIRED_CLICKS) {
            clearTimeout(clickTimer);
            clickCount = 0;
            clickTimer = null;
            
            if (isInnerWorldPage()) {
                // 退出里世界
                const returnUrl = sessionStorage.getItem('innerworldReturnUrl') || '/';
                clearKey();
                playExitAnimation(() => {
                    window.location.href = returnUrl;
                });
            } else {
                // 进入里世界
                const key = generateKey();
                storeKey(key);
                sessionStorage.setItem('innerworldReturnUrl', window.location.href);
                sessionStorage.setItem('innerworldEntering', 'true');
                playEnterAnimation(() => {
                    window.location.href = INNER_WORLD_PATH;
                });
            }
            
            clickTimestamps = [];
        }
    }

    // 初始化
    function init() {
        // 清理可能残留的遮罩（页面刷新时）
        removeOverlay();
        
        if (isInnerWorldPage()) {
            handleInnerWorldPage();
        }
        
        const titleTrigger = document.getElementById('home-title-trigger');
        if (titleTrigger) {
            titleTrigger.addEventListener('click', handleAvatarClick);
        }
    }

    // DOM 加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
