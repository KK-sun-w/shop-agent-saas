const { ok } = require('../utils/response')
const mentorService = require('../services/mentor.service')

const chat = async (req, res, next) => {
  try {
    const data = await mentorService.chat({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      userInput: req.body.message
    })
    ok(res, data)
  } catch (e) { next(e) }
}

module.exports = { chat }
