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
        name: {
            type: Sequelize.STRING(50),
            allowNull: false,
        },
        }, {
        sequelize,
        timestamps: false,
        underscored: false,
        modelName: 'Tag', 
        tableName: 'tags',
        paranoid: false,
        charset: 'utf8',
        collate: 'utf8_general_ci',
      });
  }
  static associate(db) {
        // N:M : Tag ↔ Log
        db.Tag.belongsToMany(db.Log, {
            through: 'tag_logs',
            foreignKey: 'tag_id',
            otherKey: 'log_id',
            onDelete: 'CASCADE',
        });
    }
};

module.exports = Tag;