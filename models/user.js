const Sequelize = require('sequelize');

class User extends Sequelize.Model {
  static init(sequelize) {
    super.init({
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        pw: {
            type: Sequelize.STRING(255),
            allowNull: false,
        },
        nickname: {
            type: Sequelize.STRING(20),
            allowNull: false,
            unique: true,
        },
        name: {
            type: Sequelize.STRING(20),
            allowNull: true,
        },
        email: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: true,
        },
        comment: {
            type: Sequelize.STRING(255),
            allowNull: true,
        },
        img_url: {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: '/images/ham.jpg',
        },
        created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.NOW,
        },
        point: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        last_post: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        last_game: {
            type: Sequelize.DATE,
            allowNull: true,
        },
        dday: {
            type: Sequelize.DATEONLY, // D-Day는 날짜만 저장 (DATEONLY로 변경)
            allowNull: true,
        },
        goal_event: {
            type: Sequelize.STRING(255), // D-Day는 날짜만 저장 (DATEONLY로 변경)
            allowNull: true,
        },
        }, {
        sequelize,
        timestamps: false,
        underscored: false,
        modelName: 'User',
        tableName: 'users',
        paranoid: false,
        charset: 'utf8',
        collate: 'utf8_general_ci',
      });
  }
  static associate(db) {
      // User는 여러 개의 Log를 가질 수 있음 (1:N 관계)
      db.User.hasMany(db.Log, {
          foreignKey: 'UserId', // Log 테이블에 생성될 외래 키 컬럼 이름
          sourceKey: 'id',      // User 테이블의 참조할 컬럼 (User의 id)
          onDelete: 'cascade'   // User 삭제 시 연결된 Log도 함께 삭제
      });
  }
};

module.exports = User;