const Sequelize = require('sequelize');

module.exports = class Item extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            name: {
                type: Sequelize.STRING(100),
                allowNull: false,
                unique: true,
            },
            type: {
                type: Sequelize.ENUM('title', 'theme'),
                allowNull: false,
            },
            price: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            description: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
        }, {
            sequelize,
            timestamps: false,
            underscored: true,
            modelName: 'Item',
            tableName: 'items', 
            charset: 'utf8',
            collate: 'utf8_general_ci',
        });
    }

    // User와 Item 간의 다대다(Many-to-Many) 관계 설정 (user_items 테이블 사용)
    static associate(db) {
        db.Item.belongsToMany(db.User, { through: 'user_items', foreignKey: 'item_id', timestamps: false });
    }
};