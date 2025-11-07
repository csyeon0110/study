const Sequelize = require('sequelize');

class Log extends Sequelize.Model { // 클래스 이름 'Logs'를 'Log'로 변경
  static init(sequelize) {
    super.init({
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,  
            autoIncrement: true,
        },
        title: {
            type: Sequelize.STRING(255),
            allowNull: false,
        },
        content: { // 'comment' 대신 'content' 사용
            type: Sequelize.TEXT('medium'),
            allowNull: true,
        },
        // created_at 필드는 Sequelize의 timestamps: true를 사용하거나 
        // 직접 정의할 수 있지만, 여기서는 기존 필드명을 유지합니다.
        created_at: { 
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW,
        },
        // author 필드는 belongsTo 관계로 자동 처리되므로 제거합니다.
        }, {
        sequelize,
        timestamps: false,
        underscored: false,
        modelName: 'Log', 
        tableName: 'logs',
        paranoid: false,
        charset: 'utf8',
        collate: 'utf8_general_ci',
      });
  }
  static associate(db) {
      // ⭐ 외래 키 설정: Log는 하나의 User에 속함
      db.Log.belongsTo(db.User, {
          foreignKey: 'UserId', // Log 테이블에 UserId 컬럼이 생성됨
          targetKey: 'id'       // User 테이블의 id를 참조함
      });
  }
};

module.exports = Log;