const Sequelize = require('sequelize');

// 클래스 이름은 UserItems로 설정
module.exports = class UserItems extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            // id 컬럼 정의 (DB의 AUTO_INCREMENT PRIMARY KEY와 일치)
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            // ⭐ user_id 컬럼 직접 정의 (belongsToMany 관계와 일치) ⭐
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            // ⭐ item_id 컬럼 직접 정의 (belongsToMany 관계와 일치) ⭐
            item_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'items', key: 'id' },
            },
            
            // ⭐⭐ created_at 컬럼을 직접 정의하여 Sequelize의 자동 처리를 회피 ⭐⭐
            created_at: {
                type: Sequelize.DATE,
                allowNull: true,
                defaultValue: Sequelize.NOW,
            }
        }, {
            sequelize,
            timestamps: false, // ⭐⭐⭐ 타임스탬프 기능을 완전히 비활성화 ⭐⭐⭐
            underscored: true, // DB의 스네이크 케이스 이름을 유지 (created_at)
            modelName: 'UserItems',
            tableName: 'user_items', // 고객님이 생성하신 테이블 이름과 일치
            charset: 'utf8',
            collate: 'utf8_general_ci',
        });
    }

    // 중간 테이블이므로 associate 함수는 비워둡니다.
    static associate(db) {}
};