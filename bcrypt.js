// bcrypt 라이브러리를 불러옵니다.
const bcrypt = require('bcryptjs');

// 터미널에서 'node bcrypt_example.js <암호화할_비밀번호>' 형식으로
// 명령어 뒤에 비밀번호를 입력받습니다.
const plainPassword = process.argv[2];

// 비밀번호가 입력되지 않았으면 사용법을 안내하고 종료합니다.
if (!plainPassword) {
  console.error('오류: 암호화할 비밀번호를 입력해주세요.');
  console.log('사용법: node bcrypt_example.js <암호화할_비밀번호>');
  process.exit(1); // 오류 코드로 종료
}

// 암호화 복잡도(salt rounds). 보통 10~12 사이를 많이 사용합니다.
const saltRounds = 10;

// 비밀번호를 해싱하는 비동기 함수
async function hashPassword() {
  try {
    console.log(`원본 비밀번호: ${plainPassword}`);
    
    // bcrypt.hash 함수를 사용해 비밀번호를 해싱합니다.
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    
    console.log('---');
    console.log('✅ Bcrypt로 해싱된 비밀번호 (이 값을 DB에 저장하세요):');
    console.log(hashedPassword);
    console.log('---');

  } catch (error) {
    console.error('비밀번호 해싱 중 에러 발생:', error);
  }
}

// 함수 실행
hashPassword();