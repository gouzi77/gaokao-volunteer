/**
 * 主应用逻辑 - 负责UI交互、消息处理、微信分享等
 */

// 初始化AI引擎
const aiEngine = new VolunteerAIEngine();

// DOM元素
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const quickInputs = document.getElementById('quickInputs');
const loadingOverlay = document.getElementById('loadingOverlay');

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    setupWechatShare();
});

/**
 * 初始化应用
 */
function initApp() {
    // 显示欢迎消息
    setTimeout(() => {
        addBotMessage(`你好呀！我是志愿填报助手🎓

我基于张雪峰老师的志愿填报方法论来帮你分析高考志愿。

**我能帮你做什么？**
- 根据你的分数和位次，推荐冲稳保院校
- 分析专业就业前景和避坑指南
- 提供城市选择建议
- 解答志愿填报的各种疑问

**咱们一步步来，先告诉我你的基本情况：**

你是哪个省份的考生呀？`);
        
        // 显示快捷回复
        showQuickReplies(['河南', '山东', '广东', '四川', '江苏', '河北', '其他省份']);
        
        // 聚焦输入框
        userInput.focus();
    }, 500);
    
    // 绑定事件
    bindEvents();
}

/**
 * 绑定事件监听器
 */
function bindEvents() {
    // 发送按钮点击
    sendBtn.addEventListener('click', sendMessage);
    
    // 输入框回车发送（Shift+Enter换行）
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 输入框自动调整高度
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });
}

/**
 * 发送消息
 */
async function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // 清空输入框
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // 禁用发送按钮
    sendBtn.disabled = true;
    
    // 隐藏快捷输入
    hideQuickReplies();
    
    // 添加用户消息
    addUserMessage(message);
    
    // 滚动到底部
    scrollToBottom();
    
    // 显示加载状态
    showLoading();
    
    try {
        // 处理消息并获取AI回复
        const response = await aiEngine.processMessage(message);
        
        // 隐藏加载状态
        hideLoading();
        
        // 添加AI回复
        setTimeout(() => {
            addBotMessage(response.text);
            
            // 显示快捷回复
            if (response.quickReplies && response.quickReplies.length > 0) {
                showQuickReplies(response.quickReplies);
            }
            
            // 滚动到底部
            scrollToBottom();
            
            // 恢复发送按钮
            sendBtn.disabled = false;
            
            // 聚焦输入框
            userInput.focus();
        }, 300 + Math.random() * 500); // 模拟思考时间
        
    } catch (error) {
        console.error('处理消息时出错:', error);
        hideLoading();
        
        addBotMessage('哎呀，出了一点小问题😅 你可以再试一次，或者刷新页面重新开始。');
        
        sendBtn.disabled = false;
        userInput.focus();
    }
}

/**
 * 添加用户消息到聊天界面
 */
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
}

/**
 * 添加机器人消息到聊天界面
 */
function addBotMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="message-avatar">🎓</div>
        <div class="message-content">${formatMessage(text)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
}

/**
 * 格式化消息内容（支持Markdown基本语法）
 */
function formatMessage(text) {
    // 转义HTML特殊字符（但在Markdown处理后）
    let formatted = escapeHtml(text);
    
    // 支持的Markdown语法
    // 标题
    formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 加粗
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 斜体
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // 行内代码
    formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
    
    // 无序列表
    formatted = formatted.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // 有序列表
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // 分隔线
    formatted = formatted.replace(/^---$/gm, '<hr>');
    
    // 引用块
    formatted = formatted.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 换行
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 显示快捷回复按钮
 */
function showQuickReplies(replies) {
    if (!replies || replies.length === 0) {
        quickInputs.style.display = 'none';
        return;
    }
    
    quickInputs.innerHTML = '';
    quickInputs.style.display = 'flex';
    
    replies.forEach(reply => {
        const btn = document.createElement('button');
        btn.className = 'quick-btn';
        btn.textContent = reply;
        btn.addEventListener('click', function() {
            userInput.value = reply;
            sendMessage();
        });
        quickInputs.appendChild(btn);
    });
}

/**
 * 隐藏快捷回复
 */
function hideQuickReplies() {
    quickInputs.style.display = 'none';
}

/**
 * 显示加载状态
 */
function showLoading() {
    loadingOverlay.style.display = 'flex';
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

/**
 * 滚动到底部
 */
function scrollToBottom() {
    setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

/**
 * 设置微信分享
 */
function setupWechatShare() {
    // 检测是否在微信环境中
    const isWechat = /micromessenger/i.test(navigator.userAgent);
    
    if (isWechat && typeof wx !== 'undefined' && wx.config) {
        // 这里需要后端提供微信JS-SDK配置
        // 由于是纯前端项目，我们使用简化的分享方案
        
        // 尝试使用微信内置分享
        try {
            wx.ready(function() {
                // 分享给朋友
                wx.onMenuShareAppMessage({
                    title: '高考志愿填报助手 - 张雪峰方法论',
                    desc: '基于张雪峰老师的方法论，帮你智能分析高考志愿，推荐冲稳保院校！',
                    link: window.location.href,
                    imgUrl: window.location.origin + '/assets/share-icon.png',
                    success: function() {
                        console.log('分享成功');
                    }
                });
                
                // 分享到朋友圈
                wx.onMenuShareTimeline({
                    title: '高考志愿填报助手 - 基于张雪峰方法论',
                    link: window.location.href,
                    imgUrl: window.location.origin + '/assets/share-icon.png',
                    success: function() {
                        console.log('分享到朋友圈成功');
                    }
                });
            });
        } catch (e) {
            console.log('微信SDK配置失败，使用默认分享');
        }
    }
    
    // 设置网页标题和描述（用于非微信环境或备用）
    document.title = '高考志愿填报助手 - 张雪峰方法论';
    
    // 添加meta标签用于分享
    updateMetaTags();
}

/**
 * 更新Meta标签（用于社交分享）
 */
function updateMetaTags() {
    // 移除旧的meta标签
    const oldMeta = document.querySelector('meta[name="description"]');
    if (oldMeta) oldMeta.remove();
    
    // 添加新的meta标签
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = '基于张雪峰高考志愿填报方法论的AI对话助手。输入你的分数、位次等信息，获得冲稳保三档院校推荐、专业就业前景分析和避坑提醒。';
    document.head.appendChild(meta);
    
    // Open Graph标签（用于Facebook、LinkedIn等）
    const ogTitle = document.createElement('meta');
    ogTitle.property = 'og:title';
    ogTitle.content = '高考志愿填报助手 - 张雪峰方法论';
    document.head.appendChild(ogTitle);
    
    const ogDesc = document.createElement('meta');
    ogDesc.property = 'og:description';
    ogDesc.content = 'AI驱动的志愿填报助手，帮你科学选校择业！';
    document.head.appendChild(ogDesc);
    
    const ogType = document.createElement('meta');
    ogType.property = 'og:type';
    ogType.content = 'website';
    document.head.appendChild(ogType);
}

/**
 * 重置对话
 */
function resetConversation() {
    if (confirm('确定要重新开始吗？当前的对话记录将被清除。')) {
        aiEngine.reset();
        chatMessages.innerHTML = '';
        hideQuickReplies();
        initApp();
    }
}

// 暴露全局函数供HTML调用
window.sendMessage = sendMessage;
window.resetConversation = resetConversation;

// PWA支持（可选）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // navigator.serviceWorker.register('/sw.js')
        //     .then(function(registration) {
        //         console.log('ServiceWorker注册成功:', registration.scope);
        //     })
        //     .catch(function(error) {
        //         console.log('ServiceWorker注册失败:', error);
        //     });
    });
}
