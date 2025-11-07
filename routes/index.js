const express = require('express');
const router = express.Router();
const path = require('path');
const { User, Log } = require('../models'); // User와 Log 모델을 불러옵니다.

// ⭐⭐⭐ checkAuth 미들웨어 정의 ⭐⭐⭐
// 모든 보호된 라우트(HOME, LOGS, POST 등)에서 사용됩니다.
const checkAuth = async (req, res, next) => {
    // 1. 세션에 userId가 없으면 로그인 페이지로 리디렉션
    if (!req.session.userId) {
        // login.html은 정적 파일이므로 '/login.html'로 리디렉션
        return res.redirect('/login.html'); 
    }
    
    try {
        // 2. 세션 ID로 사용자 정보를 DB에서 조회
        const user = await User.findByPk(req.session.userId);
        
        if (!user) {
            // 사용자가 DB에 없다면 세션을 파괴하고 로그인 페이지로 보냄
            req.session.destroy();
            return res.redirect('/login.html');
        }
        
        // 3. 요청 객체에 사용자 정보를 추가 (라우트에서 req.user로 접근 가능)
        req.user = user; 
        next(); // 다음 라우트 핸들러로 이동
    } catch (error) {
        console.error("인증 중 오류 발생:", error);
        next(error); // 에러 처리 미들웨어로 전달
    }
};

// =========================================================
// ⭐⭐ 라우트 핸들러 정의 (checkAuth 적용) ⭐⭐
// =========================================================


// [A] GET /: 메인 페이지
router.get('/', checkAuth, async (req, res, next) => {
    try {
        // D-DAY 계산 로직
        let dDay = null; 
        let goalEvent = req.user.goal_event || '목표를 설정해보세요';
        let goalDateFormatted = null; // 클라이언트 JS로 보낼 포맷팅된 날짜 (YYYY-MM-DD)

        
        if (req.user.dday) { // user.dday가 목표 날짜임
            const today = new Date();
            const goalDate = new Date(req.user.dday);
            
            // 목표 날짜를 YYYY-MM-DD 형식으로 포맷팅 (클라이언트 input[type=date]용)
            const yyyy = goalDate.getFullYear();
            const mm = String(goalDate.getMonth() + 1).padStart(2, '0');
            const dd = String(goalDate.getDate()).padStart(2, '0');
            goalDateFormatted = `${yyyy}-${mm}-${dd}`;
            
            // D-Day 계산을 위해 날짜 부분만 비교
            const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const goalDateOnly = new Date(goalDate.getFullYear(), goalDate.getMonth(), goalDate.getDate());
            
            const timeDiff = goalDateOnly.getTime() - todayDateOnly.getTime();
            dDay = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
            
            /*if (!req.user.goal_event) {
                goalEvent = '목표를 설정해보세요';
            }*/
        } else {
             goalEvent = '목표를 설정해보세요';
        }
        
        // ⭐ 오류 해결을 위한 변수 추가 (goalEventForInput) ⭐
        let goalEventForInput = (goalEvent && goalEvent !== '목표를 설정해보세요') 
                        ? goalEvent 
                        : '';


        // ⭐ 일일 챌린지 상태 확인 ⭐
        const today = new Date().toDateString(); // 오늘 날짜 문자열 ('Thu Nov 06 2025')
        
        // last_post와 오늘 날짜 비교
        const isPostCompleted = req.user.last_post && 
                                new Date(req.user.last_post).toDateString() === today;

        // last_game과 오늘 날짜 비교
        const isGameCompleted = req.user.last_game && 
                                new Date(req.user.last_game).toDateString() === today;


        // 최신 로그 3개만 불러오기 (메인 페이지용)
        const recentLogs = await Log.findAll({
            where: { UserId: req.user.id },
            order: [['created_at', 'DESC']], 
            limit: 3
        });
        
        res.render('index', { // views/index.html 렌더링
            // ... 기존 데이터 전달 ...
            nickname: req.user.nickname,
            name: req.user.name || '이름 없음', 
            email: req.user.email,
            comment: req.user.comment || '상태 메시지 없음',
            img_url: req.user.img_url || '/images/default_profile.jpg', 
            point: req.user.point,
            dDay: dDay,
            goalEvent: goalEvent, 
            goalDateFormatted: goalDateFormatted, // 포맷팅된 날짜 전달
            goalEventForInput: goalEventForInput, // ⭐ 오류 해결 변수 전달 ⭐
            recentLogs: recentLogs,

            // 챌린지 상태 데이터 전달
            isPostCompleted: isPostCompleted,
            isGameCompleted: isGameCompleted,
        });
    } catch (error) {
        console.error(error);
        next(error); 
    }
});


// [B] GET /logs: 로그 목록 페이지
router.get('/logs', checkAuth, async (req, res, next) => {
    try {
        const logs = await Log.findAll({
            where: { UserId: req.user.id },
            order: [['created_at', 'DESC']] // 최신 기록부터 보여주기
        });

        res.render('logs', { 
            nickname: req.user.nickname,
            logs: logs // 템플릿으로 로그 목록 전달
        });
    } catch (error) {
        console.error('로그 조회 중 오류:', error);
        next(error);
    }
});


// [C] GET /post: 글쓰기 페이지
router.get('/post', checkAuth, (req, res) => {
    res.render('post', { nickname: req.user.nickname });
});


// [D] GET /challenge: 챌린지 페이지 (임시 렌더링)
router.get('/challenge', checkAuth, (req, res) => {
    res.render('challenge', { nickname: req.user.nickname, point: req.user.point });
});


// [E] GET /ox: OX 퀴즈 페이지
router.get('/ox', checkAuth, (req, res) => {
    res.render('ox', { nickname: req.user.nickname });
});


// [F] GET /card: 카드 게임 페이지
router.get('/card', checkAuth, (req, res) => {
    res.render('card', { nickname: req.user.nickname });
});


// [G] GET /profile: 개인정보 수정 페이지
router.get('/profile', checkAuth, (req, res) => {
    res.render('profile', { 
        nickname: req.user.nickname,
        name: req.user.name || '', 
        email: req.user.email,
        comment: req.user.comment || '',
        img_url: req.user.img_url,
        point: req.user.point,
    });
});


// [H] GET /logs/:logId: 특정 기록 상세 페이지
router.get('/logs/:logId', checkAuth, async (req, res, next) => {
    try {
        const logId = req.params.logId;
        
        const log = await Log.findOne({
            where: {
                id: logId,
                UserId: req.user.id
            }
        });

        if (!log) {
            return res.status(404).send('해당 기록을 찾을 수 없습니다.');
        }

        res.render('article', { // views/article.html 템플릿 사용
            nickname: req.user.nickname,
            log: log.toJSON() 
        });

    } catch (error) {
        console.error('로그 상세 조회 중 오류:', error);
        next(error);
    }
});


// [I] GET /logout: 로그아웃 처리
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