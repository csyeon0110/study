const express = require('express');
const router = express.Router();
const path = require('path');
// ⭐ Item 모델까지 모두 불러옵니다. Op를 위해 Sequelize도 가져옵니다.
const { User, Log, Sequelize, Op, Item, sequelize } = require('../models'); 
const moment = require('moment'); // Feed API에서 날짜 포맷팅을 위해 추가

// ⭐⭐ 상점 데이터 정의 (DB 키워드와 미리보기 정보) ⭐⭐
// 이 데이터는 shop.html에서 버튼 상태와 미리보기를 렌더링하는 데 사용됩니다.
const THEMES = [
    { name: 'diary', type: 'theme', price: 0, description: '종이 질감 : 기본 테마', display_name: '일기장', bg_preview: '#fcf8f0', border_preview: '#a07f60', theme_id: 'diary' },
    { name: 'dev', type: 'theme', price: 100, description: '어두운 배경 & 청록색 네온 : 코딩 컨셉 테마', display_name: '개발자의 밤', bg_preview: '#1e1e1e', border_preview: '#00bcd4', theme_id: 'developer' },
    { name: 'pastel', type: 'theme', price: 150, description: '부드러운 파스텔 톤 : 귀여운 테마', display_name: '파스텔 구름', bg_preview: '#e6e6fa', border_preview: '#a8c0ff', theme_id: 'pastel' },
    { name: 'autumn', type: 'theme', price: 150, description: '차분한 황토색 & 짙은 갈색 : 가을 감성 테마', display_name: '가을의 사색', bg_preview: '#f7e7c6', border_preview: '#9c5922', theme_id: 'autumn' },
    { name: 'forest', type: 'theme', price: 200, description: '민트 & 나무색 : 상쾌한 숲 테마', display_name: '상쾌한 숲', bg_preview: '#e0f8f7', border_preview: '#00a896', theme_id: 'mint' },
    { name: 'game', type: 'theme', price: 200, description: '네온 핑크 & 형광 녹색 : 레트로 아케이드 테마', display_name: '레트로 아케이드', bg_preview: '#000000', border_preview: '#ff00ff', theme_id: 'retro' },
];


// ⭐⭐⭐ checkAuth 미들웨어 정의 ⭐⭐⭐
const checkAuth = async (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login.html'); 
    }
    
    try {
        const user = await User.findByPk(req.session.userId);
        
        if (!user) {
            req.session.destroy();
            return res.redirect('/login.html');
        }
        
        req.user = user; 
        next(); 
    } catch (error) {
        console.error("인증 중 오류 발생:", error);
        next(error); 
    }
};

// =========================================================
// ⭐⭐ 라우트 핸들러 정의 (checkAuth 적용) ⭐⭐
// =========================================================


// [A] GET /: 메인 페이지
router.get('/', checkAuth, async (req, res, next) => {
    try {
        // D-DAY, 챌린지 상태, recentLogs 계산 로직 (생략)
        let dDay = null; 
        let goalEvent = req.user.goal_event || '목표를 설정해보세요';
        let goalDateFormatted = null; 

        if (req.user.dday) { 
            const today = new Date();
            const goalDate = new Date(req.user.dday);
            
            const yyyy = goalDate.getFullYear();
            const mm = String(goalDate.getMonth() + 1).padStart(2, '0');
            const dd = String(goalDate.getDate()).padStart(2, '0');
            goalDateFormatted = `${yyyy}-${mm}-${dd}`;
            
            const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const goalDateOnly = new Date(goalDate.getFullYear(), goalDate.getMonth(), goalDate.getDate());
            
            const timeDiff = goalDateOnly.getTime() - todayDateOnly.getTime();
            dDay = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
            
            if (!req.user.goal_event) {
                goalEvent = '목표를 설정해보세요';
            }
        } else {
             goalEvent = '목표를 설정해보세요';
        }
        
        let goalEventForInput = (goalEvent && goalEvent !== '목표를 설정해보세요') ? goalEvent : '';
        const today = new Date().toDateString();
        const isPostCompleted = req.user.last_post && new Date(req.user.last_post).toDateString() === today;
        const isGameCompleted = req.user.last_game && new Date(req.user.last_game).toDateString() === today;

        const recentLogs = await Log.findAll({
            where: { UserId: req.user.id },
            order: [['created_at', 'DESC']], 
            limit: 3
        });
        
        // 테마 경로 계산
        const themeName = req.user.theme || 'diary'; 
        const themePath = `/css/${themeName}.css`; 


        res.render('index', { // views/index.html 렌더링
            nickname: req.user.nickname,
            name: req.user.name || '이름 없음', 
            email: req.user.email,
            comment: req.user.comment || '상태 메시지 없음',
            img_url: req.user.img_url || '/images/default_profile.jpg', 
            point: req.user.point,
            dDay: dDay,
            goalEvent: goalEvent, 
            goalDateFormatted: goalDateFormatted, 
            goalEventForInput: goalEventForInput, 
            recentLogs: recentLogs,

            isPostCompleted: isPostCompleted,
            isGameCompleted: isGameCompleted,
            themePath: themePath 
        });
    } catch (error) {
        console.error(error);
        next(error); 
    }
});


// [B] GET /feed: 공개 피드 페이지
router.get('/feed', checkAuth, (req, res) => {
    const themeName = req.user.theme || 'diary'; 
    const themePath = `/css/${themeName}.css`; 
    res.render('feed', { nickname: req.user.nickname, themePath: themePath });
});


// [C] GET /api/feed: 공개 피드 API (데이터 조회) (생략)
router.get('/api/feed', checkAuth, async (req, res, next) => {
    try {
        const { tag, nickname } = req.query; 
        const whereClause = { is_public: true }; 
        if (tag) { whereClause.tag = tag; }

        let userWhereClause = {};
        if (nickname) {
            userWhereClause.nickname = { [Op.like]: `%${nickname}%` };
        }
        
        const logs = await Log.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            include: [{
                model: User,
                attributes: ['nickname'], 
                where: userWhereClause,
                required: true 
            }]
        });

        const formattedLogs = logs.map(log => ({
            id: log.id,
            title: log.title,
            content: log.content,
            tag: log.tag,
            created_at: moment(log.created_at).format('YYYY.MM.DD HH:mm'), 
            authorNickname: log.User.nickname, 
        }));

        res.status(200).json({ logs: formattedLogs });

    } catch (error) {
        console.error('Feed API 오류:', error);
        next(error);
    }
});


// [D] GET /logs: 로그 목록 페이지
router.get('/logs', checkAuth, async (req, res, next) => {
    try {
        const logs = await Log.findAll({
            where: { UserId: req.user.id },
            order: [['created_at', 'DESC']]
        });

        // 테마 경로 전달 
        const themeName = req.user.theme || 'diary'; 
        const themePath = `/css/${themeName}.css`; 

        res.render('logs', { 
            nickname: req.user.nickname,
            logs: logs,
            themePath: themePath
        });
    } catch (error) {
        console.error('로그 조회 중 오류:', error);
        next(error);
    }
});


// [E] GET /post: 글쓰기 페이지
router.get('/post', checkAuth, (req, res) => {
    const themeName = req.user.theme || 'diary'; 
    const themePath = `/css/${themeName}.css`; 
    res.render('post', { nickname: req.user.nickname, themePath: themePath });
});


// ⭐⭐ [NEW] GET /shop: 테마 상점 페이지 ⭐⭐
router.get('/shop', checkAuth, async (req, res) => { 
    try {
        const themeName = req.user.theme || 'diary'; 
        const themePath = `/css/${themeName}.css`; 

        // 1. 사용자의 구매 내역 (Item 모델과 관계 설정을 사용)
        const userItems = await req.user.getItems(); 
        const purchasedItemNames = userItems.map(item => item.name);
        
        // 2. 모든 테마 아이템 목록 조회 (DB의 Item 테이블에서 조회)
        const items = await Item.findAll({ where: { type: 'theme' }, order: [['price', 'ASC']] });
        
        // 3. 상점 테마 목록에 구매/사용 상태 추가
        const shopThemes = items.map(item => { 
            const status = {};
            const isPurchased = purchasedItemNames.includes(item.name);
            
            // ⭐⭐⭐ 미리보기 데이터 정의 (DB의 name과 일치하도록) ⭐⭐⭐
            let themeData = {
                'diary': { display_name: '일기장', bg_preview: '#fcf8f0', border_preview: '#a07f60' },
                'developer': { display_name: '개발자의 밤', bg_preview: '#1e1e1e', border_preview: '#00bcd4' },
                'pastel': { display_name: '파스텔 구름', bg_preview: '#e6e6fa', border_preview: '#a8c0ff' },
                'autumn': { display_name: '가을의 사색', bg_preview: '#f7e7c6', border_preview: '#9c5922' },
                'mint': { display_name: '상쾌한 숲', bg_preview: '#e0f8f7', border_preview: '#00a896' },
                'retro': { display_name: '레트로 아케이드', bg_preview: '#000000', border_preview: '#ff00ff' },
            }[item.name] || { display_name: item.name, bg_preview: '#ffffff', border_preview: '#333' }; // DB에 없는 테마 처리

            
            // 4. 상태 플래그 설정
            if (req.user.theme === item.name) {
                status.active = true;
                status.purchased = true;
            } else {
                status.active = false;
                status.purchased = isPurchased;
            }
            
            return {
                ...item.toJSON(), 
                display_name: themeData.display_name,
                bg_preview: themeData.bg_preview,
                border_preview: themeData.border_preview,
                status: status
            };
        });

        res.render('shop', { 
            nickname: req.user.nickname,
            point: req.user.point, 
            themePath: themePath,
            shopThemes: shopThemes // shopThemes 배열 전달
        });

    } catch (error) {
        console.error('상점 페이지 로드 중 에러 발생:', error);
        next(error);
    }
});

// 이 API에서 트랜잭션을 사용하여 포인트 차감, 구매 기록 생성, 테마 적용을 동시에 처리합니다.
router.post('/api/shop/use-item', checkAuth, async (req, res, next) => {
    const { itemName } = req.body;
    const userId = req.user.id;
    // 트랜잭션 시작! (Sequelize.transaction() 대신 sequelize.transaction() 사용)
    const t = await sequelize.transaction(); 

    try {
        const item = await Item.findOne({ where: { name: itemName }, transaction: t }); // 트랜잭션 적용
        if (!item) {
            await t.rollback();
            return res.status(404).json({ success: false, message: '아이템을 찾을 수 없습니다.' });
        }

        const user = req.user;
        const userItems = await user.getItems({ transaction: t });
        const isPurchased = userItems.some(userItem => userItem.name === itemName);
        
        let message = '';
        const isDefaultTheme = (itemName === 'diary');

        if (isDefaultTheme) {
             message = '기본 테마가 적용되었습니다.';
        } else if (!isPurchased) {
            // 1. 미구매 상태: 구매 및 포인트 차감
            if (user.point < item.price) {
                await t.rollback();
                return res.status(400).json({ success: false, message: `포인트가 부족합니다. (${item.price}P 필요)` });
            }

            // 2. 포인트 차감 
            const newPoint = user.point - item.price;
            await user.update({ point: newPoint }, { transaction: t });

            // 3. 구매 기록 생성 
            await user.addItem(item, { transaction: t }); // user_items에 기록
            
            message = `${item.description.split(' : ')[0]} 테마를 구매하고 적용했습니다.`;

        } else {
            // 4. 이미 구매한 상태: 사용만 처리 (포인트 차감 없음)
            message = `${item.description.split(' : ')[0]} 테마가 적용되었습니다.`;
        }
        
        // 5. 테마 적용 
        await user.update({ theme: itemName }, { transaction: t });

        await t.commit(); // 모든 작업 성공!
        
        const updatedUser = await User.findByPk(userId);

        res.status(200).json({ 
            success: true, 
            message: message, 
            currentTheme: itemName,
            newPoint: updatedUser.point 
        });

    } catch (error) {
        await t.rollback(); 
        console.error('테마 구매/사용 트랜잭션 오류:', error);
        res.status(500).json({ success: false, message: '아이템 사용/구매 중 서버 오류가 발생했습니다.' });
        next(error);
    }
});


// [F] GET /challenge: 챌린지 페이지 (고정 다크 테마)
router.get('/challenge', checkAuth, (req, res) => {
    // 테마 고정: dark_theme.css
    const themePath = `/css/dark_theme.css`; 
    res.render('challenge', { nickname: req.user.nickname, point: req.user.point, themePath: themePath });
});


// [G] GET /ox: OX 퀴즈 페이지 (고정 다크 테마)
router.get('/ox', checkAuth, (req, res) => {
    // 테마 고정: dark_theme.css
    const themePath = `/css/dark_theme.css`; 
    res.render('ox', { nickname: req.user.nickname, themePath: themePath });
});


// [H] GET /card: 카드 게임 페이지 (고정 다크 테마)
router.get('/card', checkAuth, (req, res) => {
    // 테마 고정: dark_theme.css
    const themePath = `/css/dark_theme.css`; 
    res.render('card', { nickname: req.user.nickname, themePath: themePath });
});


// [I] GET /profile: 개인정보 수정 페이지
router.get('/profile', checkAuth, (req, res) => {
    const themeName = req.user.theme || 'diary'; 
    const themePath = `/css/${themeName}.css`; 
    res.render('profile', { 
        nickname: req.user.nickname,
        name: req.user.name || '', 
        email: req.user.email,
        comment: req.user.comment || '',
        img_url: req.user.img_url,
        point: req.user.point,
        themePath: themePath
    });
});


// [J] GET /logs/:logId: 특정 기록 상세 페이지
// ⭐⭐ [J] GET /logs/:logId: 특정 기록 상세 페이지 (최종 수정) ⭐⭐
router.get('/logs/:logId', checkAuth, async (req, res, next) => {
    try {
        const logId = req.params.logId;
        // const currentUserId = req.user.id; // 사용자 ID 조건 삭제

        // 1. 해당 로그를 ID로만 조회 (공개/비공개 상관없이 접근 허용)
        let log = await Log.findOne({
            where: {
                id: logId
            },
            // 작성자 닉네임을 가져오기 위해 User 포함 (LEFT JOIN)
            include: [{ model: User, attributes: ['nickname'] }] 
        });

        // 2. 로그가 없으면 접근 불가
        if (!log) {
            return res.status(404).send('해당 기록을 찾을 수 없습니다.');
        }

        // 3. 렌더링
        const themeName = req.user.theme || 'diary'; 
        const themePath = `/css/${themeName}.css`; 

        res.render('article', { 
            nickname: req.user.nickname,
            log: log.toJSON(),
            themePath: themePath
        });

    } catch (error) {
        console.error('로그 상세 조회 중 오류:', error);
        next(error);
    }
});


// [K] GET /logout: 로그아웃 처리
router.get('/logout', checkAuth, (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            next(err);
        } else {
            res.redirect('/login.html');
        }
    });
});

// ⭐⭐ [J] GET /logs/:logId: 특정 기록 상세 페이지 (최종 수정) ⭐⭐
router.get('/logs/:logId', checkAuth, async (req, res, next) => {
    try {
        const logId = req.params.logId;
        const currentUserId = req.user.id; // 현재 로그인된 사용자 ID

        // 1. 해당 로그가 '나의' 기록이거나 '공개된' 기록인지 확인하는 통합 쿼리
        let log = await Log.findOne({
            where: {
                id: logId,
                // ⭐ 핵심 수정: OR 연산자를 사용하여 접근 권한을 확인합니다. ⭐
                [Op.or]: [
                    { UserId: currentUserId }, // 1. 내가 작성한 글
                    { is_public: true }       // 2. 공개된 글
                ]
            },
            // 작성자 닉네임을 가져오기 위해 User 포함
            include: [{ model: User, attributes: ['nickname'] }] 
        });


        // 2. 로그가 없거나, (다른 사람의) 비공개 글인 경우 접근 불가
        if (!log) {
            return res.status(404).send('해당 기록을 찾을 수 없습니다.');
        }

        // 3. (추가 보안) 남의 글인데 비공개라면 접근 불가
        // (이 로직은 Op.or 조건에 의해 사실상 필요 없지만, 명확성을 위해 유지)
        if (log.UserId !== currentUserId && log.is_public !== true) {
             return res.status(404).send('해당 기록을 찾을 수 없습니다.');
        }

        // 4. 렌더링
        const themeName = req.user.theme || 'diary'; 
        const themePath = `/css/${themeName}.css`; 

        res.render('article', { 
            nickname: req.user.nickname,
            log: log.toJSON(),
            themePath: themePath
        });

    } catch (error) {
        console.error('로그 상세 조회 중 오류:', error);
        next(error);
    }
});


module.exports = router;
/*
const express = require('express');
const router = express.Router();
const path = require('path');
const { User } = require('../models'); // User 모델 불러오기

// 루트 경로 ('/') 처리
router.get('/', async (req, res, next) => {
    try {
        // 1. 세션에서 사용자 ID 확인 (로그인 여부 확인)
        const userId = req.session.userId;

        if (!userId) {
            // 로그인되어 있지 않다면, login.html (정적 파일)을 보냅니다.
            // app.js에서 public 폴더를 정적으로 설정했다면, 
            // res.sendFile 대신 res.redirect('/login.html'); 이 더 깔끔합니다.
            // 하지만 C:/ 경로를 쓰셨으니, 안전하게 path.join으로 파일을 전송합니다.
            return res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
        }

        // 2. DB에서 사용자 정보 조회
        const user = await User.findByPk(userId);

        if (!user) {
            // 사용자가 DB에 없으면 세션 제거 후 로그인 페이지로
            req.session.destroy();
            return res.redirect('/');
        }

        // 3. 로그인 상태라면, Nunjucks 템플릿에 데이터 주입하여 렌더링
        res.render('index', { // views/index.html 렌더링
            nickname: user.nickname,
            name: user.name || '이름 없음', 
            email: user.email,
            comment: user.comment || '상태 메시지 없음',
            img_url: user.img_url || '/images/default_profile.jpg', 
            point: user.point
        });

    } catch (error) {
        console.error(error);
        next(error); 
    }
});

// [A] GET /post: 글쓰기 페이지
router.get('/post', checkAuth, (req, res) => {
    // 템플릿 파일 이름만 지정하면 됩니다. (Nunjucks가 views 폴더에서 찾음)
    res.render('post', { nickname: req.user.nickname });
});

// [B] GET /challenge: 챌린지 페이지 (임시 렌더링)
router.get('/challenge', checkAuth, (req, res) => {
    // views/challenge.html 템플릿을 렌더링해야 합니다.
    res.render('challenge', { nickname: req.user.nickname });
});

// [C] GET /logout: 로그아웃 처리
router.get('/logout', checkAuth, (req, res, next) => {
    // 세션을 파괴하고 로그인 페이지로 돌려보냅니다.
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            next(err);
        } else {
            res.redirect('/login.html');
        }
    });
});

module.exports = router;
*/