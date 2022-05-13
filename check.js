
module.exports = {
    isAdmin: (bot, chatId, userId, cb) => {
        bot.getChatAdministrators(chatId).then((data) => {
            data.forEach(element => {
                if (element.user.id == userId && (element.can_change_info || element.status == "creator")) {
                    cb();
                }
            })
        })
    },
    isMod: (bot, chatId, userId, cb) => {
        bot.getChatAdministrators(chatId).then((data) => {
            data.forEach(element => {
                if (element.user.id == userId && (element.can_restrict_members && element.status == "administrator" || element.status == "creator")) {
                    cb();
                }
            })
        })
    },


    isnotMod: (bot, chatId, userId, cb) => {
        bot.getChatMember(chatId, userId).then((data) => {
            if (data.status = "member") {
                cb();
            }
        })
    },


    isVice: (bot, chatId, userId, cb) => {
        bot.getChatAdministrators(chatId).then((data) => {
            data.forEach(element => {
                if (element.user.id == userId && (element.can_promote_members || element.status == "creator")) {
                    cb();
                }
            })
        })
    },

    isFounder: (bot, chatId, userId, cb) => {
        bot.getChatAdministrators(chatId).then((data) => {
            data.forEach(element => {
                if (element.user.id == userId && element.status == "creator") {
                    cb();
                }
            })
        })
    },

    checkAll: ((bot, chatId, userId, cbFounder, cbVice, cbAdmin, cbMod, cbMember) => {
        bot.getChatAdministrators(chatId).then((data) => {
            data.forEach(element => {
                if (element.user.id == userId && element.status == "creator") {
                    cbFounder();
                } else if (element.user.id == userId && element.can_promote_members && element.status == "administrator") {
                    cbVice();
                } else if (element.user.id == userId && element.can_change_info && !(element.can_promote_members)) {
                    cbAdmin();
                } else if (element.user.id == userId && element.can_restrict_members && !(element.can_change_info)) {
                    cbMod();
                } else if (data.status = "member") {
                    cbMember();
                }
            })
        })
    }),
}