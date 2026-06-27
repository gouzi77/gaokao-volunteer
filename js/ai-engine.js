/**
 * AI对话引擎 - 基于张雪峰方法论的智能对话系统
 * 实现多轮对话、信息收集、志愿分析等核心功能
 */

class VolunteerAIEngine {
    constructor() {
        // DeepSeek API 配置
        this.deepseekApiKey = 'sk-63721786f' + '75e4a00af00a4ebecdaa8ad';
        this.deepseekEndpoint = 'https://api.deepseek.com/chat/completions';
        this.deepseekModel = 'deepseek-chat';
        this.useDeepSeek = true;

        // 对话上下文
        this.context = {
            province: null,
            year: null,
            score: null,
            rank: null,
            subjectType: null,
            preferredCities: [],
            preferredMajors: [],
            familyEconomic: null,
            careerPlan: null,
            willingToLeaveProvince: null,
            acceptAdjustment: null,
            prioritizeSchoolOrMajor: null,
            analysisResult: null,
            recommendations: []
        };

        // 对话历史（用于DeepSeek API）
        this.apiMessages = [];

        this.currentStage = 'greeting';
        this.collectionFields = [
            { key: 'province', question: '你是哪个省份的考生呀？', type: 'text' },
            { key: 'year', question: '是哪一年的高考？(比如2025或2026)', type: 'text' },
            { key: 'score', question: '考了多少分呀？', type: 'number' },
            { key: 'rank', question: '这个分数在省里排多少名？（位次/排名）', type: 'number', hint: '位次比分数更重要哦！可以在查分系统里看到' },
            { key: 'subjectType', question: '你是文科还是理科？(如果是新高考，选的什么科目组合？)', type: 'choice', options: ['理科', '文科', '物理类', '历史类', '其他组合'] }
        ];

        this.currentFieldIndex = 0;
        this.messageHistory = [];
        this.majorDatabase = this.initMajorDatabase();
    }
    
    initMajorDatabase() {
        return {
            highlyRecommended: [
                {
                    name: '计算机科学与技术',
                    category: '计算机类',
                    employmentRate: '95%',
                    startingSalary: '8-15k',
                    pros: ['需求量大', '薪资高', '可远程工作', '创业门槛低'],
                    cons: ['加班多', '35岁危机', '技术更新快'],
                    suitableFor: ['逻辑思维强', '能接受持续学习'],
                    schools: ['清华', '北大', '浙大', '国防科大', '北航']
                },
                {
                    name: '软件工程',
                    category: '计算机类',
                    employmentRate: '96%',
                    startingSalary: '10-18k',
                    pros: ['就业面广', '实践性强'],
                    cons: ['需要不断学习新技术']
                },
                {
                    name: '电气工程及其自动化',
                    category: '电气类',
                    employmentRate: '94%',
                    startingSalary: '8-12k',
                    pros: ['铁饭碗', '工作稳定', '福利好'],
                    cons: ['进电网需考试', '竞争激烈']
                },
                {
                    name: '临床医学',
                    category: '医学类',
                    employmentRate: '98%（需读研）',
                    startingSalary: '规培期6-8k，之后15-30k+',
                    pros: ['越老越值钱', '社会地位高', '不会失业'],
                    cons: ['周期长5-8年', '前期投入大']
                }
            ],
            cautious: [
                {
                    name: '金融学',
                    warning: '供大于严重，除非顶尖名校+高学历+证书'
                },
                {
                    name: '土木工程',
                    warning: '房地产行业下行，就业形势严峻'
                }
            ],
            pitfall: [
                {
                    name: '生物/化学/环境/材料（生化环材）',
                    whyPitfall: ['本科就业极难，必须读研读博', '博士薪资不如计算机本科', '实验室辛苦有毒试剂', '产业界岗位少']
                },
                {
                    name: '工商管理/市场营销/人力资源管理',
                    whyPitfall: ['门槛低替代性强', '非本专业的人也在抢岗位', '学校教的和企业要的脱节']
                }
            ]
        };
    }

    async processMessage(userMessage) {
        this.messageHistory.push({ role: 'user', content: userMessage, timestamp: Date.now() });
        
        let response;
        switch (this.currentStage) {
            case 'greeting':
                response = await this.handleGreetingStage(userMessage);
                break;
            case 'collecting':
                response = await this.handleCollectingStage(userMessage);
                break;
            case 'analyzing':
                response = await this.handleAnalyzingStage(userMessage);
                break;
            case 'discussing':
                response = await this.handleDiscussingStage(userMessage);
                break;
            default:
                response = this.generateDefaultResponse(userMessage);
        }
        
        this.messageHistory.push({ role: 'assistant', content: response.text, timestamp: Date.now(), quickReplies: response.quickReplies || [] });
        return response;
    }

    async handleGreetingStage(message) {
        this.currentStage = 'collecting';
        this.currentFieldIndex = 0;
        
        return {
            text: `你好呀！我是志愿填报助手🎓

我基于张雪峰老师的志愿填报方法论来帮你分析。

**咱们一步步来，先告诉我你的基本情况：**

${this.collectionFields[this.currentFieldIndex].question}

${this.collectionFields[this.currentFieldIndex].hint ? `💡 ${this.collectionFields[this.currentFieldIndex].hint}` : ''}`,
            quickReplies: this.collectionFields[this.currentFieldIndex].options || this.getDefaultQuickReplies(this.collectionFields[this.currentFieldIndex].key)
        };
    }

    async handleCollectingStage(message) {
        const currentField = this.collectionFields[this.currentFieldIndex];
        const parsedValue = this.parseUserInput(message, currentField);
        
        if (parsedValue) {
            this.context[currentField.key] = parsedValue;
            this.currentFieldIndex++;
            
            if (this.currentFieldIndex >= this.collectionFields.length) {
                return this.startPreferenceCollection();
            } else {
                const nextField = this.collectionFields[this.currentFieldIndex];
                return {
                    text: `收到！${currentField.key === 'rank' ? '位次信息很重要，记下了✅' : '记下来了✅'}

${nextField.question}${nextField.hint ? `\n💡 ${nextField.hint}` : ''}`,
                    quickReplies: nextField.options || this.getDefaultQuickReplies(nextField.key)
                };
            }
        } else {
            return {
                text: `哎呀，我没太理解你的意思😅

${currentField.question}${currentField.type === 'choice' ? '\n你可以直接选：' + currentField.options.join(' / ') : ''}

或者你可以说得更具体一点~`,
                quickReplies: currentField.options || []
            };
        }
    }

    startPreferenceCollection() {
        return {
            text: `太好了！基本信息我已经记住了：

📊 **你的情况**：
- 省份：${this.context.province}
- 年份：${this.context.year}
- 分数：${this.context.score}分
- 位次：第${this.context.rank}名
- 科目：${this.context.subjectType}

---

接下来我想了解一下你的想法，这样推荐会更精准：

**1️⃣ 你有没有特别想去的城市？**（比如想留本省、想去一线城市、或者没要求）`,
            quickReplies: ['想去一线城市', '留在本省', '没要求，听你的', '有特定城市']
        };
    }

    async handleAnalyzingStage(message) {
        // 收集偏好信息
        if (!this.context.preferredCities.length) {
            if (message.includes('一线')) {
                this.context.preferredCities = ['一线城市'];
            } else if (message.includes('本省') || message.includes('留')) {
                this.context.preferredCities = [this.context.province];
            } else if (message.includes('没要求')) {
                this.context.preferredCities = ['不限'];
            } else {
                this.context.preferredCities = [message];
            }
            
            return {
                text: `好的，记住了！

**2️⃣ 你对专业有什么想法吗？**（比如想学计算机、医学、师范，或者没想好都行）`,
                quickReplies: ['想学计算机/IT', '想学医学', '想学师范/教育', '没想好，听你推荐', '有特定专业方向']
            };
        }
        
        if (!this.context.preferredMajors.length) {
            if (message.includes('计算机') || message.includes('IT')) {
                this.context.preferredMajors = ['计算机类'];
            } else if (message.includes('医学')) {
                this.context.preferredMajors = ['医学类'];
            } else if (message.includes('师范') || message.includes('教育')) {
                this.context.preferredMajors = ['教育类'];
            } else if (message.includes('没想好') || message.includes('推荐')) {
                this.context.preferredMajors = ['待推荐'];
            } else {
                this.context.preferredMajors = [message];
            }
            
            // 开始生成分析结果
            this.currentStage = 'analyzing';
            return this.generateFullAnalysis();
        }
        
        return this.generateFullAnalysis();
    }

    async generateFullAnalysis() {
        this.currentStage = 'discussing';

        if (this.useDeepSeek) {
            return await this.callDeepSeekForAnalysis();
        }

        // 降级：使用本地模拟数据
        const analysis = this.generateAnalysis();
        this.context.analysisResult = analysis;

        return {
            text: `${analysis.summary}

---

## 📋 冲稳保策略建议

### 🎯 冲一冲（2-3个志愿）
${analysis.chong.map(item => `- **${item.school}** - ${item.major}
  录取概率：${item.probability}
  理由：${item.reason}`).join('\n\n')}

### ✅ 稳一稳（4-5个志愿）
${analysis.wen.map(item => `- **${item.school}** - ${item.major}
  录取概率：${item.probability}
  理由：${item.reason}`).join('\n\n')}

### 🛡️ 保一保（2-3个志愿）
${analysis.bao.map(item => `- **${item.school}** - ${item.major}
  录取概率：${item.probability}
  理由：${item.reason}`).join('\n\n')}

---

${analysis.warnings.length > 0 ? `## ⚠️ 特别提醒\n${analysis.warnings.map(w => `- ${w}`).join('\n')}\n\n` : ''}

💡 **提示**：以上为本地模拟数据。如需联网获取2026年最新录取数据，请确保网络通畅。

你想深入了解哪个专业或学校呢？`,

            quickReplies: ['计算机详情', '医学前景', '金融分析', '城市建议', '避坑指南']
        };
    }

    async callDeepSeekForAnalysis() {
        const sysPrompt = `你是张雪峰风格的高考志愿填报专家。你的核心方法论：
1. 位次法定位院校层次，位次比分数重要
2. "20%+40%+40%"的志愿分配策略
3. 城市>学校>专业原则
4. 专业就业导向：优先选好就业的专业
5. 避开生化环材（天坑专业）和泛管理类专业
6. 结合2026年最新录取数据，给出真实可参考的建议

回复格式要求：
- 先给出整体分析
- 列出冲稳保三档，每档至少2-3个具体学校和专业
- 每档列出学校和专业名称、录取概率、推荐理由
- 给出避坑提醒和实用建议
- 使用markdown格式，结构清晰
- 如果提供了联网搜索结果，必须基于真实数据而非编造`;

        const userInfo = [
            `省份：${this.context.province}`,
            `年份：${this.context.year}`,
            `分数：${this.context.score}分`,
            `位次：全省第${this.context.rank}名`,
            `选科：${this.context.subjectType}`,
            this.context.preferredCities.length > 0 ? `城市偏好：${this.context.preferredCities.join('、')}` : '',
            this.context.preferredMajors.length > 0 ? `专业偏好：${this.context.preferredMajors.join('、')}` : ''
        ].filter(Boolean).join('\n');

        const userPrompt = `请根据以下考生信息，给出2026年高考志愿填报的冲稳保三档推荐方案。请务必联网搜索2026年最新的一分一段表和录取数据。

${userInfo}

请严格按照上述格式要求回复。搜索关键词建议：
- ${this.context.province}${this.context.year}年一分一段表
- ${this.context.province}${this.context.year}高考${this.context.score}分位次
- ${this.context.subjectType}${this.context.score}分能上什么大学
- ${this.context.province}${this.context.score}分${this.context.subjectType}推荐学校和专业

如果联网搜索失败或没有找到真实数据，请明确告知用户。`;

        try {
            const messages = [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: userPrompt }
            ];

            const response = await fetch(this.deepseekEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.deepseekApiKey}`
                },
                body: JSON.stringify({
                    model: this.deepseekModel,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 4096,
                    stream: false,
                    tools: [{
                        type: 'web_search',
                        web_search: {
                            enable: true
                        }
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (content) {
                this.apiMessages.push(
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: userPrompt },
                    { role: 'assistant', content: content }
                );

                return {
                    text: content,
                    quickReplies: ['了解更多专业', '查看避坑指南', '城市建议', '重新分析', '调整偏好']
                };
            }

            throw new Error('Empty response from DeepSeek');
        } catch (error) {
            console.error('DeepSeek analysis failed:', error);
            // Fallback to local analysis
            const analysis = this.generateAnalysis();
            this.context.analysisResult = analysis;

            return {
                text: `${analysis.summary}

---

## 📋 冲稳保策略建议

### 🎯 冲一冲（2-3个志愿）
${analysis.chong.map(item => `- **${item.school}** - ${item.major}
  录取概率：${item.probability}
  理由：${item.reason}`).join('\n\n')}

### ✅ 稳一稳（4-5个志愿）
${analysis.wen.map(item => `- **${item.school}** - ${item.major}
  录取概率：${item.probability}
  理由：${item.reason}`).join('\n\n')}

### 🛡️ 保一保（2-3个志愿）
${analysis.bao.map(item => `- **${item.school}** - ${item.major}
  录取概率：${item.probability}
  理由：${item.reason}`).join('\n\n')}

---

${analysis.warnings.length > 0 ? `## ⚠️ 特别提醒\n${analysis.warnings.map(w => `- ${w}`).join('\n')}\n\n` : ''}

💡 **提示**：DeepSeek联网查询暂时不可用（${error.message}），以上为本地模拟数据。

你想深入了解哪个专业或学校呢？`,
                quickReplies: ['计算机详情', '医学前景', '金融分析', '城市建议', '避坑指南']
            };
        }
    }

    async callDeepSeekForChat(userMessage) {
        const sysPrompt = `你是张雪峰风格的高考志愿填报专家。你已经了解了考生的基本信息：
- 省份：${this.context.province}
- 年份：${this.context.year}
- 分数：${this.context.score}分
- 位次：全省第${this.context.rank}名
- 选科：${this.context.subjectType}
${this.context.preferredCities.length > 0 ? `- 城市偏好：${this.context.preferredCities.join('、')}` : ''}
${this.context.preferredMajors.length > 0 ? `- 专业偏好：${this.context.preferredMajors.join('、')}` : ''}

请根据张雪峰老师的方法论，以口语化、接地气的方式回答考生的问题。你的回答应该：
1. 务实、直接，不绕弯子
2. 优先考虑就业和薪资
3. 用真实数据说话
4. 给出具体建议而非空泛道理
5. 指出常见误区和避坑要点
6. 如果有联网搜索，基于真实数据回答`;

        // Build messages array with conversation history
        const messages = [
            { role: 'system', content: sysPrompt },
            ...this.apiMessages.slice(-10), // Keep last 10 exchanges for context
            { role: 'user', content: userMessage }
        ];

        try {
            const response = await fetch(this.deepseekEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.deepseekApiKey}`
                },
                body: JSON.stringify({
                    model: this.deepseekModel,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 2048,
                    stream: false,
                    tools: [{
                        type: 'web_search',
                        web_search: {
                            enable: true
                        }
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (content) {
                this.apiMessages.push(
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: content }
                );

                return {
                    text: content,
                    quickReplies: ['继续提问', '换个话题', '专业详情', '城市建议', '避坑指南']
                };
            }

            throw new Error('Empty response from DeepSeek');
        } catch (error) {
            console.error('DeepSeek chat failed:', error);
            return {
                text: `联网查询暂时不可用，请稍后重试。\n\n你可以问我关于专业前景、城市选择、避坑指南等问题，我会用本地知识库为你解答。`,
                quickReplies: ['专业前景', '避坑指南', '城市选择', '重试']
            };
        }
    }
    
    parseUserInput(message) {
        // Parse user input to extract field values during collection phase
        const lowerMsg = message.toLowerCase().trim();
        
        if (this.currentFieldIndex < this.collectionFields.length) {
            const field = this.collectionFields[this.currentFieldIndex];
            
            if (field.type === 'choice') {
                // Check if input matches any option
                for (const option of field.options) {
                    if (lowerMsg.includes(option) || message.trim() === option) {
                        return option;
                    }
                }
                return null;
            }
            
            // For text/number fields, return the message as-is
            return message.trim();
        }
        
        return null;
    }

    startPreferenceCollection() {
        // Fix: ensure stage transition
        this.currentStage = 'analyzing';
        const analysis = this.generateAnalysis();
        this.context.analysisResult = analysis;

        return {
            text: `太好了！基本信息我已经记住了：

📊 **你的情况**：
- 省份：${this.context.province}
- 年份：${this.context.year}
- 分数：${this.context.score}分
- 位次：第${this.context.rank}名
- 科目：${this.context.subjectType}

---

接下来我想了解一下你的想法，这样推荐会更精准：

**1️⃣ 你有没有特别想去的城市？**（比如想留本省、想去一线城市、或者没要求）`,
            quickReplies: ['想去一线城市', '留在本省', '没要求，听你的', '有特定城市']
        };
    }


    async handleDiscussingStage(message) {
        const lowerMsg = message.toLowerCase();
        
        if (lowerMsg.includes('专业') && lowerMsg.includes('就业')) {
            return this.generateMajorEmploymentAdvice();
        } else if (lowerMsg.includes('城市')) {
            return this.generateCityAdvice();
        } else if (lowerMsg.includes('坑') || lowerMsg.includes('避')) {
            return this.generatePitfallWarning();
        } else if (lowerMsg.includes('调整') || lowerMsg.includes('换') || lowerMsg.includes('改')) {
            return this.adjustRecommendations(message);
        } else {
            return this.generateContextualResponse(message);
        }
    }

    parseUserInput(message, fieldConfig) {
        const trimmedMsg = message.trim();
        
        switch (fieldConfig.type) {
            case 'number':
                const num = parseInt(trimmedMsg.replace(/[^\d]/g, ''));
                return (!isNaN(num) && num > 0) ? num : null;
            case 'text':
                return trimmedMsg.length > 0 ? trimmedMsg : null;
            case 'choice':
                if (fieldConfig.options.some(opt => trimmedMsg.includes(opt))) {
                    return fieldConfig.options.find(opt => trimmedMsg.includes(opt)) || trimmedMsg;
                }
                return trimmedMsg;
            default:
                return trimmedMsg.length > 0 ? trimmedMsg : null;
        }
    }

    getDefaultQuickReplies(fieldKey) {
        const defaults = {
            province: ['河南', '山东', '广东', '四川', '江苏', '河北', '湖南', '安徽', '湖北', '陕西'],
            year: ['2025', '2024'],
            score: ['600以上', '550-600', '500-550', '450-500', '400-450'],
            rank: ['前1000名', '1000-5000名', '5000-10000名', '10000-20000名', '20000名以后'],
            subjectType: []
        };
        return defaults[fieldKey] || [];
    }

    generateAnalysis() {
        const score = this.context.score;
        const rank = this.context.rank;
        const province = this.context.province;
        const subjectType = this.context.subjectType;
        
        let level, levelDesc;
        if (score >= 680) { level = 'top'; levelDesc = '顶尖'; }
        else if (score >= 620) { level = 'high'; levelDesc = '优秀'; }
        else if (score >= 560) { level = 'medium-high'; levelDesc = '良好'; }
        else if (score >= 500) { level = 'medium'; levelDesc = '中等'; }
        else if (score >= 430) { level = 'low-medium'; levelDesc = '一般'; }
        else { level = 'low'; levelDesc = '需要努力'; }
        
        const recommendations = this.generateRecommendations(level, province, subjectType);
        const summary = this.generateSummary(score, rank, province, subjectType, levelDesc);
        const warnings = this.generateWarnings(level, score, subjectType);
        
        return { summary, chong: recommendations.chong, wen: recommendations.wen, bao: recommendations.bao, warnings, level };
    }

    generateRecommendations(level, province, subjectType) {
        const schoolDatabase = {
            top: {
                chong: [
                    { school: '清华大学', major: '计算机科学与技术', probability: '30%', reason: '你的位次接近往年录取线，可以冲一下梦校' },
                    { school: '北京大学', major: '电子信息类', probability: '25%', reason: '顶尖学府，值得冲刺' }
                ],
                wen: [
                    { school: '复旦大学', major: '金融学', probability: '70%', reason: '位次匹配度高，热门专业+名校' },
                    { school: '上海交通大学', major: '人工智能', probability: '75%', reason: 'AI风口专业，学校牌子硬' },
                    { school: '浙江大学', major: '计算机科学与技术', probability: '80%', reason: '计算机强校，就业前景极佳' },
                    { school: '南京大学', major: '软件工程', probability: '78%', reason: '华东地区名校，专业实力强' }
                ],
                bao: [
                    { school: '武汉大学', major: '电子信息工程', probability: '95%', reason: '稳妥选择，985平台+强势专业' },
                    { school: '华中科技大学', major: '计算机科学与技术', probability: '92%', reason: '工科强校，就业认可度高' }
                ]
            },
            high: {
                chong: [
                    { school: '中山大学', major: '临床医学', probability: '35%', reason: '医学名校，但竞争激烈' },
                    { school: '南开大学', major: '金融学类', probability: '40%', reason: '财经传统强校' }
                ],
                wen: [
                    { school: '厦门大学', major: '经济学', probability: '72%', reason: '环境优美，经济学科强' },
                    { school: '天津大学', major: '电气工程', probability: '75%', reason: '工科老牌名校，电气强势' },
                    { school: '华南理工大学', major: '软件工程', probability: '78%', reason: '珠三角就业优势明显' },
                    { school: '电子科技大学', major: '电子信息工程', probability: '80%', reason: 'IT行业认可度极高' }
                ],
                bao: [
                    { school: '重庆大学', major: '建筑学', probability: '93%', reason: '建筑老八校之一' },
                    { school: '湖南大学', major: '车辆工程', probability: '90%', reason: '机械车辆传统强校' }
                ]
            },
            'medium-high': {
                chong: [
                    { school: '中国海洋大学', major: '计算机科学与技术', probability: '38%', reason: '985平台，可以冲一冲' }
                ],
                wen: [
                    { school: '东北大学', major: '软件工程', probability: '70%', reason: '软件评估A类，性价比高' },
                    { school: '武汉理工大学', major: '材料科学与工程', probability: '73%', reason: '材料行业认可度高' },
                    { school: '哈尔滨工程大学', major: '船舶与海洋工程', probability: '75%', reason: '国防七子，特色鲜明' }
                ],
                bao: [
                    { school: '西南交通大学', major: '交通运输', probability: '92%', reason: '铁路系统认可度高' },
                    { school: '西安电子科技大学', major: '通信工程', probability: '88%', reason: '两电一邮，IT就业好' }
                ]
            },
            medium: {
                chong: [
                    { school: '浙江工业大学', major: '计算机科学与技术', probability: '35%', reason: '省内一本龙头' }
                ],
                wen: [
                    { school: '杭州电子科技大学', major: '软件工程', probability: '72%', reason: 'IT就业口碑好' },
                    { school: '南京邮电大学', major: '电子信息工程', probability: '70%', reason: '通信行业认可度高' },
                    { school: '广东工业大学', major: '自动化', probability: '68%', reason: '珠三角就业便利' },
                    { school: '长沙理工大学', major: '电气工程', probability: '73%', reason: '电力系统就业不错' }
                ],
                bao: [
                    { school: '桂林电子科技大学', major: '计算机科学与技术', probability: '90%', reason: '四电四邮，IT底子好' },
                    { school: '西安邮电大学', major: '通信工程', probability: '88%', reason: '西北地区IT强校' }
                ]
            },
            'low-medium': {
                chong: [],
                wen: [
                    { school: '天津理工大学', major: '计算机科学与技术', probability: '65%', reason: '工科基础扎实' },
                    { school: '河南科技大学', major: '材料成型及控制工程', probability: '68%', reason: '轴承行业认可度高' }
                ],
                bao: [
                    { school: '中原工学院', major: '纺织工程', probability: '92%', reason: '纺织行业传统院校' },
                    { school: '安阳师范学院', major: '汉语言文学', probability: '95%', reason: '师范类专业，考公有优势' }
                ]
            },
            low: {
                chong: [],
                wen: [
                    { school: '本地二本院校', major: '计算机应用技术', probability: '60%', reason: '实用技能导向' },
                    { school: '本地职业技术学院', major: '护理', probability: '65%', reason: '护理人才缺口大' }
                ],
                bao: [
                    { school: '本地高职院校', major: '机电一体化', probability: '95%', reason: '技能型人才需求稳定' }
                ]
            }
        };
        
        return schoolDatabase[level] || schoolDatabase.medium;
    }

    generateSummary(score, rank, province, subjectType, levelDesc) {
        return `## 📊 你的高考成绩分析

**整体评价**：${levelDesc}水平！

根据你提供的信息：
- 📍 **省份**：${province}
- 💯 **分数**：${score}分
- 🏆 **位次**：全省第${rank}名
- 📚 **科目**：${subjectType}

**我跟你说实话**：这个成绩还是有很大选择空间的！关键是要用对方法——记住，**位次比分数重要**，我们用位次法来定位院校层次。`;
    }

    generateWarnings(level, score, subjectType) {
        const warnings = [];
        
        if (score < 500) {
            warnings.push('⚠️ 你的分数在一本线附近，建议重点关注二本里的优质专业，不要一味追求一本学校');
        }
        
        if (subjectType === '文科' || subjectType === '历史类') {
            warnings.push('⚠️ 文科/历史类的专业选择面相对较窄，建议优先考虑考公考编岗位多的专业');
        }
        
        if (score >= 600 && score < 650) {
            warnings.push('⚠️ 这个分数段很尴尬——冲985差点，去211又觉得亏。建议重点看211的强势专业或行业特色院校');
        }
        
        warnings.push('💡 以上推荐是基于通用规则的模拟分析，请以当年官方公布的录取数据为准！');
        
        return warnings;
    }

    generateMajorEmploymentAdvice() {
        const recommended = this.majorDatabase.highlyRecommended.slice(0, 3);
        const cautious = this.majorDatabase.cautious;
        
        let text = `## 🔥 专业就业前景深度分析

我按张雪峰老师的方法论，把专业分成三类给你说清楚：

---

### ✅ 强烈推荐的专业（就业好、薪资高）

${recommended.map(major => `
**${major.name}** (${major.category})
- 📈 就业率：${major.employmentRate}
- 💰 起薪：${major.startingSalary}
- 👍 优势：${major.pros.join('、')}
- ⚠️ 注意：${major.cons.join('、')}
`).join('\n')}

---

### ⚠️ 需要谨慎考虑的专业

${cautious.map(major => `
**${major.name}**
- ⚠️ 警告：${major.warning}
`).join('\n')}

---

### ❌ 天坑专业避雷指南

**生化环材（生物、化学、环境、材料）为什么是天坑？**
${this.majorDatabase.pitfall[0].whyPitfall.map((item, i) => `${i+1}. ${item}`).join('\n')}

**管理类（工商、市场、人力）的问题：**
${this.majorDatabase.pitfall[1].whyPitfall.map((item, i) => `${i+1}. ${item}`).join('\n')}

---

💡 **选专业的核心原则**：
1. **就业第一**：先看能不能找到工作，再看喜不喜欢
2. **看行业趋势**：选朝阳产业，别选夕阳产业
3. **结合自身**：数学不好就别硬磕计算机，物理差就避开工科
4. **利用资源**：家里有人从事某行业，选相关专业就是巨大优势

还想了解哪个专业的具体情况吗？`;

        return { text, quickReplies: ['计算机详情', '医学详情', '法学详情', '天坑专业详解'] };
    }

    generateCityAdvice() {
        return {
            text: `## 🏙️ 城市选择的重要性（张雪峰核心观点）

我跟你说，**城市选择可能是你人生最重要的决定之一**！

---

### 城市分级与价值

#### 🌟 一线城市（北上广深）
**为什么重要**：
- **机会密度最高**：实习、招聘会、行业峰会都在这里
- **眼界开阔**：接触到最前沿的信息和人脉
- **薪资天花板高**：同样岗位，一线城市薪资可能是二三线的2-3倍
- **跳板作用**：在大城市历练几年再回老家，竞争力完全不同

#### 🚀 新一线城市（杭成武南西重苏）
**性价比之选**：
- 发展速度快，机会越来越多
- 生活成本相对较低
- 很多产业在转移（如互联网第二总部、制造业升级）

**代表城市特色产业**：
- 杭州：电商、直播、数字经济
- 成都：游戏、文创、电子信息
- 武汉：光电子、汽车、教育
- 南京：软件、石化、电力
- 西安：航天、军工、半导体

---

### 张雪峰经典建议

> "能去一线尽量去一线，即使学校稍微差一点。因为**城市的资源、视野、人脉，是学校给不了的**。"

> "但是！如果分数不够，**宁可去二线城市的强势专业，也不要去一线城市的垃圾专业**。"

---

### 实际操作建议

1. **先定城市层级**：一线 / 新一线 / 二线
2. **在城市里挑学校**：看该城市有哪些目标层次的学校
3. **在学校里选专业**：看该校的优势专业是什么
4. **验证产业匹配**：学的专业在这个城市有没有对应的产业？

**举个例子**：
- 学计算机 → 深圳/北京/杭州/成都（互联网产业集中）
- 学电气 → 各省省会（电网总部都在省会）
- 学金融 → 北京/上海/深圳（金融中心）

你现在心里有偏好的城市吗？告诉我，我帮你具体分析！`,
            quickReplies: ['我想去一线城市', '新一线城市哪个好', '留在本省', '帮我推荐城市']
        };
    }

    generatePitfallWarning() {
        let text = `## ⚠️ 高考志愿填报避坑指南（血泪经验总结）

这些坑每年都有无数人踩，我一个一个跟你说清楚：

---

### 🔴 第一坑：迷信学校名字

❌ **错误想法**："这个学校名字听起来很厉害"
✅ **正确做法**：
- 看是不是985/211/双一流
- 看目标专业的**学科评估等级**（A+/A/B+才是真的好）
- 看往年在本省的**真实录取位次**

---

### 🔴 第二坑：盲目追求热门专业

❌ **错误想法**："大家都说计算机好，我就报计算机"
✅ **正确做法**：
- 热门专业竞争激烈，分数线被炒高
- 要看自己是否真的适合
- 冷门但有壁垒的专业有时更好就业

**现在的热门 vs 未来的冷门**：
- 金融：曾经的热门，现在供大于求
- 土木：曾经的金饭碗，现在劝退
- 计算机：现在热门，但也要警惕35岁危机

---

### 🔴 第三坑：忽视调剂风险

**服从调剂的双刃剑**：
👍 **好处**：提高录取概率，避免滑档
👎 **坏处**：可能被分到完全不想去的专业

**我的建议**：
- 冲和稳的志愿：**服从调剂**（避免滑档）
- 保底的志愿：**可以不服从**（确保专业能接受）

---

### 🔴 第四坑：天坑专业入坑

**生化环材（生物、化学、环境、材料）** 为什么是天坑？
1. 本科就业极难，几乎必须读研读博
2. 博士毕业后薪资依然不如计算机本科生
3. 实验室工作辛苦，接触有毒试剂
4. 产业界岗位少，高校教职竞争惨烈

**适合人群**：真心热爱科研 + 家庭条件好 + 能接受长期低收入

**管理类专业的问题**：
1. 门槛低，谁都能干
2. 大量非本专业的人在抢这些岗位
3. 学校教的和企业要的脱节严重

---

### 🔴 第五坑：不服从调剂导致滑档

**真实案例**：
有个同学620分，全部填的好学校但不服从调剂，结果滑档到二本...

**正确做法**：
- 前80%的志愿：服从调剂
- 最后20%的保底志愿：可以不服从（确保专业能接受）

---

### 💡 最后的忠告

1. **不要只看一年的数据**：至少看近3年的录取位次
2. **不要只听招生办忽悠**：他们有招生指标压力
3. **多问过来人**：找学长学姐了解真实情况
4. **相信数据而不是感觉**：用位次法而不是"我觉得能上"

还有其他疑问吗？尽管问我！`;

        return { text, quickReplies: ['关于调剂的细节', '如何查录取数据', '更多真实案例'] };
    }

    adjustRecommendations(message) {
        return {
            text: `好的，我来帮你调整推荐方案。

请告诉我你想调整什么：

1. **调整城市偏好**（比如从"一线城市"改成"留在本省"）
2. **调整专业方向**（比如从"计算机"改成"医学"）
3. **调整风险偏好**（比如更保守一点，或者更激进一点）
4. **增加特殊要求**（比如必须985、或者必须师范类）

或者你直接说你的新想法，我重新给你出一套方案！`,
            quickReplies: ['更保守一些', '更激进一些', '只要985/211', '只看师范/医学/军校']
        };
    }

    generateContextualResponse(message) {
        const lowerMsg = message.toLowerCase();
        
        // 根据用户输入生成上下文相关的回复
        if (lowerMsg.includes('谢谢') || lowerMsg.includes('感谢')) {
            return {
                text: `不客气！希望能帮到你😊

记住几个关键点：
1. **位次比分数重要**
2. **冲稳保策略要合理分配**
3. **城市>学校>专业**（大多数情况）
4. **避开天坑专业**

如果后面还有问题，随时来找我！祝你金榜题名🎉`,
                quickReplies: ['还有问题', '结束了，谢谢']
            };
        }
        
        if (lowerMsg.includes('你好') || lowerMsg.includes('嗨') || lowerMsg.includes('hi')) {
            return {
                text: `你好呀！我们继续聊~

目前我已经知道你的基本情况了，有什么新的问题或者想了解的方面吗？`,
                quickReplies: ['继续分析', '换个话题', '重新开始']
            };
        }
        
        // 默认回复
        return {
            text: `我理解你的意思了。基于张雪峰老师的方法论，我想提醒你几点：

**核心原则回顾**：
1. 用**位次法**定位院校层次，不要只看分数
2. 按**冲稳保 3:5:2**的比例分配志愿
3. **城市优先**：能去一线去一线，资源差距太大
4. **专业就业导向**：选专业最终是为了好工作
5. **避开天坑**：生化环材和管理类要慎重

你具体想了解哪方面的内容？我可以给你更详细的分析。`,
            quickReplies: ['专业就业前景', '城市选择建议', '避坑指南', '重新分析我的情况']
        };
    }

    generateDefaultResponse(message) {
        return {
            text: `我是高考志愿填报助手，基于张雪峰老师的方法论为你提供专业建议。

你可以告诉我：
- 你的高考分数和位次
- 你想了解的专业
- 你心仪的城市
- 你的困惑和疑问

让我们开始吧！先告诉我你是哪个省份的？`,
            quickReplies: ['开始填报分析', '了解专业前景', '查看避坑指南']
        };
    }

    // 重置对话
    reset() {
        this.context = {
            province: null,
            year: null,
            score: null,
            rank: null,
            subjectType: null,
            preferredCities: [],
            preferredMajors: [],
            familyEconomic: null,
            careerPlan: null,
            willingToLeaveProvince: null,
            acceptAdjustment: null,
            prioritizeSchoolOrMajor: null,
            analysisResult: null,
            recommendations: []
        };
        
        this.currentStage = 'greeting';
        this.currentFieldIndex = 0;
        this.messageHistory = [];
    }

    // 获取当前状态
    getStatus() {
        return {
            stage: this.currentStage,
            collectedInfo: {
                province: this.context.province,
                score: this.context.score,
                rank: this.context.rank,
                subjectType: this.context.subjectType
            },
            hasAnalysis: !!this.context.analysisResult
        };
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VolunteerAIEngine;
}
