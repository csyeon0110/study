const express = require('express');
const morgan = require('morgan'); // HTTP 요청 로깅 미들웨어
const cookieParser = require('cookie-parser'); // 쿠키 파싱 미들웨어
const session = require('express-session'); // 세션 미들웨어
const dotenv = require('dotenv'); // .env 파일의 환경변수 로드
const path = require('path'); // 경로 조작 유틸리티
const nunjucks = require('nunjucks'); // 템플릿 엔진
const { sequelize, User } = require('./models'); // Sequelize ORM과 User 모델
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

app.use(cors()); // CORS 미들웨어 추가

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

// 로그인 API
app.post('/api/login', async (req, res) => {
  console.log("[LOGIN API]");
  try {
    const { username, password } = req.body; // 요청 바디에서 아이디와 비밀번호 추출 
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
/*
   // DB에서 비밀번호 비교 (암호화 적용 안함, pw)
    console.log("bcrypt 적용 비밀번호 : " + bcrypt.hash(password, 10));
    console.log("비밀번호 비교 : " + password + " / " + user.pw);
    if (password !== user.pw) {
      return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    res.status(200).json({ message: '로그인 성공!'});
*/
    // 토큰발행으로 로그인 할거??????????????????????????????????????????????????
    // 토큰 발급
    const token = jwt.sign({ userId: user.id }, 'MySecretKeyForToken', { expiresIn: '5s' });
    // 5. 성공 메시지와 함께 토큰을 손님에게 전달합니다.
    res.status(200).json({ message: '로그인 성공!', token: token });
  } catch (error) {
    // 중간에 에러가 나면 에러 메시지를 보냅니다.
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

/*
// 회원가입 API (참고용)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    //const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password });
    await newUser.save();
    res.status(201).json({ message: '회원가입 성공!' });
});
*/

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
      console.log(`${app.get('port')}번 포트에서 서버 대기 중`);
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