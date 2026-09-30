const router = require('express').Router()
const { auth } = require('../middlewares/auth')
const validate = require('../middlewares/validate')
const memoryCtrl = require('../controllers/memory.controller')

router.use(auth)

router.get('/', memoryCtrl.list)
router.get('/preview', memoryCtrl.preview)
router.post('/',
  validate([
    { field: 'memory_type', required: true, type: 'string' },
    { field: 'memory_content', required: true, type: 'string' }
  ]),
  memoryCtrl.create
)
router.put('/:id', memoryCtrl.update)
router.delete('/:id', memoryCtrl.remove)

module.exports = router
