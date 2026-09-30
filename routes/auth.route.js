const router = require('express').Router()
const validate = require('../middlewares/validate')
const authCtrl = require('../controllers/auth.controller')

router.post('/login',
  validate([
    { field: 'username', required: true, type: 'string', min: 2, max: 50 },
    { field: 'password', required: true, type: 'string', min: 6, max: 64 }
  ]),
  authCtrl.login
)

router.post('/register',
  validate([
    { field: 'username', required: true, type: 'string', min: 2, max: 50 },
    { field: 'password', required: true, type: 'string', min: 6, max: 64 },
    { field: 'storeName', required: true, type: 'string', min: 2, max: 100 }
  ]),
  authCtrl.register
)

module.exports = router
