const express = require('express');
const router = express.Router();
const autoSyncController = require('../controllers/auto-sync-controller');
const authenticatePlugin = require('../middlewares/authenticate-plugin');

router.post('/',  autoSyncController.createSubAccountReference);

router.post('/verify', autoSyncController.verifyAutoSync);

router.post('/authenticate', authenticatePlugin(), autoSyncController.authenticateAutoSyncPlugin);

router.get('/all/:subAccountId/:broker',  autoSyncController.getAutoSyncReferences);

router.delete('/:id',  autoSyncController.deleteAutoSyncReference);

router.post('/add/limit', authenticatePlugin(), autoSyncController.limitDataHook)

router.post('/add/trade', authenticatePlugin(), autoSyncController.addTradeHook);

module.exports = router;