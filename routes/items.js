const express = require('express');
// sequelize 객체를 불러와 트랜잭션을 사용합니다.
const { Item, User, UserItem, sequelize } = require('../models'); 
const router = express.Router();

/**
 * GET /
 * 현재 유저의 포인트와 전체 아이템 목록을 조회합니다.
 */
router.get('/', async (req, res) => {
    try {
        // [임시] 유저 ID 1의 현재 포인트 조회. 실제 환경에서는 로그인된 유저의 ID를 사용해야 합니다.
        const userId = 1; 
        const user = await User.findByPk(userId, { attributes: ['point'] });
        
        // 아이템 목록 조회
        const items = await Item.findAll();

        res.json({
            userPoint: user ? user.point : 0,
            items: items
        });
    } catch (error) {
        console.error('아이템 목록 조회 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 목록을 가져오는 데 실패했습니다.' });
    }
});

/**
 * POST /buy/:itemId
 * 아이템 구매 로직을 처리합니다. (트랜잭션 필수)
 */
router.post('/buy/:itemId', async (req, res) => {
    // [임시] 유저 ID 1 사용. 실제 환경에서는 req.user.id 등으로 대체되어야 합니다.
    const userId = 1; 
    const itemId = req.params.itemId;

    // 1. 트랜잭션 시작
    // 포인트 차감과 로그 기록을 하나의 묶음으로 처리합니다.
    const t = await sequelize.transaction();

    try {
        // 2. 유저와 아이템 정보 조회 (트랜잭션 적용)
        const user = await User.findByPk(userId, { transaction: t });
        const item = await Item.findByPk(itemId, { transaction: t });

        if (!user || !item) {
            await t.rollback(); // 롤백
            return res.status(404).json({ message: '유저 또는 아이템을 찾을 수 없습니다.' });
        }

        const itemPrice = item.price;

        // 3. 포인트 확인
        if (user.point < itemPrice) {
            await t.rollback(); // 롤백
            return res.status(400).json({ message: '포인트가 부족하여 구매할 수 없습니다.' });
        }

        // 4. 포인트 차감 (UPDATE User SET point = point - price)
        // user.decrement는 포인트 필드를 주어진 값만큼 줄입니다.
        await user.decrement('point', { by: itemPrice, transaction: t });
        
        // 5. 구매 내역 기록 (INSERT INTO UserItems)
        await UserItem.create({
            userId: userId,
            itemId: itemId,
            // UserItem 모델에서 timestamps를 껐기 때문에 createdAt/updatedAt은 기록되지 않습니다.
        }, { transaction: t });
        
        // 6. 모든 작업 성공 시 트랜잭션 커밋
        await t.commit();
        
        // 성공 응답을 위해 업데이트된 유저 정보를 다시 조회합니다.
        const updatedUser = await User.findByPk(userId, { attributes: ['point'] }); 
        res.json({ 
            message: `${item.name} 구매 완료! 유저 포인트가 ${itemPrice}만큼 차감되었습니다.`,
            newPoint: updatedUser.point,
            purchasedItem: item
        });

    } catch (error) {
        // 오류 발생 시 트랜잭션 롤백 (이전 상태로 복구)
        await t.rollback();
        console.error('아이템 구매 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 구매 중 서버 오류가 발생했습니다.' });
    }
});

module.exports = router;