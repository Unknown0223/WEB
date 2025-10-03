// routes/sessions.js

const express = require('express');
const { dbPromise } = require('../db.js');
const { isAdmin } = require('../middleware/auth.js');

const router = express.Router();

// DELETE /api/sessions/:sid - Muayyan sessiyani tugatish
router.delete('/:sid', isAdmin, async (req, res) => {
    const sid = req.params.sid;
    try {
        const db = await dbPromise;
        const result = await db.run("DELETE FROM sessions WHERE sid = ?", sid);
        
        if (result.changes === 0) {
            return res.status(404).json({ message: "Sessiya topilmadi yoki allaqachon tugatilgan." });
        }

        res.json({ message: "Sessiya muvaffaqiyatli tugatildi." });
    } catch (error) {
        console.error(`/api/sessions/${sid} DELETE xatoligi:`, error);
        res.status(500).json({ message: "Sessiyani tugatishda xatolik." });
    }
});

module.exports = router;
