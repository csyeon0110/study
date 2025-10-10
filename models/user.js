const Sequelize = require('sequelize');

class User extends Sequelize.Model {
  static init(sequelize) {
    super.init({
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
    static associate(db) {}
};

module.exports = User;