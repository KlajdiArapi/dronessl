const TelegramBot = require("node-telegram-bot-api");
const fs = require('fs');
const token = JSON.parse(fs.readFileSync("token.json"))[0].token;
const mysql = require("mysql");
const check = require("./check");
const generator = require("generate-password")
const express = require('express')
const ejs = require('ejs');
const basicAuth = require('express-basic-auth');
require('dotenv').config();

var app = express();
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(basicAuth({ authorizer: myauthorizer, challenge: true, authorizeAsync: true }))

var conn = mysql.createConnection({
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE
})

function myauthorizer(username, password, cb) {
    conn.query("SELECT count (idGroup) AS CONT FROM groups WHERE groupName = ? and password = ?", [username, password], (error, results) => {
        if (error) throw error;
        return cb(null, results[0].CONT > 0);
    })
}

//--------------------WEB-SITE---------------------------

app.route('/home')
    .get(async (req, res) => {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        conn.query("SELECT * from groups WHERE groupName = ?", [username], (error, results) => {
            if (error) throw error;
            res.render(`home`, { items: results })
        })
    })

app.route('/home/rules')
    .get((req, res) => {
        res.render(`rules`)
    })

    .post((req, res) => {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        console.log(req.body.regole);
        conn.query("UPDATE groups SET groupRules = ? WHERE groupName = ?", [req.body.regole, username], (error, results, fields) => {
            if (error) throw error;
            res.redirect('/home');
        })
    })

app.route('/home/acceptbots')
    .post((req, res) => {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        conn.query("UPDATE groups set acceptBots = ? WHERE groupName = ?", [1, username], (error, results) => {
            if (error) throw error;
            res.redirect('/home');
        })
    })

app.route('/home/denybots')
    .post((req, res) => {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');

        conn.query("UPDATE groups set acceptBots = ? WHERE groupName = ?", [0, username], (error, results) => {
            if (error) throw error;
            res.redirect('/home');
        })
    })

app.route('/home/3warns')
    .post((req, res) => {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        conn.query("UPDATE groups set maxWarns = ? WHERE groupName = ?", [3, username], (error, results) => {
            if (error) throw error;
            res.redirect('/home');
        })
    })
app.route('/home/5warns')
    .post((req, res) => {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(':');
        conn.query("UPDATE groups set maxWarns = ? WHERE groupName = ?", [5, username], (error, results) => {
            if (error) throw error;
            res.redirect('/home');
        })
    })


app.listen(3000, () => {
    console.log('Server accessible via: http://localhost:3000/');
});



//------------------------BOT-------------------------------

const bot = new TelegramBot(token, { polling: true });

bot.on("polling_error", console.log);

//--------start in supergroups && pvt---------------
bot.onText(/\/start/, (msg) => {
    let password;
    if (msg.chat.type == "supergroup") {
        check.isFounder(bot, msg.chat.id, msg.from.id, () => {
            conn.query("select groupName FROM groups", (error, results) => {
                if (error) throw error;
                if (!results.map(el => el.groupName).includes(msg.chat.id.toString())) {
                    password = generator.generate({
                        length: 10,
                        numbers: false
                    })

                    conn.query("INSERT INTO groups (groupName,maxWarns,password) VALUES (?,3,?)", [msg.chat.id, password])

                    bot.sendMessage(msg.chat.id, "Protocollo di registrazione avviato da: @" + msg.from.username);
                    bot.sendMessage(msg.from.id, `<b>Per gestire il gruppo via web usa queste credenziali:</b>\n\n<i>username:</i> ${msg.chat.id}\n<i>password:</i> ${password}` + msg.from.username, { parse_mode: "HTML" });

                } else {
                    bot.sendMessage(msg.chat.id, "Gruppo già inizializzato!")
                }
            })
        })
    } else if (msg.chat.type == "private") {
        bot.sendMessage(msg.chat.id, `Hey questo bot creato da @FlyTxR ti permette di gestire al meglio il tuo supergruppo, aggiungimi `)
    }
})

//----------New member----------------
bot.on('message', (msg) => {
    if (msg.new_chat_members != undefined) {
        msg.new_chat_members.forEach(el => {
            if (el.username != undefined && !el.is_bot) {
                conn.query("SELECT username from users WHERE idUserTelegram =? AND idGroup = ?", [el.id, msg.chat.id], (error, results) => {
                    if (error) throw error;
                    if (!results.map(el => el.username).includes(el.username)) {
                        conn.query("INSERT INTO users (idGroup,firstname,username,idUserTelegram) VALUES (?,?,?,?)", [msg.chat.id, el.first_name, el.username, el.id], (error, results) => {
                            if (error) throw error
                            bot.sendMessage(msg.chat.id, `Benvenuto <b>${el.first_name}</b> in @${msg.chat.username}`, { parse_mode: "HTML" });
                            bot.restrictChatMember(msg.chat.id, el.id, {
                                can_send_messages: true
                            })
                        })
                    } else {
                        bot.sendMessage(msg.chat.id, `Benvenuto <b>${el.first_name}</b> in @${msg.chat.username}`, { parse_mode: "HTML" });
                    }
                })
            } else {
                const opts = {
                    parse_mode: "HTML",
                    reply_markup: JSON.stringify({
                        inline_keyboard: [
                            [{ text: 'Verifica', callback_data: 'verify-username' }],
                        ]
                    })
                }
                if (el.is_bot) {
                    conn.query("SELECT acceptBots from groups WHERE groupName =? ", [msg.chat.id], (error, results) => {
                        if (error) throw error;
                        if (results.map(el => el.acceptBots).includes(0)) {
                            bot.kickChatMember(msg.chat.id, el.id);
                            bot.unbanChatMember(msg.chat.id, el.id);
                            bot.sendMessage(msg.chat.id, `Il bot ${el.username} ha provato ad entrare ma è stato <b>bloccato</b>`, { parse_mode: "HTML" })
                        }
                    })
                }
                else {
                    bot.sendMessage(msg.chat.id, `<a href="tg://user?id=${el.id}">${el.first_name}</a> imposta uno username poi clicca <i>verifica</i>`, opts)
                }
            }
        })
    }
});

//------check-if-user-in-db------- 
bot.on('message', (msg) => {
    if (msg.text != undefined && msg.from.username && !msg.from.is_bot) {
        conn.query("SELECT username from users WHERE idUserTelegram =? AND idGroup = ?", [msg.from.id, msg.chat.id], (error, results) => {
            if (error) throw error;
            if (!results.map(el => el.username).includes(msg.from.username)) {
                conn.query("INSERT INTO users (idGroup,firstname,username,idUserTelegram) VALUES (?,?,?,?)", [msg.chat.id, msg.from.first_name, msg.from.username, msg.from.id], (error, results) => {
                    if (error) throw error
                    bot.restrictChatMember(msg.chat.id, msg.from.id, {
                        can_send_messages: true
                    })
                })
            }
        })
    }
});

//------SETTINGS--------
bot.onText(/\/impostazioni/, (msg) => {
    check.isAdmin(bot, msg.chat.id, msg.from.id, () => {
        const opts = {
            parse_mode: "HTML",
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{ text: '🤖Blocco bot', callback_data: 'block-bots' }, { text: '❕Warns', callback_data: 'set-warns' }],
                ]
            })
        }
        bot.sendMessage(msg.chat.id, "<b>⚙️Impostazioni⚙️</b>", opts)
    })
})

//------buttons-actions----------
bot.on('callback_query', function onCallbackQuery(callbackQuery) {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;

    //-------verify-username-new-member--------
    if (action == "verify-username") {
        if (callbackQuery.from.id != undefined) {
            conn.query("SELECT username from users WHERE idUserTelegram =?", [callbackQuery.from.id], (error, results) => {
                if (error) throw error
                if (!results.map(el => el.username).includes(callbackQuery.from.username)) {
                    conn.query("INSERT INTO users (idGroup,firstname,username,idUserTelegram) VALUES (?,?,?,?)", [callbackQuery.message.chat.id, callbackQuery.from.first_name, callbackQuery.from.username, callbackQuery.from.id], (error, results) => {
                        if (error) throw error
                        bot.sendMessage(callbackQuery.message.chat.id, `Benvenuto <b>${callbackQuery.from.first_name}</b>  in @${callbackQuery.message.chat.username}`, { parse_mode: "HTML" });
                        bot.restrictChatMember(callbackQuery.message.chat.id, callbackQuery.from.id, {
                            can_send_messages: true
                        })

                    })
                }
            })
        }
    }



    //--------SETTINGS-NEW-MEMBER-IS-BOT-------
    const optsB = {
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: '✔️Attiva', callback_data: 'enable-block-bots' }, { text: '✖ Disattiva', callback_data: 'disable-block-bots' }],
                [{ text: 'Chiudi', callback_data: 'close' }]
            ]
        })
    }
    if (action == "block-bots") {
        if (callbackQuery.from.id != undefined) {
            check.isAdmin(bot, msg.chat.id, userId, () => {
                bot.deleteMessage(msg.chat.id, msg.message_id);
                conn.query("SELECT acceptBots FROM groups WHERE groupName =?", [msg.chat.id], (error, results) => {
                    if (error) throw error;
                    if (results[0].acceptBots == 0) {
                        bot.sendMessage(msg.chat.id, "<b>🤖Blocco bot:</b> <em>Attivato</em>\n\n<i>Nessun bot potrà essere aggiunto al gruppo</i>", optsB)
                    } else {
                        bot.sendMessage(msg.chat.id, "<b>🤖Blocco bot:</b> <em>Disattivato</em>\n\n<i>I bot potranno essere aggiunti al gruppo</i>", optsB)
                    }
                })
            })
        }
    }

    if (action == "enable-block-bots") {
        check.isAdmin(bot, msg.chat.id, userId, () => {
            conn.query("UPDATE groups SET acceptBots = 0 WHERE groupName = ?", [msg.chat.id], (error, results) => {
                if (error) throw error;
                bot.deleteMessage(msg.chat.id, msg.message_id);
                bot.sendMessage(msg.chat.id, "<b>🤖Blocco bot:</b> <em>Attivato</em>\n\n<i>Nessun bot potrà essere aggiunto al gruppo</i>", optsB)
            })
        })
    } else if (action == "disable-block-bots") {
        check.isAdmin(bot, msg.chat.id, userId, () => {
            conn.query("UPDATE groups SET acceptBots = 1 WHERE groupName = ?", [msg.chat.id], (error, results) => {
                if (error) throw error;
                bot.deleteMessage(msg.chat.id, msg.message_id);
                bot.sendMessage(msg.chat.id, "<b>🤖Blocco bot:</b> <em>Disattivato</em> \n\n<i>I bot potranno essere aggiunti al gruppo</i>", optsB)
            })
        })
    }


    //------SETTINGS-GROUP-WARNS------

    const optsW = {
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [{ text: '3', callback_data: 'set-3-max-warns' }, { text: '5', callback_data: 'set-5-max-warns' }],
                [{ text: 'Chiudi', callback_data: 'close' }]
            ]
        })

    }
    if (action == "set-warns") {
        if (callbackQuery.from.id != undefined) {
            check.isAdmin(bot, msg.chat.id, userId, () => {
                conn.query("SELECT maxWarns FROM groups WHERE groupName =?", [msg.chat.id], (error, results) => {
                    if (error) throw error;
                    if (results[0].acceptBots == 3) {
                        bot.sendMessage(msg.chat.id, "<b>❕Ammonizioni</b>\n\n<i>Al raggiungimento dei:</i> <b>3 warn</b>\nL'utente verrà: <b>espulso</b>", optsW)
                    } else {
                        bot.sendMessage(msg.chat.id, "<b>❕Ammonizioni</b>\n\n<i>Al raggiungimento dei:</i> <b>5 warn</b>\nL'utente verrà: <b>espulso</b>", optsW)
                    }
                })
            })
        }
    }

    if (action == "set-3-max-warns") {
        if (callbackQuery.from.id != undefined) {
            check.isAdmin(bot, msg.chat.id, userId, () => {
                conn.query("UPDATE groups SET maxWarns = 3 WHERE groupName = ?", [msg.chat.id], (error, results) => {
                    if (error) throw error;
                    bot.deleteMessage(msg.chat.id, msg.message_id);
                    bot.sendMessage(msg.chat.id, "<b>❕Ammonizioni</b>\n\n<i>Al raggiungimento dei:</i> <b>3 warn</b>\nL'utente verrà: <b>espulso</b>", optsW)
                })
            })
        }
    }

    if (action == "set-5-max-warns") {
        if (callbackQuery.from.id != undefined) {
            check.isAdmin(bot, msg.chat.id, userId, () => {
                conn.query("UPDATE groups SET maxWarns = 5 WHERE groupName = ?", [msg.chat.id], (error, results) => {
                    if (error) throw error;
                    bot.deleteMessage(msg.chat.id, msg.message_id);
                    bot.sendMessage(msg.chat.id, "<b>❕Ammonizioni</b>\n\n<i>Al raggiungimento dei:</i> <b>5 warn</b>\nL'utente verrà: <b>espulso</b>", optsW)
                })
            })
        }
    }

    if (action == "close") {
        if (callbackQuery.from.id != undefined) {
            check.isAdmin(bot, msg.chat.id, userId, () => {
                bot.deleteMessage(msg.chat.id, msg.message_id);
            })
        }
    }
});


//------Everyone can do---------

//----all-personal-info----
bot.onText(/\/io/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id
    let usrWarn;
    let grpWarn
    const userName = msg.from.username

    conn.query("SELECT maxWarns FROM groups WHERE groupName = ?", [chatId], (error, results) => {
        if (error) throw error;
        console.log(results);
        if (results.length > 0) {
            grpWarn = results[0].maxWarns;
            conn.query("SELECT idUserTelegram,warns FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
                if (error) throw error
                if (results.length > 0) {
                    usrWarn = results[0].warns
                    bot.sendMessage(chatId, `Apri in <a href="tg://user?id=5224054661"><u>privato</u></a>`, { parse_mode: "HTML" })
                    bot.sendMessage(userId, `👤<b>Tue Info</b>👤\n\n\n🆔: [${userId}]\n👦  <b>Nome</b>: ${msg.from.first_name} \n❕  Warns: ${usrWarn}/${grpWarn}\n`, { parse_mode: "HTML" })
                }
            });
        }
    })
})

//----------STAFF----------
bot.onText(/\/staff/, (msg) => {
    chatId = msg.chat.id
    var option = {
        "parse_mode": "HTML",
    };
    let staff = "<b>STAFF del GRUPPO</b> \n\n"
    let founder = "<b>👑 Fondatore</b> \n"
    let admins = ""
    let vice = ""
    let mods = ""
    bot.getChatAdministrators(chatId)
        .then((data) => {
            data.forEach(el => {
                if (el.status == "creator") {
                    founder += `└<a href="tg://user?id=${el.user.id}">${el.user.first_name}</a>`;
                } else if (el.status == "administrator" && !el.user.is_bot) {
                    if (el.can_promote_members) {
                        vice += `└<a href="tg://user?id=${el.user.id}">${el.user.first_name}</a>\n`;
                    } else if (el.can_change_info) {
                        admins += `└<a href="tg://user?id=${el.user.id}">${el.user.first_name}</a>\n`;
                    } else if (el.can_delete_messages && !el.user.is_bot && !el.can_change_info) {
                        mods += `└<a href="tg://user?id=${el.user.id}">${el.user.first_name}</a>\n`;
                    }
                }
            })
            if (vice.length > 0) {
                vice = "<b>⚜️ Vice-fondatori\n</b>" + vice
                vice = vice + "\n"
            }
            if (admins.length > 0) {
                admins = "<b>👮🏼 Amministratori \n</b>" + admins
                admins = admins + "\n"
            }
            if (mods.length > 0) {
                mods = "<b>👷 Moderatori \n</b>" + mods
                mods = mods + "\n"
            }

            founder += "\n\n";
            staff += founder + vice + admins + mods;
            bot.sendMessage(chatId, staff, option)
        })
})

//-------REGOLE----------
bot.onText(/\/regole/, (msg) => {
    var chatId = msg.chat.id;
    var option = {
        "parse_mode": "HTML",
    };
    conn.query("SELECT groupRules FROM groups WHERE groupName = ?", [chatId], (error, results) => {
        if (error) throw error
        if (results[0].groupRules != "") {
            bot.sendMessage(chatId, "<b>REGOLE del GRUPPO \n\n</b>" + results[0].groupRules, option)
        } else {
            bot.sendMessage(chatId, "Regole del gruppo non impostate, per impostarle usare il comando\n" + " <b>/setregole</b>" + " </i>{Regolamento}</i>", option)
        }
    })

});

//----help--commands-----
bot.onText(/\/commands/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const cmdMember = `<b>👤 Members commands</b>\n\n/io ➡ Pvt message of all yours info of the group\n/staff ➡ Show all the staff of the group\n/regole ➡ Show all the rules of the group (if they've set them`;
    const cmdMod = `<b>👷 Moderation Commands</b>\n\n/del {reply} ➡ Delete a message\n/info {username} ➡ gets all info of a user\n/warn {username} ➡ Warns a user\n/unwarn {username} ➡ Remove a warn to a user\n/resetwarns {username} ➡ Reset all warns of a user\n/kick {username} ➡ Kick a user from the group (he can join back)\n/ban {username} ➡ Ban a user\n/unban {username} ➡ Unban a user\n/mute {username} ➡ Prohibit a user from writing\n/unmute {username} ➡ Allow a user to write\n/pin {reply} ➡ Pin the message\n/unpin ➡ Unpin all the pinned meessages\n\n`
    const cmdAdmin = `<b>👮🏼 Administration Commands\n\n</b>/setregole {text} ➡ The text will be saved as the rules of the group, /regole in the group to show the rules\n/mod {username} ➡ Give the powers of a mod to a user\n/unmod {username} ➡ Take away the powers of Mod from a user\n/sendmessage {text} ➡ The text will be sended by the bot and signed as <i>The Staff</i>\n\n`
    const cmdVice = `<b>⚜️ Vice-Founder Commands\n\n</b>/admin {username} ➡ Give the powers of an Administrator to a user\n/unadmin {username} ➡ Take away the powers of Admin from a user\n\n`
    const cmdFounder = `<b>👑 Founder Commands\n\n</b>/vice {username} ➡ Give the powers of a vice-founder to a user\n/unvice {username} ➡ Take away the powers of vice-founder from a user\n\n`

    if (msg.chat.type == "supergroup") {

        bot.sendMessage(chatId, `Apri in <a href="tg://user?id=5224054661"><u>privato</u></a>`, { parse_mode: "HTML" })
        bot.sendMessage(userId, cmdFounder + cmdVice + cmdAdmin + cmdMod + cmdMember, { parse_mode: "HTML" })
    } else if (msg.chat.type == "private") {
        bot.sendMessage(userId, `<i><b>💁‍♂️Here the list of all the commands divided by roles</b></i>\n\n\n` + cmdFounder + cmdVice + cmdAdmin + cmdMod + cmdMember, { parse_mode: "HTML" })
    }
})
bot.onText(/\/help/, (msg) => {
    const userId = msg.from.id;

    if (msg.chat.type == "private") {
        bot.sendMessage(userId, `<b>For the bot to work correctly you must set it as an administrator (in order to use commands like <i>/admin {username}</i> you must turn on the property that allows the bot to promote other users) and then type the command /start in the group</b>\n\nFor the list of all the commands type /commands`, { parse_mode: "HTML" })
    }
})

/*----ONLY-MODS----*/

//-----delete message------
bot.onText(/\/del/, (msg) => {
    check.isMod(bot, msg.chat.id, msg.from.id, () => {
        if (msg.reply_to_message) {
            bot.deleteMessage(msg.chat.id, msg.reply_to_message.message_id)
            bot.deleteMessage(msg.chat.id, msg.message_id)
        }
    })
})

//-----get-all-info-of-a-user---
bot.onText(/\/info (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id
    var usrRole;
    let grpWarn;
    const userName = match[1].substring(1)
    check.isMod(bot, chatId, userId, () => {
        conn.query("SELECT maxWarns FROM groups WHERE groupName = ?", [chatId], (error, results) => {
            if (error) throw error;
            if (results.length > 0) {
                grpWarn = results[0].maxWarns;
                conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
                    if (error) throw error
                    if (results.length > 0) {
                        bot.getChatMember(chatId, results[0].idUserTelegram)
                            .then((data) => {
                                if (data.status == "creator") {
                                    usrRole = "Founder"
                                } else if (data.status = "member") {
                                    usrRole = "👤Membro"
                                }

                                console.log(usrRole);
                                usrWarn = results[0].warns
                                bot.sendMessage(chatId, `🆔 <b>ID:</b> [${userId}]\n👦 <b>Username</b>: @${results[0].username} \n⚕️<b>Ruolo: </b> ${usrRole} \n❕ <b>Warns:</b> <i> ${results[0].warns}</i>\n`, { parse_mode: "HTML" })
                            })
                    }
                });
            }
        })
    })
})

//--------warn--w-tag-------
bot.onText(/\/warn (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userId = msg.from.id
    var userName = match[1].substring(1);
    let grpWarn;
    let usrWarn;
    check.isMod(bot, chatId, userId, () => {
        conn.query("SELECT maxWarns from groups WHERE groupName = ?", [chatId], (error, results) => {
            if (error) throw error;
            grpWarn = results[0].maxWarns;
            conn.query("SELECT idUserTelegram,warns FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
                if (error) throw error
                if (results.length > 0) {
                    usrWarn = results[0].warns + 1;
                    if (usrWarn >= grpWarn) {
                        bot.kickChatMember(chatId, results[0].idUserTelegram)
                        bot.sendMessage(chatId, `@${userName} è arrivato a ${usrWarn} warn\nAzione: <b>Kickato</b>`, { parse_mode: "HTML" })
                    }
                    else bot.sendMessage(chatId, `@${userName} è stato ammonito per la ${usrWarn}° volta (su ${grpWarn})`, { parse_mode: "HTML" })
                    conn.query("UPDATE users SET warns = ? where username = ? AND idGroup = ?", [usrWarn, userName, chatId], (error, results) => {
                        if (error) throw error;
                    })
                } else {
                    bot.sendMessage(chatId, "⚠️ <u>Utente non trovato </u>", { parse_mode: "HTML" })
                }
            })
        })
    })
});

//---------remove-1-warn---w-tag-----------
bot.onText(/\/unwarn (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userId = msg.from.id
    var userName = match[1].substring(1);
    let grpWarn;
    let usrWarn;
    check.isMod(bot, chatId, userId, () => {
        conn.query("SELECT maxWarns from groups WHERE groupName = ?", [chatId], (error, results) => {
            if (error) throw error;
            grpWarn = results[0].maxWarns;
            conn.query("SELECT idUserTelegram,warns FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
                if (error) throw error
                if (results.length > 0) {
                    if (results[0].warns > 0) {
                        usrWarn = results[0].warns - 1;
                        bot.sendMessage(chatId, `<i>All'utente @${userName} è stato rimosso un warn</i> \n\n<b>❕ Stato:</b> ${usrWarn} warn (su ${grpWarn})`, { parse_mode: "HTML" })
                        conn.query("UPDATE users SET warns = ? where username = ? AND idGroup = ?", [usrWarn, userName, chatId], (error, results) => {
                            if (error) throw error;
                        })
                    } else {
                        bot.sendMessage(chatId, `<i>L'utente @${userName} ha attualmente <b>0 warn</b></i> \n(su ${grpWarn})`, { parse_mode: "HTML" })
                    }


                } else {
                    bot.sendMessage(chatId, "⚠️ <u>Utente non trovato </u>", { parse_mode: "HTML" })
                }
            })
        })
    })
});

//--------remove--ALL-warns-of-a-member------
bot.onText(/\/resetwarns (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userId = msg.from.id
    var userName = match[1].substring(1);
    let grpWarn;
    let usrWarn = 0;
    check.isMod(bot, chatId, userId, () => {
        conn.query("SELECT maxWarns from groups WHERE groupName = ?", [chatId], (error, results) => {
            if (error) throw error;
            grpWarn = results[0].maxWarns;
            conn.query("SELECT idUserTelegram,warns FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
                if (error) throw error
                if (results.length > 0) {

                    bot.sendMessage(chatId, `<i>L'utente @${userName} è stato resettato di tutti gli warn</i> \n\n<b>❕ Stato:</b> ${usrWarn} warn (su ${grpWarn})`, { parse_mode: "HTML" })
                    conn.query("UPDATE users SET warns = ? where username = ? AND idGroup = ?", [usrWarn, userName, chatId], (error, results) => {
                        if (error) throw error;
                    })
                } else {
                    bot.sendMessage(chatId, "⚠️ <u>Utente non trovato </u>", { parse_mode: "HTML" })
                }
            })
        })
    })
});

//-----------kick w tag-----------
bot.onText(/\/kick (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isMod(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup =? ", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    check.isnotMod(bot, chatId, el.idUserTelegram, () => {
                        bot.kickChatMember(chatId, el.idUserTelegram)
                        bot.unbanChatMember(chatId, el.idUserTelegram)
                        bot.sendMessage(chatId, `Utente @${el.username} <b>è stato kicka</b>`, { parse_mode: "HTML" })
                        bot.sendMessage(el.idUserTelegram, "Sei stato kickato da @" + msg.chat.username)
                    })
                }
            })
        })
    })
});

//------------ban w tag----------------
bot.onText(/\/ban (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isMod(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    check.isnotMod(bot, chatId, el.idUserTelegram, () => {
                        bot.kickChatMember(chatId, el.idUserTelegram)
                        bot.sendMessage(chatId, `Utente @${el.username} <b>bannato</b>`, { parse_mode: "HTML" })
                        bot.sendMessage(el.idUserTelegram, "Sei stato bannato da @" + msg.chat.username)
                    })
                }
            })
        })
    })

});

//------------unban w tag--------------
bot.onText(/\/unban (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isMod(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.unbanChatMember(chatId, el.idUserTelegram)
                    bot.sendMessage(chatId, `Utente @${el.username} <b>sbannato</b>`, { parse_mode: "HTML" })
                    bot.sendMessage(el.idUserTelegram, "Sei stato sbannato da @" + msg.chat.username)
                }
            })
        })
    })
})

//------------MUTE w tag---------------
bot.onText(/\/mute (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isMod(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    check.isnotMod(bot, chatId, el.idUserTelegram, () => {
                        bot.restrictChatMember(chatId, el.idUserTelegram, {
                            can_send_messages: false
                        })
                        bot.sendMessage(chatId, `Utente @${el.username} <b>è stato mutato</b>`, { parse_mode: "HTML" })
                    })
                }
            })
        })
    })
})
bot.onText(/\/unmute (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isMod(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.restrictChatMember(chatId, el.idUserTelegram, {
                        can_send_messages: true
                    })
                    bot.sendMessage(chatId, `Utente @${el.username} <b>è stato smutato</b>`, { parse_mode: "HTML" })
                    bot.sendMessage(el.idUserTelegram, "Sei stato sbannato da @" + msg.chat.username)
                }
            })
        })
    })
})


//-------ONLY ADMINS-------

//--------SET Rules----------
bot.onText(/\/setregole (.+)/, (msg, match) => {
    var regole = match[1]
    var chatId = msg.chat.id;
    check.isAdmin(bot, chatId, msg.from.id, () => {
        conn.query("UPDATE groups SET groupRules = ? WHERE groupName = ?", [regole, chatId], (error, results) => {
            if (error) throw error;
            bot.sendMessage(chatId, "Regole impostate con successo!")
        })
    })
});

//----------SET MOD------------
bot.onText(/\/mod (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isAdmin(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.promoteChatMember(msg.chat.id, el.idUserTelegram, {
                        can_delete_messages: true,
                        can_pin_messages: true,
                        can_restrict_members: true,
                    })
                    bot.sendMessage(chatId, `<b>L'utente @${el.username} È stato reso un 👷 Moderatore</b>`, { parse_mode: "HTML" })
                }
            })
        })
    })
})

//----------UNMOD-----------
bot.onText(/\/unmod (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isAdmin(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.promoteChatMember(msg.chat.id, el.idUserTelegram, {
                        can_delete_messages: false,
                        can_pin_messages: false,
                        can_restrict_members: false,
                    })
                    bot.sendMessage(chatId, `<b>L'utente @${el.username} È stato rimosso da 👷 Moderatore</b>`, { parse_mode: "HTML" })
                }
            })
        })
    })
})


//----------ONLY VICE-----------

//----------SET ADMIN------------
bot.onText(/\/admin (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isVice(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.promoteChatMember(msg.chat.id, el.idUserTelegram, {
                        can_change_info: true,
                        can_delete_messages: true,
                        can_invite_users: true,
                        can_pin_messages: true,
                        can_restrict_members: true,
                        can_edit_messages: true,
                        can_post_messages: true,
                        can_promote_members: false
                    })
                    bot.sendMessage(chatId, `<b>L'utente @${el.username} È stato reso un 👮🏼 Amministratore</b>`, { parse_mode: "HTML" })
                }
            })
        })
    })
})

bot.onText(/\/unadmin (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isVice(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.promoteChatMember(msg.chat.id, el.idUserTelegram, {
                        can_change_info: false,
                        can_delete_messages: false,
                        can_invite_users: false,
                        can_pin_messages: false,
                        can_restrict_members: false,
                        can_edit_messages: false,
                        can_post_messages: false,
                        can_promote_members: false
                    })
                    bot.sendMessage(chatId, `<b>L'utente @${el.username} È stato rimosso da 👮🏼 Amministratore</b>`, { parse_mode: "HTML" })
                }
            })
        })
    })
})


//---------ONLY FOUNDER--------

//----------SET VICE------------
bot.onText(/\/vice (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isFounder(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.promoteChatMember(msg.chat.id, el.idUserTelegram, {
                        can_change_info: true,
                        can_delete_messages: true,
                        can_invite_users: true,
                        can_pin_messages: true,
                        can_restrict_members: true,
                        can_edit_messages: true,
                        can_post_messages: true,
                        can_promote_members: true
                    })
                    bot.sendMessage(chatId, `<b>L'utente @${el.username} È stato reso un ⚜️ Vice-fondatore</b>`, { parse_mode: "HTML" })
                }
            })
        })
    })
})

bot.onText(/\/unvice (.+)/, (msg, match) => {
    var chatId = msg.chat.id;
    var userName = match[1].substring(1);
    check.isFounder(bot, chatId, msg.from.id, () => {
        conn.query("SELECT * FROM users WHERE username = ? AND idGroup = ?", [userName, chatId], (error, results) => {
            if (error) throw error
            results.forEach(el => {
                if (el.username == userName) {
                    bot.promoteChatMember(msg.chat.id, el.idUserTelegram, {
                        can_change_info: false,
                        can_delete_messages: false,
                        can_invite_users: false,
                        can_pin_messages: false,
                        can_restrict_members: false,
                        can_edit_messages: false,
                        can_post_messages: false,
                        can_promote_members: false
                    })
                    bot.sendMessage(chatId, `<b>L'utente @${el.username} È stato rimosso da ⚜️ Vice-fondatore</b>`, { parse_mode: "HTML" })
                }
            })
        })
    })
})


//---------USELESS FUNCTIONS-----------

//-----send message-----
bot.onText(/\/sendmessage (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    let mex = "\n\n\n✍️<i>Lo staff</i>"

    check.isAdmin(bot, chatId, msg.from.id, () => {
        bot.deleteMessage(chatId, msg.message_id)
        bot.sendMessage(chatId, match[1] + mex, { parse_mode: "HTML" })
    })
})

//-----pin message-----
bot.onText(/\/pin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    check.isMod(bot, msg.chat.id, userId, () => {
        if (msg.reply_to_message) {
            bot.pinChatMessage(chatId, msg.reply_to_message.message_id)
            bot.deleteMessage(msg.chat.id, msg.message_id)
        }
    })
})
//-----unpin message-----
bot.onText(/\/unpin/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    check.isMod(bot, msg.chat.id, userId, () => {
        bot.unpinAllChatMessages(chatId)
        bot.deleteMessage(chatId, msg.message_id)
    })
})