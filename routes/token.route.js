const router = require('express').Router()
const { auth } = require('../middlewares/auth')
const tokenCtrl = require('../controllers/token.controller')

router.use(auth)

router.get('/my-quota', tokenCtrl.myQuota)
router.get('/my-usage', tokenCtrl.myUsage)

module.exports = router
