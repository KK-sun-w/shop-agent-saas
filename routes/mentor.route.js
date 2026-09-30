const router = require('express').Router()
const { auth } = require('../middlewares/auth')
const validate = require('../middlewares/validate')
const mentorCtrl = require('../controllers/mentor.controller')

router.use(auth)

router.post('/chat',
  validate([{ field: 'message', required: true, type: 'string', min: 1, max: 4000 }]),
  mentorCtrl.chat
)

module.exports = router
