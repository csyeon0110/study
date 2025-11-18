const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
// config 폴더에 있는 환경 설정 파일을 가져옵니다.
const config = require('../config/config')[env]; 

// User와 Log 모델 파일을 불러옵니다.
const User = require('./user');
const Log = require('./log'); 
const Item = require('./item'); 

const db = {};
/*// Sequelize 인스턴스를 생성하고 연결합니다.
const sequelize = new Sequelize(
  config.database, config.username, config.password, config,
);
*/

// ** 수정 ** sequelize 인스턴스 생성 - 환경에 따라 다르게 설정
let sequelize;

if (env === 'production') {
  // [1] Production 환경: Render의 DATABASE_URL 환경 변수를 사용합니다.
  sequelize = new Sequelize(
    process.env.DATABASE_URL, {
      dialect: 'postgres', // PostgreSQL 명시
      dialectOptions: {
        // Render DB 연결을 위해 SSL 옵션 필수 설정
        ssl: {
          require: true, 
          rejectUnauthorized: false
        }
      },
      // 기타 필요한 production 옵션 (예: logging: false)
  });
} else {
  // [2] Development/Test 환경: config.json의 개별 설정을 사용합니다.
  sequelize = new Sequelize(
    config.database, config.username, config.password, config,
  );
}
db.sequelize = sequelize;
// db 객체에 모델들을 연결합니다.
db.User = User;
db.Log = Log; 
db.Item = Item; // ⭐ Item 모델 DB 객체에 추가

if (env === 'production') { // theme 아이템 초기 데이터 삽입 (프로덕션 환경에서만 최초 배포시 실행)
    sequelize.sync({ force: false }).then(async () => {
        // 이미 데이터가 있는지 확인합니다.
        const count = await Item.count();

        if (count === 0) {
            console.log('--- DEBUG: Initial shop theme data insertion started ---');
            const THEMES = [
                { name: 'diary', type: 'theme', price: 0, description: '종이 질감 : 기본 테마' },
                { name: 'dev', type: 'theme', price: 100, description: '어두운 배경 & 청록색 네온 : 코딩 컨셉 테마' },
                { name: 'pastel', type: 'theme', price: 150, description: '부드러운 파스텔 톤 : 귀여운 테마' },
                { name: 'autumn', type: 'theme', price: 150, description: '차분한 황토색 & 짙은 갈색 : 가을 감성 테마' },
                { name: 'forest', type: 'theme', price: 200, description: '민트 & 나무색 : 상쾌한 숲 테마' },
                { name: 'game', type: 'theme', price: 200, description: '네온 핑크 & 형광 녹색 : 레트로 아케이드 테마' },
            ];
            await Item.bulkCreate(THEMES); // 데이터 일괄 삽입
            console.log('--- DEBUG: 6 theme items successfully inserted ---');
        }
    }).catch(err => {
        console.error('Initial data sync error:', err);
    });
}

// 1. 모든 모델 초기화 (init): 관계 설정 전에 속성들을 Sequelize에 등록합니다.
User.init(sequelize);
Log.init(sequelize); 
Item.init(sequelize); // ⭐ Item 모델 초기화

// ⭐ 2. 모든 모델 초기화가 끝난 후, associate 호출 (순서 중요!): 
// 이제 User가 Log를 알고, Log가 User를 알게 됩니다.
User.associate(db);
Log.associate(db); 
Item.associate(db); // ⭐ Item 모델 관계 설정 추가

module.exports = db;

/*const Sequelize = require('sequelize');
const User = require('./user');

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config')[env];
const db = {};

let sequelize = new Sequelize(config.database, config.username, config.password, config);

db.sequelize = sequelize;

db.User = User;
User.init(sequelize);
User.associate(db);

module.exports = db;
*/
/*'use strict'; // sequelize-cli 가 자동으로 생성해주는 코드

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
*/