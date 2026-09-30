const router = require('express').Router()
const { auth } = require('../middlewares/auth')
const storeCtrl = require('../controllers/store.controller')

router.use(auth)

router.get('/my', storeCtrl.getMyStore)
router.put('/my', storeCtrl.updateStore)

module.exports = router
