const router = require('express').Router()

router.use('/auth', require('./auth.route'))
router.use('/store', require('./store.route'))
router.use('/memory', require('./memory.route'))
router.use('/mentor', require('./mentor.route'))
router.use('/token', require('./token.route'))
router.use('/admin', require('./admin.route'))
router.use('/feedback', require('./feedback.route'))

module.exports = router
