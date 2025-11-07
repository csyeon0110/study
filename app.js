const express = require('express');
const morgan = require('morgan'); // HTTP 요청 로깅 미들웨어
const cookieParser = require('cookie-parser'); // 쿠키 파싱 미들웨어
const session = require('express-session'); // 세션 미들웨어 
const dotenv = require('dotenv'); // .env 파일의 환경변수 로드
const path = require('path'); // 경로 조작 유틸리티
const nunjucks = require('nunjucks'); // 템플릿 엔진
const moment = require('moment'); // moment 라이브러리 추가
// ⭐ User와 Log 모델을 함께 불러옵니다. (중복 정의 방지)
const { sequelize, User, Log } = require('./models'); 
const bcrypt = require('bcryptjs'); // 비밀번호 해싱 라이브러리
const jwt = require('jsonwebtoken'); // JWT 토큰 라이브러리
const cors = require('cors'); // CORS 미들웨어
const multer = require('multer'); // 파일 업로드 미들웨어
const fs = require('fs'); // 파일 시스템 모듈

// 환경변수 설정
dotenv.config(); 
const indexRouter = require('./routes'); 
const userRouter = require('./routes/user');

const app = express(); 
app.set('port', process.env.PORT || 3000); 
app.set('view engine', 'html'); 

// Nunjucks 환경 인스턴스를 env 변수에 저장
const env = nunjucks.configure('views', { 
    express: app,
    watch: true,
});

// ⭐ Nunjucks에 사용자 정의 필터 등록 (Date 필터) ⭐
env.addFilter('date', function(str, format) {
    // moment를 사용하여 날짜 형식을 지정합니다.
    return moment(str).format(format || 'YYYY.MM.DD HH:mm:ss');
});


// 미들웨어 설정
app.use(morgan('dev')); 

// 정적 파일 제공 (public 폴더)
app.use(express.static(path.join(__dirname, 'public'))); 
// ⭐ 추가: 사용자가 업로드한 파일을 위한 정적 경로 설정 ⭐
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors()); 

// ⭐ 중요: multer 미들웨어보다 JSON/URLENCODED 파서는 먼저 와야 합니다.
app.use(express.json()); 
app.use(express.urlencoded({ extended: false })); 
app.use(cookieParser(process.env.COOKIE_SECRET)); 
app.use(session({ 
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    cookie: { httpOnly: true, secure: false },
    name: 'session-cookie',
    sameSite: 'lax',
    maxAge : 60*1000*30,
}));


// uploads 폴더 없으면 생성
try {
    fs.readdirSync('uploads');
} catch (error) {
    console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
    fs.mkdirSync('uploads');
}

const upload = multer({ // 파일 업로드 설정
    storage: multer.diskStorage({
        destination(req, file, done) {
            done(null, 'uploads/'); // 파일 저장 경로
        },
        filename(req, file, done) {
            const ext = path.extname(file.originalname);
            done(null, path.basename(file.originalname, ext) + Date.now() + ext);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
});


// 라우트 설정
app.use('/', indexRouter);
app.use('/user', userRouter);


// ⭐⭐ checkAuthApi 미들웨어 정의 (모든 API 라우트보다 위에 위치)
const checkAuthApi = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    try {
        const user = await User.findByPk(req.session.userId);
        if (!user) {
            req.session.destroy();
            return res.status(401).json({ message: '사용자 세션이 유효하지 않습니다.' });
        }
        req.user = user; // 요청 객체에 사용자 정보를 담아 다음 미들웨어로 전달
        next();
    } catch (error) {
        console.error("인증 중 오류 발생:", error);
        res.status(500).json({ message: '서버 인증 오류.' });
    }
};

// ========================================================
// ⭐⭐ API 라우트 핸들러 ⭐⭐
// ========================================================

// 1. 회원가입 API (이미지 업로드 포함)
app.post('/api/register', upload.single('img_file'), async (req, res) => {
    console.log("[REGISTER API]");
    try {
        const { nickname, password, name, email, comment } = req.body;
        
        // 업로드된 파일 경로 (파일이 없으면 null)
        const img_url = req.file ? `/uploads/${req.file.filename}` : '/images/ham.jpg'; // 기본 이미지 경로

        // 1. 필수 값 확인
        if (!nickname || !password || !email) {
            return res.status(400).json({ message: '닉네임, 비밀번호, 이메일은 필수 입력값입니다.' });
        }
        
        // 2. 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 3. 사용자 생성 및 저장
        await User.create({
            nickname,
            pw: hashedPassword,
            name: name || null, 
            email,
            comment: comment || null,
            img_url: img_url, // 파일 경로 저장
        });
        
        res.status(201).json({ message: '회원가입이 성공적으로 완료되었습니다! 로그인해 주세요.' });
    } catch (error) {
        console.error('회원가입 중 에러 발생:', error);
        
        // 에러 발생 시 업로드된 파일 삭제 (선택 사항)
        if (req.file) { fs.unlink(req.file.path, (err) => console.error(err)); }

        // 이메일 또는 닉네임 중복 처리
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: '이미 사용 중인 닉네임 또는 이메일입니다.' });
        }
        
        res.status(500).json({ message: '서버 오류로 회원가입에 실패했습니다.' });
    }
});


// 2. 로그인 API
app.post('/api/login', async (req, res) => {
    console.log("[LOGIN API]");
    try {
        const { username, password } = req.body; 
        
        const user = await User.findOne({ where: { nickname: username } });
        if (!user) { return res.status(400).json({ message: '사용자를 찾을 수 없습니다.' }); }
        const isMatch = await bcrypt.compare(password, user.pw);
        if (!isMatch) { return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' }); }

        req.session.userId = user.id; 
        //const token = jwt.sign({ userId: user.id }, 'MySecretKeyForToken', { expiresIn: '5s' });
        
        res.status(200).json({ message: '로그인 성공!' });//, token: token
    } catch (error) {
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
});


// 3. 로그 저장 및 포인트 지급 API
app.post('/api/log', checkAuthApi, async (req, res) => {
    console.log("[POST /api/log]");
    const { title, content } = req.body;
    const user = req.user; 

    if (!title || !content) {
        return res.status(400).json({ message: '제목과 내용을 입력해주세요.' });
    }

    let pointChange = 0;
    const POINT_AMOUNT = 10;
    const now = new Date();
    
    try {
        const isFirstPostToday = user.last_post === null || new Date(user.last_post).toDateString() !== now.toDateString();

        if (isFirstPostToday) {
            pointChange = POINT_AMOUNT;
            await User.update({
                point: user.point + POINT_AMOUNT,
                last_post: now 
            }, { where: { id: user.id } });
            console.log(`[포인트 지급] User ${user.id}에게 ${POINT_AMOUNT}점 지급.`);
        }

        await Log.create({
            title: title,
            content: content,
            UserId: user.id,
        });

        const responseMessage = isFirstPostToday 
            ? '기록이 성공적으로 저장되었으며, 일일 포인트를 받았습니다!'
            : '기록이 성공적으로 저장되었습니다.';

        res.status(200).json({ message: responseMessage, pointChange: pointChange });
    } catch (error) {
        console.error('로그 저장/포인트 지급 중 에러 발생:', error);
        res.status(500).json({ message: '기록 저장 중 서버 오류가 발생했습니다.' });
    }
});


// 4. OX 퀴즈 API (정답 시마다 포인트 지급 + last_game 갱신)
app.post('/api/game/ox', checkAuthApi, async (req, res) => {
    console.log("[POST /api/game/ox]");
    const { is_correct } = req.body; 
    const user = req.user; 
    const now = new Date();

    const POINT_PER_CORRECT = 5; 

    try {
        // ⭐ last_game 갱신 (챌린지 완료 체크용)
        await User.update({
            last_game: now
        }, { where: { id: user.id } });
        
        if (!is_correct) {
            return res.status(200).json({ message: '오답입니다. 포인트 지급 없음.', pointChange: 0 });
        }

        let pointChange = POINT_PER_CORRECT;
        
        await User.update({
            point: user.point + POINT_PER_CORRECT,
        }, { where: { id: user.id } });
        console.log(`[OX 퀴즈 포인트 지급] User ${user.id}에게 ${POINT_PER_CORRECT}점 지급.`);

        res.status(200).json({ 
            message: `정답입니다! ${POINT_PER_CORRECT} 포인트를 획득했습니다.`, 
            pointChange: pointChange 
        });

    } catch (error) {
        console.error('OX 퀴즈 점수 처리 중 에러 발생:', error);
        res.status(500).json({ message: 'OX 퀴즈 점수 처리 중 서버 오류가 발생했습니다.' });
    }
});


// 5. 카드 게임 API (점수만큼 포인트 지급 + last_game 갱신)
app.post('/api/game/card', checkAuthApi, async (req, res) => {
    console.log("[POST /api/game/card]");
    const { final_score } = req.body; 
    const user = req.user; 
    const now = new Date();
    
    if (typeof final_score !== 'number' || final_score < 0) {
        return res.status(400).json({ message: '잘못된 게임 결과 데이터입니다.' });
    }

    let pointChange = final_score; 
    
    try {
        // ⭐ last_game 갱신 (챌린지 완료 체크용)
        await User.update({
            last_game: now
        }, { where: { id: user.id } });

        if (pointChange > 0) {
            await User.update({
                point: user.point + pointChange,
            }, { where: { id: user.id } });
            console.log(`[카드 게임 포인트 지급] User ${user.id}에게 ${pointChange}점 지급.`);
        }

        const responseMessage = pointChange > 0 
            ? `게임 종료! 최종 점수 ${final_score}점으로 ${pointChange} 포인트를 획득했습니다!`
            : '게임 종료. 획득한 포인트는 없습니다.';

        res.status(200).json({ message: responseMessage, pointChange: pointChange });
    } catch (error) {
        console.error('카드 게임 점수 처리 중 에러 발생:', error);
        res.status(500).json({ message: '카드 게임 점수 처리 중 서버 오류가 발생했습니다.' });
    }
});


// 6. D-DAY 목표 설정 API
app.post('/api/set-goal', checkAuthApi, async (req, res) => {
    console.log("[POST /api/set-goal]");
    try {
        const user = req.user; 
        const { goal_date, goal_event } = req.body; 

        if (!goal_date || !goal_event) {
            return res.status(400).json({ message: '날짜와 목표 이벤트명은 필수 입력값입니다.' });
        }
        
        await User.update({
            dday: goal_date,      
            goal_event: goal_event 
        }, {
            where: { id: user.id }
        });

        res.status(200).json({ message: 'D-DAY 목표가 성공적으로 설정되었습니다.' });

    } catch (error) {
        console.error('D-DAY 목표 설정 중 에러 발생:', error);
        res.status(500).json({ message: '목표 설정 중 서버 오류가 발생했습니다.' });
    }
});


// 7. 개인정보 수정 API
app.post('/api/profile', checkAuthApi, upload.single('img_file'), async (req, res) => {
    console.log("[POST /api/profile]");
    try {
        const user = req.user; 
        const { name, comment, old_password, new_password } = req.body;
        const updateData = {};

        updateData.name = name || null;
        updateData.comment = comment || null;

        // 이미지 파일 처리
        if (req.file) {
            updateData.img_url = `/uploads/${req.file.filename}`;
            if (user.img_url && user.img_url.startsWith('/uploads/')) {
                const oldImagePath = path.join(__dirname, user.img_url);
                fs.unlink(oldImagePath, (err) => {
                    if (err) console.error('기존 프로필 이미지 삭제 실패:', err);
                });
            }
        }
        
        // 비밀번호 변경 처리
        if (old_password && new_password) {
            const isMatch = await bcrypt.compare(old_password, user.pw);
            if (!isMatch) {
                return res.status(400).json({ message: '기존 비밀번호가 일치하지 않습니다.' });
            }
            updateData.pw = await bcrypt.hash(new_password, 10);
        } else if (new_password) {
            return res.status(400).json({ message: '비밀번호를 변경하려면 기존 비밀번호를 입력해야 합니다.' });
        }

        await User.update(updateData, { where: { id: user.id } });

        res.status(200).json({ message: '개인정보가 성공적으로 수정되었습니다.' });

    } catch (error) {
        console.error('개인정보 수정 중 에러 발생:', error);
        if (req.file) { fs.unlink(req.file.path, (err) => console.error(err)); }
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: '이미 사용 중인 닉네임 또는 이메일입니다.' });
        }
        res.status(500).json({ message: '개인정보 수정 중 서버 오류가 발생했습니다.' });
    }
});


// ... (기존 라우트 처리 및 에러 핸들링 미들웨어 유지) ...

app.use((req, res, next) => {
  res.status(404).send('Not Found');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(err.message);
});


// sequelize.sync()를 호출하여 데이터베이스와 동기화
sequelize.sync({ force: false }) 
  .then(() => {
    console.log('데이터베이스 연결 성공'); 
    // 데이터베이스 연결 성공 시 서버 실행
    app.listen(app.get('port'), () => {
      console.log(`Example app listening at http://localhost:${app.get('port')}`);
    });
  })
  .catch((err) => {
    console.error('데이터베이스 연결 실패'); 
    console.error(err); 
  });

/*const express = require('express');
const morgan = require('morgan'); // HTTP 요청 로깅 미들웨어
const cookieParser = require('cookie-parser'); // 쿠키 파싱 미들웨어
const session = require('express-session'); // 세션 미들웨어 
const dotenv = require('dotenv'); // .env 파일의 환경변수 로드
const path = require('path'); // 경로 조작 유틸리티
const nunjucks = require('nunjucks'); // 템플릿 엔진
const { sequelize, User, Log } = require('./models'); // Sequelize ORM과 User 모델
const bcrypt = require('bcryptjs'); // 비밀번호 해싱 라이브러리
const jwt = require('jsonwebtoken'); // JWT 토큰 라이브러리
const cors = require('cors'); // CORS 미들웨어

// 환경변수 설정
dotenv.config(); // process.env 객체에 .env 파일의 내용 추가
const indexRouter = require('./routes'); // 라우터 모듈
const userRouter = require('./routes/user');

const app = express(); // 익스프레스 객체 생성
app.set('port', process.env.PORT || 3000); // 포트 설정
app.set('view engine', 'html'); // 뷰 엔진 설정

nunjucks.configure('views', { // 템플릿 엔진 설정
  express: app,
  watch: true,
});

// 미들웨어 설정
app.use(morgan('dev')); // 요청 로깅
app.use(express.static(path.join(__dirname, 'public'))); // 정적 파일 제공

app.use(cors()); // CORS 미들웨어 추가------------------------

app.use(express.json()); // JSON 요청 바디 파싱
app.use(express.urlencoded({ extended: false })); // URL-encoded 요청 바디 파싱
app.use(cookieParser(process.env.COOKIE_SECRET)); // 쿠키 파싱
app.use(session({ // 세션 설정
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,
    secure: false,
  },
  name: 'session-cookie',
}));

const multer = require('multer'); // 파일 업로드 미들웨어
const fs = require('fs'); // 파일 시스템 모듈

// uploads 폴더 없으면 생성
try {
  fs.readdirSync('uploads');
} catch (error) {
  console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
  fs.mkdirSync('uploads');
}

const upload = multer({ // 파일 업로드 설정
  storage: multer.diskStorage({
    destination(req, file, done) {
      done(null, 'uploads/');
    },
    filename(req, file, done) {
      const ext = path.extname(file.originalname);
      done(null, path.basename(file.originalname, ext) + Date.now() + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 라우트 설정 ---- **라우트 매개변수**next('route')**
app.use('/', indexRouter);
app.use('/user', userRouter);

// ⭐⭐ checkAuthApi 미들웨어 정의
const checkAuthApi = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }
    try {
        const user = await User.findByPk(req.session.userId);
        if (!user) {
            req.session.destroy();
            return res.status(401).json({ message: '사용자 세션이 유효하지 않습니다.' });
        }
        req.user = user; // 요청 객체에 사용자 정보를 담아 다음 미들웨어로 전달
        next();
    } catch (error) {
        console.error("인증 중 오류 발생:", error);
        res.status(500).json({ message: '서버 인증 오류.' });
    }
};

// 로그인 API
app.post('/api/login', async (req, res) => {
  console.log("[LOGIN API]");
  try {
    const { username, password } = req.body; 
    console.log("아이디 : " + username + ", 비번 : " + password);

    // DB에서 사용자 검색 (nickname)
    const user = await User.findOne({ where: { nickname: username } });
    console.log("사용자 찾기 : " + user);
    if (!user) { // 사용자가 없음
      return res.status(400).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    // DB에서 비밀번호 비교 (bcrypt 적용, pw)
    const isMatch = await bcrypt.compare(password, user.pw);
    if (!isMatch) { // 비밀번호 불일치
      return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    // 세션에 사용자 ID 저장
    req.session.userId = user.id; 

    // 토큰 발급
    const token = jwt.sign({ userId: user.id }, 'MySecretKeyForToken', { expiresIn: '5s' });
    
    // 5. 성공 메시지와 함께 토큰을 손님에게 전달합니다.
    res.status(200).json({ message: '로그인 성공!', token: token });
  } catch (error) {
    // 중간에 에러가 나면 에러 메시지를 보냅니다.
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 회원가입 API

// app.js에 추가 (로그인 API 주변)

// 회원가입 API
app.post('/api/register', async (req, res) => {
    console.log("[REGISTER API]");
    try {
        const { nickname, password, name, email, comment } = req.body;
        
        // 1. 필수 값 확인
        if (!nickname || !password || !email) {
            return res.status(400).json({ message: '닉네임, 비밀번호, 이메일은 필수 입력값입니다.' });
        }
        
        // 2. 비밀번호 해싱 (bcrypt는 app.js 상단에 require 되어 있어야 함)
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 3. 사용자 생성 및 저장 (User 모델 사용)
        await User.create({
            nickname,
            pw: hashedPassword,
            name: name || null, // 값이 없으면 null 저장
            email,
            comment: comment || null,
            // point, last_post 등은 모델의 defaultValue를 따름
        });
        
        res.status(201).json({ message: '회원가입이 성공적으로 완료되었습니다! 로그인해 주세요.' });

    } catch (error) {
        console.error('회원가입 중 에러 발생:', error);
        
        // 이메일 또는 닉네임 중복 처리
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: '이미 사용 중인 닉네임 또는 이메일입니다.' });
        }
        
        res.status(500).json({ message: '서버 오류로 회원가입에 실패했습니다.' });
    }
});

// POST /api/game/ox: OX 퀴즈 결과 및 포인트 처리
app.post('/api/game/ox', checkAuthApi, async (req, res) => {
    console.log("[POST /api/game/ox]");
    const { is_correct, game_type } = req.body; 
    const user = req.user; 
    
    if (game_type !== 'ox') {
        return res.status(400).json({ message: '잘못된 게임 유형입니다.' });
    }

    let pointChange = 0;
    const POINT_PER_CORRECT = 5; // 퀴즈 1회 정답당 5포인트로 설정

    try {
        // 1. 정답을 맞췄는지 확인 (오답일 경우 포인트 지급하지 않음)
        if (!is_correct) {
            return res.status(200).json({ message: '오답입니다. 포인트 지급 없음.', pointChange: 0 });
        }

        // ⭐ 변경된 로직: 정답 시마다 포인트를 지급
        pointChange = POINT_PER_CORRECT;
        
        // 2. 포인트 업데이트
        await User.update({
            point: user.point + POINT_PER_CORRECT,
        }, {
            where: { id: user.id }
        });
        console.log(`[OX 퀴즈 포인트 지급] User ${user.id}에게 ${POINT_PER_CORRECT}점 지급.`);


        // 3. 응답 전송 (포인트 변경 정보를 클라이언트에게 전달)
        res.status(200).json({ 
            message: `정답입니다! ${POINT_PER_CORRECT} 포인트를 획득했습니다.`, 
            pointChange: pointChange 
        });

    } catch (error) {
        console.error('OX 퀴즈 점수 처리 중 에러 발생:', error);
        res.status(500).json({ message: 'OX 퀴즈 점수 처리 중 서버 오류가 발생했습니다.' });
    }
});

// ... app.post('/api/game/ox', checkAuthApi, ...) 아래에 이 코드를 추가

// POST /api/game/card: 카드 게임 결과 및 포인트 처리
app.post('/api/game/card', checkAuthApi, async (req, res) => {
    console.log("[POST /api/game/card]");
    const { final_score, game_type } = req.body; 
    const user = req.user; 
    
    if (game_type !== 'card' || typeof final_score !== 'number' || final_score < 0) {
        return res.status(400).json({ message: '잘못된 게임 결과 데이터입니다.' });
    }

    let pointChange = final_score; // 획득한 점수만큼 포인트 지급
    
    try {
        // ⭐ 변경된 로직: 점수만큼 포인트 지급
        if (pointChange > 0) {
            // 2. 포인트 업데이트
            await User.update({
                point: user.point + pointChange,
            }, {
                where: { id: user.id }
            });
            console.log(`[카드 게임 포인트 지급] User ${user.id}에게 ${pointChange}점 지급.`);
        }

        const responseMessage = pointChange > 0 
            ? `게임 종료! 최종 점수 ${final_score}점으로 ${pointChange} 포인트를 획득했습니다!`
            : '게임 종료. 획득한 포인트는 없습니다.';

        // 3. 응답 전송
        res.status(200).json({ 
            message: responseMessage, 
            pointChange: pointChange 
        });

    } catch (error) {
        console.error('카드 게임 점수 처리 중 에러 발생:', error);
        res.status(500).json({ message: '카드 게임 점수 처리 중 서버 오류가 발생했습니다.' });
    }
});

app.get('/upload', (req, res) => {
  res.sendFile(__dirname + '/multipart.html');
});

app.post('/upload', upload.single('image'), (req, res) => {
  console.log(req.file);
  res.send('파일 업로드 완료');
});

app.use((req, res, next) => { 
  console.log('모든 요청에 다 실행됩니다.');
  next();
});

app.get('/', (req, res, next) => {
  console.log('GET / 요청에서만 실행됩니다.');
  next();
});

app.use((req, res, next) => {
  res.status(404).send('Not Found');
  // const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  // error.status = 404;
  // next(error);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(err.message);
});

// sequelize.sync()를 호출하여 데이터베이스와 동기화
sequelize.sync({ force: false }) // force: false는 기존 테이블을 건드리지 않음
  .then(() => {
    console.log('데이터베이스 연결 성공');
    // 데이터베이스 연결 성공 시 서버 실행
    app.listen(app.get('port'), () => {
      console.log(`Example app listening at http://localhost:${app.get('port')}`);
    });
  })
  .catch((err) => {
    console.error('데이터베이스 연결 실패'); // 연결 실패 시 에러 로깅
    console.error(err); // 연결 실패 시 에러 로깅
  });
/*
app.get('/', (req, res) => {
  //res.send('Hello World!');
  res.sendFile(__dirname + '/home.html');
});



app.listen(app.get('port'), () => {
  console.log(`Example app listening at http://localhost:${app.get('port')}`);
});*/
